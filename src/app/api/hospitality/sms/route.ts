import { NextRequest, NextResponse } from "next/server";

const twilioSid = process.env.TWILIO_ACCOUNT_SID!;
const twilioToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber =
  process.env.TWILIO_HM_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER!;

export async function POST(req: NextRequest) {
  try {
    const { to, message } = await req.json();

    if (!to || !message?.trim()) {
      return NextResponse.json(
        { error: "to and message are required" },
        { status: 400 }
      );
    }

    if (!/\d/.test(to)) {
      return NextResponse.json(
        { error: "to must contain digits" },
        { status: 400 }
      );
    }

    // Send via Twilio REST API
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: twilioNumber,
          Body: message.trim(),
        }),
      }
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      return NextResponse.json(
        { error: twilioData.message || "Failed to send SMS" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sid: twilioData.sid });
  } catch (err) {
    console.error("Hospitality SMS error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
