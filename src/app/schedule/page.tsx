export default function SchedulePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Schedule Your 30-Minute Review</h1>
      <p className="text-sm text-gray-600 mb-6">Pick a time below that works best for you.</p>
      <div className="w-full h-[800px]">
        <iframe
          title="Schedule with Roger Remling, CFP®"
          src="https://calendly.com/your-handle/30min"  // replace
          className="w-full h-full border rounded-xl"
        />
      </div>
    </main>
  );
}
