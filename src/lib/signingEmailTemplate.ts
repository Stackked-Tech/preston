// ─── Signing Invitation Email Template ────────────────────
// Generates a beautiful HTML email for signing invitations.
// Table-based layout with inline styles for email client compatibility.

interface SigningEmailParams {
  recipientName: string;
  senderName: string;
  envelopeTitle: string;
  envelopeMessage: string;
  signingLink: string;
  documentCount: number;
  fieldCount: number;
}

export function generateSigningEmail(params: SigningEmailParams): string {
  const {
    recipientName,
    senderName,
    envelopeTitle,
    envelopeMessage,
    signingLink,
    documentCount,
    fieldCount,
  } = params;

  const firstName = recipientName.split(" ")[0];
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Signature Request — ${envelopeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f1012;font-family:Georgia,'Times New Roman',serif;">

  <!-- Preheader text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${senderName || "Someone"} has sent you "${envelopeTitle}" for your signature.
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0f1012;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Inner card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#1a1b1f;border-radius:12px;border:1px solid #2a2b30;">

          <!-- Gold accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#d4af37,#c4a030,#d4af37);border-radius:12px 12px 0 0;font-size:0;line-height:0;">
              &nbsp;
            </td>
          </tr>

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding:36px 40px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;background-color:#d4af37;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="font-size:20px;color:#0a0b0e;font-weight:bold;font-family:Georgia,'Times New Roman',serif;">S</span>
                  </td>
                  <td style="padding-left:12px;">
                    <span style="font-size:18px;color:#e8e4dc;font-family:Georgia,'Times New Roman',serif;letter-spacing:0.5px;">Signed to Sealed</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#2a2b30;"></div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 40px 8px;">
              <p style="margin:0;font-size:22px;color:#e8e4dc;font-family:Georgia,'Times New Roman',serif;font-weight:normal;">
                Hello, ${firstName}
              </p>
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td style="padding:8px 40px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">
                ${senderName ? `<strong style="color:#e8e4dc;">${senderName}</strong> has` : "You have been"} requested your signature on a document.
              </p>
            </td>
          </tr>

          <!-- Document card -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#141518;border:1px solid #2a2b30;border-radius:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:2px;">
                      Document
                    </p>
                    <p style="margin:0 0 12px;font-size:17px;color:#e8e4dc;font-family:Georgia,'Times New Roman',serif;">
                      ${envelopeTitle}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:20px;">
                          <p style="margin:0;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            <span style="color:#d4af37;">${documentCount}</span> ${documentCount === 1 ? "file" : "files"}
                          </p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            <span style="color:#d4af37;">${fieldCount}</span> ${fieldCount === 1 ? "field" : "fields"} to complete
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${envelopeMessage ? `
                <tr>
                  <td style="padding:0 24px;">
                    <div style="height:1px;background-color:#2a2b30;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-transform:uppercase;letter-spacing:2px;">
                      Message
                    </p>
                    <p style="margin:0;font-size:14px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;font-style:italic;">
                      "${envelopeMessage}"
                    </p>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;background-color:#d4af37;">
                <tr>
                  <td align="center" style="padding:14px 48px;">
                    <a href="${signingLink}" target="_blank" style="font-size:15px;color:#0a0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:600;text-decoration:none;display:inline-block;letter-spacing:0.3px;">
                      Review &amp; Sign
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 40px 28px;">
              <p style="margin:0;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#d4af37;font-family:monospace;word-break:break-all;line-height:1.4;">
                ${signingLink}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#2a2b30;"></div>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:20px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;padding-right:10px;">
                    <span style="font-size:14px;">&#128274;</span>
                  </td>
                  <td>
                    <p style="margin:0;font-size:12px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
                      This link is unique to you. Do not forward this email — anyone with this link can sign on your behalf.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#2a2b30;"></div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 40px 28px;">
              <p style="margin:0;font-size:11px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;">
                Powered by Signed to Sealed &middot; WHB Companies<br/>
                &copy; ${year} All rights reserved
              </p>
            </td>
          </tr>

        </table>
        <!-- /Inner card -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
}

export function generateSigningEmailSubject(envelopeTitle: string, senderName?: string): string {
  if (senderName) {
    return `Signature requested: ${envelopeTitle} — from ${senderName}`;
  }
  return `Signature requested: ${envelopeTitle}`;
}

export function generateSigningEmailPlainText(params: SigningEmailParams): string {
  const { recipientName, senderName, envelopeTitle, envelopeMessage, signingLink, documentCount, fieldCount } = params;
  const firstName = recipientName.split(" ")[0];

  let text = `Hello, ${firstName}\n\n`;
  text += `${senderName ? `${senderName} has` : "You have been"} requested your signature on a document.\n\n`;
  text += `DOCUMENT: ${envelopeTitle}\n`;
  text += `${documentCount} file${documentCount !== 1 ? "s" : ""} · ${fieldCount} field${fieldCount !== 1 ? "s" : ""} to complete\n`;
  if (envelopeMessage) {
    text += `\nMESSAGE: "${envelopeMessage}"\n`;
  }
  text += `\nReview & Sign: ${signingLink}\n\n`;
  text += `---\nThis link is unique to you. Do not forward — anyone with this link can sign on your behalf.\n`;
  text += `Powered by Signed to Sealed · WHB Companies\n`;

  return text;
}
