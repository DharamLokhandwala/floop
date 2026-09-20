import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAudit } from "@/lib/audits";
import { getAudioFileMetadata, MAX_AUDIO_BYTES } from "@/lib/audio-blobs";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser();
    const allowed = await canViewAudit(id, user?.id ?? null);
    if (!allowed) {
      return NextResponse.json(
        {
          error: user
            ? "You do not have access to this audit"
            : "Sign in to add a comment",
        },
        { status: user ? 403 : 401 }
      );
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    // Parse multipart form
    const formData = await request.formData();
    const entry = formData.get("audio");
    if (!entry || typeof entry === "string") {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    const audioFile = entry as File;

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file too large (max 10 MB)" }, { status: 413 });
    }
    if (audioFile.size <= 0) {
      return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
    }

    // Validate the media type here as well as at final submission. The audio
    // remains only in browser memory until the pin is actually submitted.
    getAudioFileMetadata(audioFile);

    const elevenForm = new FormData();
    elevenForm.append("file", audioFile);
    elevenForm.append("model_id", "scribe_v1");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": elevenLabsKey },
      body: elevenForm,
      signal: request.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[transcribe-audio] ElevenLabs transcription failed:", {
        status: res.status,
        error: errText,
      });
      return NextResponse.json({
        transcript: "",
        error: "Transcription failed — please type your comment",
      });
    }

    const data = (await res.json()) as { text: string };
    return NextResponse.json({ transcript: data.text.trim() });
  } catch (err) {
    console.error("[transcribe-audio] Unexpected error:", err);
    return NextResponse.json(
      { error: `Unexpected server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
