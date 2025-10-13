// src/app/admin/orders/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

// Option A: fetch directly from your DB or service here on the server.
// For demo, we’ll call the API but forward cookies explicitly.
async function fetchOrdersServer() {
  const cookieHeader = cookies().toString(); // serialize all cookies
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/orders`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error("Failed to load orders");
  }
  const data = await res.json();
  return data.orders as Array<{ id: string; total: number }>;
}

export default async function Page() {
  const session = cookies().get("admin_session")?.value;
  if (!session) {
    redirect("/admin/login?returnTo=/admin/orders");
  }

  const orders = await fetchOrdersServer();
  if (!orders) {
    // No session or unauthorized — hard redirect to login
    redirect("/admin/login?returnTo=/admin/orders");
  }

  // ✅ Only pass serializable data; no functions.
  return <OrdersClient initialOrders={orders} />;
}
