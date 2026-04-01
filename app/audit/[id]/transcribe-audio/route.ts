import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { v4 } from "uuid";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Allow anonymous on request_feedback audits (same rule as add-pin)
    const rows = await prisma.$queryRaw<[{ mode: string | null }]>`
      SELECT mode FROM Audit WHERE id = ${id}
    `;
    const allowAnonymous = rows[0]?.mode === "request_feedback";
    const user = await getCurrentUser();
    if (!allowAnonymous && !user) {
      return NextResponse.json({ error: "Sign in to add a comment" }, { status: 401 });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not configured on the server" },
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

    if (audioFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file too large (max 10 MB)" }, { status: 413 });
    }

    // Determine extension for blob filename
    const rawMime = audioFile.type || "audio/webm";
    const baseMime = rawMime.split(";")[0].trim();
    const ext = baseMime.includes("ogg")
      ? "ogg"
      : baseMime.includes("mp4") || baseMime.includes("m4a")
      ? "m4a"
      : baseMime.includes("wav")
      ? "wav"
      : "webm";

    // Run blob upload and ElevenLabs transcription in parallel
    const [blobResult, transcriptResult] = await Promise.allSettled([
      // 1. Upload audio to Vercel Blob
      put(`audio-pins/${v4()}.${ext}`, audioFile, {
        access: "public",
        contentType: baseMime,
        token: blobToken,
      }),

      // 2. Transcribe with ElevenLabs Scribe
      (async () => {
        const elevenForm = new FormData();
        elevenForm.append("file", audioFile);
        elevenForm.append("model_id", "scribe_v1");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": elevenLabsKey },
          body: elevenForm,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`ElevenLabs ${res.status}: ${errText}`);
        }

        const data = await res.json() as { text: string };
        return data.text.trim();
      })(),
    ]);

    if (blobResult.status === "rejected") {
      console.error("[transcribe-audio] Blob upload failed:", blobResult.reason);
      return NextResponse.json(
        { error: `Failed to upload audio: ${String(blobResult.reason)}` },
        { status: 500 }
      );
    }

    const audioUrl = blobResult.value.url;

    if (transcriptResult.status === "rejected") {
      console.error("[transcribe-audio] ElevenLabs transcription failed:", transcriptResult.reason);
      return NextResponse.json({
        audioUrl,
        transcript: "",
        error: "Transcription failed — please type your comment",
      });
    }

    return NextResponse.json({ audioUrl, transcript: transcriptResult.value });
  } catch (err) {
    console.error("[transcribe-audio] Unexpected error:", err);
    return NextResponse.json(
      { error: `Unexpected server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
