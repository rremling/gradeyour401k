// src/app/grade/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROVIDER_DISPLAY,
  PROVIDER_TICKERS,
  ProviderKey,
} from "@/lib/providerMeta";

type InvestorProfile = "Aggressive Growth" | "Growth" | "Balanced";
type Holding = { symbol: string; weight: number | "" };

const FORM_STORAGE = "gy4k_form_v1";

export default function GradeNewPage() {
  const router = useRouter();

  // Core form state
  const [provider, setProvider] = useState<ProviderKey>("fidelity");
  const [profile, setProfile] = useState<InvestorProfile>("Growth");
  const [rows, setRows] = useState<Holding[]>([
    { symbol: "FSKAX", weight: 40 },
    { symbol: "FXNAX", weight: 20 },
  ]);

  // UI helpers
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Hidden dropdown state
  const [showAddList, setShowAddList] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string>("");

  // Load draft once
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(FORM_STORAGE);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.provider) setProvider(parsed.provider);
      if (parsed?.profile) setProfile(parsed.profile);
      if (Array.isArray(parsed?.rows) && parsed.rows.length) {
        setRows(
          parsed.rows.map((r: any) => ({
            symbol: String(r.symbol || "").toUpperCase(),
            weight:
              r.weight === "" || r.weight === null || Number.isNaN(Number(r.weight))
                ? ""
                : Number(r.weight),
          }))
        );
      }
    } catch {}
  }, []);

  // Persist draft on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      FORM_STORAGE,
      JSON.stringify({ provider, profile, rows })
    );
  }, [provider, profile, rows]);

  const total = useMemo(
    () =>
      rows.reduce((sum, r) => sum + (typeof r.weight === "number" ? r.weight : 0), 0),
    [rows]
  );

  const canSubmit = provider.length > 0 && Math.abs(total - 100) < 0.1 && !saving;

  // Row ops
  function addRow() {
    setRows((r) => [...r, { symbol: "", weight: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, key: keyof Holding, v: string) {
    setRows((r) =>
      r.map((row, idx) => {
        if (idx !== i) return row;
        if (key === "weight") {
          const trimmed = v.trim();
          return { ...row, weight: trimmed === "" ? "" : Number(trimmed) };
        }
        return { ...row, symbol: v.toUpperCase() };
      })
    );
  }

  // Add from hidden dropdown
  function addSelectedTicker() {
    const t = selectedTicker.trim().toUpperCase();
    if (!t) return;
    setRows((r) => {
      if (r.some((row) => row.symbol === t)) return r;
      return [...r, { symbol: t, weight: "" }];
    });
  }

  // Basic grade until your final model logic
  function computeGrade(profileInput: InvestorProfile, totalWeight: number): number {
    const base =
      profileInput === "Aggressive Growth" ? 4.5 : profileInput === "Balanced" ? 3.8 : 4.1;
    const penalty = Math.min(1, Math.abs(100 - totalWeight) / 100);
    return Math.max(1, Math.min(5, Math.round((base - penalty) * 2) / 2));
  }

  async function savePreview(payload: {
    provider: ProviderKey;
    provider_display: string;
    profile: InvestorProfile;
    rows: { symbol: string; weight: number }[];
    grade_base: number;
    grade_adjusted: number;
  }) {
    const res = await fetch("/api/preview/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.id) throw new Error(data?.error || "Failed to save preview");
    if (typeof window !== "undefined") {
      localStorage.setItem("gy4k_preview_id", data.id as string);
    }
    return data.id as string;
  }

  async function onSubmit() {
    try {
      setErr(null);
      setSaving(true);

      const cleanRows = rows
        .filter(
          (r) =>
            r.symbol.trim() !== "" &&
