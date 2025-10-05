export default function CancelPage() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-center space-y-4">
      <h1 className="text-3xl font-bold">Payment canceled</h1>
      <p className="text-gray-600">No charge was made. You can try again anytime.</p>
      <a href="/pricing" className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50">Return to pricing</a>
    </main>
  );
}
