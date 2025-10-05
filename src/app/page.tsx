// src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold">
          How does your <span className="text-blue-600">401k</span> stack up?
        </h1>
        <p className="mt-4 text-gray-600">
          Get a personalized grade and a simple, actionable plan to optimize your 401k — in minutes.
        </p>
        <div className="mt-8">
          <Link
            href="/grade/new"
            className="inline-block rounded-lg bg-blue-600 text-white px-5 py-3 hover:bg-blue-700"
          >
            Get your grade
          </Link>
        </div>
        <p className="mt-3 text-xs text-gray-500">For informational purposes only. Not investment advice.</p>
      </div>
    </main>
  );
}
