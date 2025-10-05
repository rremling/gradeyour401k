// src/app/grade/new/page.tsx
import { Suspense } from "react";
import NewGradeClient from "./_NewGradeClient";

export default function NewGradePage() {
  return (
    <Suspense fallback={<main className="p-6">Loading form…</main>}>
      <NewGradeClient />
    </Suspense>
  );
}
