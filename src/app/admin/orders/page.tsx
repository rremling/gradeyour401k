// src/app/admin/orders/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = cookies().get("admin_session")?.value;
  if (!session) redirect("/admin/login?returnTo=/admin/orders");

  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("Missing host header");
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/admin/orders`, {
    headers: { cookie: cookies().toString() },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/admin/login?returnTo=/admin/orders");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load orders (${res.status}): ${text}`);
  }

  // 👇 Defensive: tolerate non-JSON or different shapes
  const data = await res.json().catch(() => ({}));
  const orders = Array.isArray((data as any).orders) ? (data as any).orders : [];

  return <OrdersClient initialOrders={orders} />;
}
