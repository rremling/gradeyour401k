// src/app/success/page.tsx
import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

// Ensure this page is not pre-rendered in a way that trips CSR bailout checks.
export const dynamic = "force-dynamic";

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6">
          <div className="rounded-lg border p-6 bg-white text-sm text-gray-600">
            Finalizing your order…
          </div>
        </main>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}
