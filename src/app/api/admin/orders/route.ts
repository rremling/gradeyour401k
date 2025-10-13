// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  if (!cookies().get("admin_session")?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // TODO: fetch real orders
  return NextResponse.json({ orders: [{ id: "A1001", total: 129.99 }] });
}
