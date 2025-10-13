// src/app/admin/orders/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export default async function Page() {
  const session = cookies().get("admin_session")?.value;
  if (!session) redirect("/admin/login?returnTo=/admin/orders");

  // Prefer fetching data directly here; if you must call your API, forward cookies:
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/orders`, {
    headers: { cookie: cookies().toString() },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/admin/login?returnTo=/admin/orders");
  if (!res.ok) throw new Error("Failed to load orders");

  const { orders } = await res.json();
  return <OrdersClient initialOrders={orders} />;
}
