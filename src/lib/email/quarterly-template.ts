// src/lib/email/quarterly-template.ts

export function renderQuarterlyHtml(args: {
  provider: string;
  profile: string;
  grade: number | null;
}) {
  const provider = args.provider || "—";
  const profile = args.profile || "—";
  const gradeStr = args.grade == null ? "—" : `${Number(args.grade).toFixed(1)} / 5`;

  // EXACT same CTA as one-time:
  const CTA_HREF = "https://gradeyour401k.com/review";
  const CTA_TEXT = "Book Your 401(k) Review Call — $149";

  const subject = "Your GradeYour401k PDF Report (Quarterly Update)";

  const html = `
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your quarterly 401(k) report is attached. View your grade and next steps inside.
  </div>

  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.55;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 16px 0;">
      <tr>
        <td align="left" style="padding:0;">
          <a href="https://gradeyour401k.com" style="text-decoration:none;display:inline-block;">
            <img src="https://i.imgur.com/DMCbj99.png" alt="GradeYour401k" width="160" style="display:block;border:0;outline:none;height:auto;">
          </a>
        </td>
        <td align="right" style="padding:0;font-size:13px;color:#555;">
          <a href="https://gradeyour401k.com" style="color:#0b59c7;text-decoration:none;">gradeyour401k.com</a>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px 0;">Your GradeYour401k Report</h2>
    <p style="margin:0 0 16px 0;">Your quarterly 401(k) report is attached as a PDF.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;width:160px;color:#555;">Grade</td>
        <td style="padding:8px 0;"><strong>${gradeStr}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Provider</td>
        <td style="padding:8px 0;">${provider}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Profile</td>
        <td style="padding:8px 0;">${profile}</td>
      </tr>
    </table>

    <h3 style="margin:16px 0 8px 0;">Recommended Next Steps</h3>
    <ol style="margin:0 0 16px 20px;padding:0;">
      <li style="margin:6px 0;">Log in to your 401(k) plan.</li>
      <li style="margin:6px 0;">Update your allocations to align with your <em>Investor Profile</em> and our guidance in the attached report.</li>
      <li style="margin:6px 0;">Save/confirm your changes inside the plan.</li>
      <li style="margin:6px 0;">
        <strong>Want a second opinion?</strong><br />
        Schedule a <strong>30-Minute 401(k) Review Call</strong> and we’ll confirm your updates and fine-tune your allocation.
      </li>
    </ol>

    <!-- SAME CTA AS ONE-TIME -->
    <div style="margin:20px 0 10px;">
      <a href="${CTA_HREF}"
         style="display:inline-block;padding:12px 18px;background:#0b59c7;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
        ${CTA_TEXT}
      </a>
    </div>
    <p style="margin:0 0 16px 0; font-size:14px; color:#555;">
      After checkout you’ll securely upload your 401(k) statement and pick a time on our calendar.
    </p>

    <hr style="border:none;border-top:1px solid #e6e6e6;margin:16px 0;" />
    <p style="margin:8px 0 0 0;font-size:12px;color:#777;">
      Prepared by Kenai Investments, Inc. (“Kenai”), a Registered Investment Advisor. This report is for informational purposes only and does not constitute
      a recommendation to buy or sell any security. Grades and allocations are estimates based on data provided and plan options available at the time of
      preparation and may change without notice. Investing involves risk, including the possible loss of principal. Past performance is not indicative of
      future results. Review the attached report carefully and consider your objectives, risk tolerance, time horizon, and tax situation. Advisory services
      are offered only where Kenai is properly registered or exempt from registration. For more information, visit
      <a href="https://gradeyour401k.com" style="color:#0b59c7;text-decoration:none;">gradeyour401k.com</a>.
    </p>
  </div>
  `;

  const text = `Your quarterly 401(k) report is attached as a PDF.

Grade: ${gradeStr}
Provider: ${provider}
Profile: ${profile}

Book Your 401(k) Review Call — $149:
https://gradeyour401k.com/review
`;

  return { subject, html, text };
}
