// src/lib/email.ts
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.warn("[email] Missing RESEND_API_KEY");
}

const FROM_EMAIL =
  process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";

const resend = new Resend(RESEND_API_KEY ?? "");

type Attachment = {
  filename: string;
  content: Buffer | Uint8Array | string;
  contentType?: string;
};

type SendParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
};

/**
 * Named export used by API routes.
 * Sends an email via Resend with optional attachments.
 */
export async function sendReportEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendParams) {
  const resp = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    text,
    attachments:
      attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? "application/pdf",
      })) ?? undefined,
  });

  if (resp.error) {
    throw new Error(
      `[email] Resend error: ${resp.error.name ?? ""} ${resp.error.message ?? ""}`
    );
  }

  return resp.data; // { id: string }
}
