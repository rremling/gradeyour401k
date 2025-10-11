// src/lib/email.ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReportEmail({
  to,
  subject,
  html,
  attachment,
}: {
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer };
}) {
  return await resend.emails.send({
    from: "reports@gradeyour401k.kenaiinvest.com", // 👈 must match verified sender
    to,
    subject,
    html,
    attachments: [
      {
        filename: attachment.filename,
        content: attachment.content.toString("base64"),
      },
    ],
  });
}
