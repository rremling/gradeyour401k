// src/lib/email/send.ts
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";

if (!RESEND_API_KEY) console.warn("[email] Missing RESEND_API_KEY");
if (!EMAIL_FROM) console.warn("[email] Missing EMAIL_FROM");

export async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
  text?: string; // optional
}) {
  const attachments =
    params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      disposition: "attachment",
      type: a.contentType || "application/pdf",
    })) || [];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${txt || res.statusText}`);
  }
}
