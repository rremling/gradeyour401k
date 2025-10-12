// src/app/admin/orders/page.tsx
import Link from "next/link";

async function getOrders() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/admin/orders`, {
    // Let cookies flow automatically; in Vercel, no credentials option needed server-side.
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: `Error loading orders: ${res.status}` as string, orders: [] as any[] };
  }
  const data = await res.json();
  return { orders: data.orders as any[] };
}

export default async function AdminOrdersPage() {
  const { orders, error } = await getOrders();

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <div className="flex gap-2">
          <form action="/api/admin/session" method="POST" className="hidden" />
          <button
            className="rounded-md border px-3 py-1 text-sm"
            onClick={async () => {
              await fetch("/api/admin/session", { method: "DELETE" });
              window.location.href = "/admin/login";
            }}
          >
            Logout
          </button>
          <button
            className="rounded-md border px-3 py-1 text-sm"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {(!orders || orders.length === 0) ? (
        <div className="rounded border p-4 bg-white text-sm text-gray-700">
          No orders found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Preview</th>
                <th className="py-2 pr-4">Session</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{o.email || "—"}</td>
                  <td className="py-2 pr-4">{o.plan_key}</td>
                  <td className="py-2 pr-4">{o.status}</td>
                  <td className="py-2 pr-4">
                    {o.preview_id ? (
                      <Link className="text-blue-600 underline" href={`/grade/results?previewId=${o.preview_id}`}>
                        {o.preview_id}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="py-2 pr-4">{o.stripe_session_id || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
