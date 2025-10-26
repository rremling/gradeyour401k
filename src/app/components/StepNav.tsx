"use client";

type StepKey = "pay" | "upload" | "schedule";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "pay", label: "Pay" },
  { key: "upload", label: "Upload" },
  { key: "schedule", label: "Schedule" },
];

export default function StepNav({ current }: { current: StepKey }) {
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === current));
  const pct = (idx / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3">
        {/* Desktop / Tablet: dots + labels */}
        <nav className="hidden sm:flex items-center gap-2 sm:gap-4" aria-label="Progress">
          {STEPS.map((s, i) => {
            const isActive = i === idx;
            const isDone = i < idx;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                    isDone ? "bg-blue-600 text-white border-blue-600"
                    : isActive ? "bg-blue-50 text-blue-700 border-blue-600"
                    : "bg-white text-gray-500 border-gray-300",
                  ].join(" ")}
                  aria-current={isActive ? "step" : undefined}
                >
                  {i + 1}
                </span>
                <span
                  className={[
                    "text-sm font-medium",
                    isDone ? "text-gray-700"
                    : isActive ? "text-blue-700"
                    : "text-gray-500",
                  ].join(" ")}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={["mx-1 sm:mx-2 h-px w-16", isDone ? "bg-blue-600" : "bg-gray-300"].join(" ")} />
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile: compact header + single progress bar */}
        <div className="sm:hidden">
          <div className="text-sm font-medium text-gray-700">
            Step {idx + 1} of {STEPS.length}: <span className="text-blue-700">{STEPS[idx].label}</span>
          </div>
          <div className="mt-2 h-1 w-full rounded-full bg-gray-200">
            <div className="h-1 rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
