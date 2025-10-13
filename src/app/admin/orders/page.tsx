// src/app/admin/orders/page.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

// Optional: ensure no caching for this page
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = cookies().get("admin_session")?.value;
  if (!session) redirect("/admin/login?returnTo=/admin/orders");

  // Build an absolute base URL from the current request (works on Vercel)
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("Missing host header");
  const base = `${proto}://${host}`;

  // Forward cookies to the API so it can authenticate
  const res = await fetch(`${base}/api/admin/orders`, {
    headers: {
      // forward *all* cookies from the request
      cookie: cookies().toString(),
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    redirect("/admin/login?returnTo=/admin/orders");
  }
  if (!res.ok) {
    // Surface a clear error to help debugging in logs
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load orders (${res.status}): ${text}`);
  }

  const { orders } = await res.json();
  return <OrdersClient initialOrders={orders} />;
}
