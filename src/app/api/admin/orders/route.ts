// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const token = cookies().get("admin_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Example data; ensure numbers are real numbers
  const raw = [
    { id: "A1001", total: 129.99 },
    { id: "A1002", total: 59.0 },
    { id: "A1003", total: null },     // even if null/undefined comes through…
    { id: "A1004" },                  // …UI won’t crash now
  ];

  return NextResponse.json({ orders: raw });
}
