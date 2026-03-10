import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang = "Spanish" } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Translation service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:
          "Translate the following maintenance request text to " +
          targetLang +
          ". Preserve any technical or maintenance terminology. Return only the translated text, nothing else.",
        messages: [{ role: "user", content: text.trim() }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Translation failed" },
        { status: 500 }
      );
    }

    const translation = data.content?.[0]?.text;
    if (!translation) {
      return NextResponse.json(
        { error: "No translation returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ translation });
  } catch (err) {
    console.error("Hospitality translate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
