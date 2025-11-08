// src/app/api/models/latest/route.ts
import { NextResponse } from "next/server";
import {
  getLatestApprovedModel,
  getLatestFearGreed,
  type Provider,
  type Profile,
} from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = (searchParams.get("provider") || "") as Provider;
    const profile  = (searchParams.get("profile")  || "") as Profile;

    const VALID_PROVIDERS: Provider[] = ["Fidelity","Vanguard","Schwab","Voya","Other"];
    const VALID_PROFILES:  Profile[]  = ["Growth","Balanced","Conservative"];

    if (!VALID_PROVIDERS.includes(provider) || !VALID_PROFILES.includes(profile)) {
      return NextResponse.json({ ok: false, error: "Invalid provider or profile" }, { status: 400 });
    }

    const [model, fg] = await Promise.all([
      getLatestApprovedModel(provider, profile),
      getLatestFearGreed(),
    ]);

    if (!model) {
      return NextResponse.json({ ok: false, error: "No approved model found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      asof: model.asof_date, // keep as returned; UI can slice to YYYY-MM-DD if desired
      provider: model.provider,
      profile: model.profile,
      notes: model.notes,
      fear_greed: fg,     // { asof_date, reading } | null
      // ---- ONLY CHANGE: ensure weight is a number ----
      lines: model.lines.map((l) => ({
        rank: l.rank,
        symbol: l.symbol,
        weight: typeof (l as any).weight === "string" ? Number((l as any).weight) : l.weight,
        role: l.role,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
