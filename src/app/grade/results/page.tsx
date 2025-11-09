// src/app/grade/results/page.tsx
'use client';

import { Suspense } from 'react';
import ResultsClient from './ResultsClient';

export const dynamic = 'force-dynamic'; // don't prerender; this page depends on search params

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6 space-y-6">
          <h1 className="text-2xl font-bold">Your Grade</h1>
          <div className="rounded-lg border p-6 bg-white text-sm text-gray-600">
            Loading…
          </div>
        </main>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
