// src/app/legal/ria/page.tsx
export const dynamic = "force-static";
export const revalidate = false;

export const metadata = {
  title: "RIA Agreement | GradeYour401k",
  description:
    "Registered Investment Advisory Agreement for services provided by Kenai Investments Inc.",
};

export default function RiaAgreementPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10 space-y-6">
      <h1 className="text-3xl font-bold">Registered Investment Advisory Agreement</h1>
      <p className="text-sm text-gray-600">Last updated: October 7, 2025</p>

      <section className="space-y-3">
        <p>
          This Registered Investment Advisory Agreement (“Agreement”) is made between{" "}
          <strong>Kenai Investments Inc.</strong>, a Registered Investment Advisor
          (“Advisor”), and the client (“Client”). By purchasing or using services
          at <strong>gradeyour401k.com</strong> or <strong>PilotYour401k.com<strong>, 
          Client acknowledges and agrees to the terms of this Agreement.
        </p>
        <div className="rounded-md border p-4 bg-gray-50 text-sm">
          <div><strong>Advisor:</strong> Kenai Investments Inc.</div>
          <div><strong>Address:</strong> 2700 S Western, Suite 900, Amarillo, Texas</div>
          <div><strong>Website:</strong> www.kenaiinvest.com</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Scope of Services</h2>
        <p>
          Advisor provides limited-scope, non-discretionary analysis of Client’s
          self-directed employer retirement plan using models and public market
          data. Deliverables may include an indicative grade, a model allocation
          comparison, and an optional PDF report. Advisor does not take custody
          of assets, execute trades, or exercise discretion over Client accounts.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. No Personal Financial Planning</h2>
        <p>
          The analysis is educational and model-based. It is not a comprehensive
          financial plan, tax advice, legal advice, or individualized investment
          recommendation. Client remains solely responsible for all investment
          decisions and for verifying plan-specific constraints, fees, and
          trading limitations before implementing any changes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Fees</h2>
        <p>
          Fees are posted at checkout and may include a one-time report fee and/or
          an annual subscription with scheduled updates. Fees are earned when
          paid and generally non-refundable once analysis begins or the report is
          delivered, except as required by applicable law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">4. Data & Third-Party Services</h2>
        <p>
          Advisor may use third-party market data providers and payment, email,
          and hosting platforms. Accuracy and availability of third-party data
          and services are not guaranteed. Client authorizes Advisor to use Client
          information as reasonably necessary to provide services and fulfill
          orders, subject to the Privacy Policy.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">5. Client Responsibilities</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide accurate, complete inputs (provider, holdings, etc.).</li>
          <li>Review plan rules, fees, and trading limitations before acting.</li>
          <li>Understand that market conditions change and models may be updated.</li>
          <li>Retain copies of any reports and confirmations for records.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">6. Limitations & Disclaimers</h2>
        <p>
          Investing involves risk, including loss of principal. Past performance
          does not guarantee future results. The service may include model
          assumptions and public indicators (e.g., moving averages) that are
          subject to error. Advisor is not responsible for Client implementation,
          platform outages, or consequences of Client actions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">7. Regulatory</h2>
        <p>
          Kenai Investments Inc. is a Registered Investment Advisor. Registration
          does not imply a certain level of skill or training. Client may request
          Advisor’s Form ADV Part 2A and other company documents by visiting 
          www.kenaiinvest.com.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">8. Termination</h2>
        <p>
          Either party may terminate prior to report delivery. Fees for delivered
          or commenced work are non-refundable unless otherwise required by law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">9. Governing Law</h2>
        <p>
          This Agreement is governed by the laws of the State of Texas, without
          regard to conflicts of law principles.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">10. Acceptance</h2>
        <p>
          By checking “I agree” and completing payment, Client acknowledges reading
          and agreeing to this Agreement.
        </p>
      </section>
    </main>
  );
}
