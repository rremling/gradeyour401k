import { Suspense } from "react";
import AdminLoginClient from "./AdminLoginClient";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-sm p-6">
          <div className="rounded-lg border p-4 bg-white text-sm text-gray-600">
            Loading…
          </div>
        </main>
      }
    >
      <AdminLoginClient />
    </Suspense>
  );
}
