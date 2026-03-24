import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { generateSigningEmail, generateSigningEmailSubject, generateSigningEmailPlainText } from "@/lib/signingEmailTemplate";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// POST — Send signing invitation email (or preview)
// Body: { recipientName, recipientEmail, senderName, envelopeTitle, envelopeMessage, signingLink, documentCount, fieldCount, mode? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientName, recipientEmail, senderName, envelopeTitle, envelopeMessage, signingLink, documentCount, fieldCount, mode } = body;

    if (!recipientName || !recipientEmail || !envelopeTitle || !signingLink) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sanitize: strip all whitespace and lowercase before validating
    const trimmedEmail = recipientEmail.trim().replace(/\s+/g, "").toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: `Invalid email address for ${recipientName}: "${recipientEmail}". Please fix the email and try again.` },
        { status: 400 }
      );
    }

    const emailParams = {
      recipientName,
      senderName: senderName || "",
      envelopeTitle,
      envelopeMessage: envelopeMessage || "",
      signingLink,
      documentCount: documentCount || 1,
      fieldCount: fieldCount || 1,
    };

    const html = generateSigningEmail(emailParams);
    const subject = generateSigningEmailSubject(envelopeTitle, senderName);
    const plainText = generateSigningEmailPlainText(emailParams);

    // Preview mode — return the generated email without sending
    if (mode === "preview") {
      return NextResponse.json({ html, subject, plainText, to: recipientEmail });
    }

    // Send mode — send via Resend
    if (!resend) {
      return NextResponse.json(
        { error: "Email not configured. Add RESEND_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    // Without a verified domain, use onboarding@resend.dev as sender
    const fromAddress = process.env.RESEND_FROM_EMAIL || "Signed to Sealed <onboarding@resend.dev>";

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: trimmedEmail,
      subject,
      html,
      text: plainText,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      to: recipientEmail,
      subject,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
