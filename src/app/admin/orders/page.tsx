// src/app/admin/orders/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!cookies().get("admin_session")?.value) {
    redirect("/admin/login?returnTo=/admin/orders");
  }
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/admin/orders`, {
    headers: { cookie: cookies().toString() },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/admin/login?returnTo=/admin/orders");
  if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);

  const data = await res.json().catch(() => ({} as any));
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  return <OrdersClient initialOrders={orders} />;
}
