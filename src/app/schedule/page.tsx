export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-3">
        Schedule Your 30-Minute 401(k) Review
      </h1>

      <p className="text-sm text-gray-600 mb-6">
        Pick a time below that works best for you. We’ll review your uploaded
        401(k) statement beforehand so your call is focused on your results and
        recommendations.
      </p>

      <div className="w-full h-[900px] rounded-xl overflow-hidden border">
        <iframe
          title="Kenai Investments — 401k Review Call"
          src="https://kenaiinvest.appointlet.com/s/401k-review-call"
          className="w-full h-full"
        />
      </div>
    </main>
  );
}
