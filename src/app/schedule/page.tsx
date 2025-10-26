// src/app/schedule/page.tsx
"use client";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const url = "https://kenaiinvest.appointlet.com/s/401k-review-call";
  const fallback = "https://www.kenaiinvest.com/";

  const openScheduler = () => {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    // If a popup blocker blocks it, fall back to same-tab navigation:
    if (!win || win.closed) window.location.href = url;
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-3">
        Schedule Your 30-Minute 401(k) Review
      </h1>

      <p className="text-sm text-gray-600 mb-6">
        Click below to launch our secure scheduler. When you finish booking,
        you’ll be sent to our main site automatically.
      </p>

      <div className="rounded-xl border p-6 flex flex-col items-center gap-4">
        <button
          onClick={openScheduler}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition"
        >
          Launch Scheduler
        </button>

        <div className="text-xs text-gray-500">
          If a popup is blocked,{" "}
          <a className="text-blue-700 underline" href={url} target="_blank" rel="noopener noreferrer">
            tap here to open it
          </a>
          . After booking, you’ll be redirected to{" "}
          <a className="text-blue-700 underline" href={fallback} target="_blank" rel="noopener noreferrer">
            kenaiinvest.com
          </a>.
        </div>
      </div>
    </main>
  );
}
