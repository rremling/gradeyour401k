// src/lib/email.ts
import { Resend } from "resend";

export async function sendReportEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer; contentType?: string };
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY missing — skipping email send");
    return { skipped: true };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const res = await resend.emails.send({
    from: "reports@gradeyour401k.com",
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    attachments: [
      {
        filename: opts.attachment.filename,
        content: opts.attachment.content,
        contentType: opts.attachment.contentType || "application/pdf",
      },
    ],
  });
  return res;
}
