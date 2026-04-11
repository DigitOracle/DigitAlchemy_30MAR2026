import { NextRequest, NextResponse } from "next/server";

const VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — British male

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string" || text.length > 500) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[tts] ElevenLabs error:", err);
      return NextResponse.json({ error: "TTS failed" }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[tts] Unexpected error:", e);
    return NextResponse.json({ error: "TTS error" }, { status: 500 });
  }
}
