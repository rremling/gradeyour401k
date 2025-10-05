export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-center space-y-4">
      <h1 className="text-3xl font-bold">Payment Successful 🎉</h1>
      <p className="text-gray-600">
        Thanks! We’re generating your personalized PDF report. You’ll also receive a receipt via email from Stripe.
      </p>
      <a href="/" className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50">Back to home</a>
    </main>
  );
}
