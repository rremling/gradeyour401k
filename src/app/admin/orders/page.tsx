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
  const base = `${proto}://${host}`;

  let initialOrders: any[] = [];
  let loadError: string | null = null;

  try {
    const res = await fetch(`${base}/api/admin/orders`, {
      headers: { cookie: cookies().toString() },
      cache: "no-store",
    });

    if (res.status === 401) {
      redirect("/admin/login?returnTo=/admin/orders");
    } else if (!res.ok) {
      const t = await res.text().catch(() => "");
      loadError = `Orders API error ${res.status}`;
      console.error("orders/page.tsx: API not ok:", res.status, t);
    } else {
      const j = await res.json().catch(() => ({} as any));
      initialOrders = Array.isArray(j?.orders) ? j.orders : [];
      if (j?._error) loadError = String(j._error);
    }
  } catch (e: any) {
    loadError = e?.message || "Unexpected error";
    console.error("orders/page.tsx: fetch failed:", e);
  }

  // Pass a non-throwing hint to the client to render a banner
  return <OrdersClient initialOrders={initialOrders} initialError={loadError} />;
}
