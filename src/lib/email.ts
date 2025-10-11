// src/lib/email.ts
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";

let resend: Resend | null = null;
function getClient() {
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

export async function sendOrderEmail(params: {
  to: string;
  subject?: string;
  previewId?: string | null;
  planKey?: "one_time" | "annual" | string | null;
  providerDisplay?: string | null;
  grade?: string | null;
}) {
  const { to, subject, previewId, planKey, providerDisplay, grade } = params;
  const s = subject || "Your 401(k) order received";

  const safeProvider = providerDisplay || "—";
  const safeGrade = grade || "—";
  const planLabel =
    planKey === "one_time" ? "One-time Report"
    : planKey === "annual" ? "Annual Plan"
    : (planKey || "—");

  const manageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://www.gradeyour401k.com"}/success`;

  const html = `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.6; color:#111;">
    <h2 style="margin:0 0 12px;">Thanks — we’ve started your report</h2>
    <p style="margin:0 0 8px;">Plan: <strong>${planLabel}</strong></p>
    <p style="margin:0 0 8px;">Provider: <strong>${safeProvider}</strong> · Preliminary grade: <strong>${safeGrade}</strong></p>
    ${previewId ? `<p style="margin:0 0 8px;">Preview ID: <code>${previewId}</code></p>` : ""}

    <p style="margin:16px 0 8px;">We’re generating your PDF now. You’ll get another email with the download link shortly.</p>

    <p style="margin:20px 0;">
      <a href="${manageUrl}" style="background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;display:inline-block">
        View order status
      </a>
    </p>

    <p style="font-size:12px;color:#555;margin-top:24px;">
      Kenai Investments Inc. · 2700 S Western Suite 900 · Amarillo, TX · <a href="https://www.kenaiinvest.com">kenaiinvest.com</a>
    </p>
  </div>
  `;

  const client = getClient();
  await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject: s,
    html,
  });
}
