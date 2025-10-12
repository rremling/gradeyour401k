// src/lib/admin.ts
// Centralized admin auth helpers (client + server safe)

// LocalStorage key for client-held admin token (NOT the env secret)
export const ADMIN_LOCALSTORAGE_KEY = "admin_token";

// Client utilities
export function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ADMIN_LOCALSTORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeAdminToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_LOCALSTORAGE_KEY, token);
  } catch {}
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_LOCALSTORAGE_KEY);
  } catch {}
}

// Server-side: the true secret from Vercel env
// Set this in Vercel → Project → Settings → Environment Variables
// Key: ADMIN_TOKEN Value: <your secret> (same in all envs you need)
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
