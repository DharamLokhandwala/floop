import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { audioBlobPath, isAudioBlobFilename } from "@/lib/audio-blobs";
import { canViewAudit } from "@/lib/audits";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;
  const user = await getCurrentUser();
  if (!(await canViewAudit(id, user?.id ?? null))) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!isAudioBlobFilename(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const token = process.env.AUDIO_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    console.error("[audio GET] AUDIO_BLOB_READ_WRITE_TOKEN is not configured");
    return new NextResponse("Audio storage is not configured", { status: 503 });
  }

  try {
    const result = await get(audioBlobPath(id, filename), {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
      token,
    });
    if (!result) return new NextResponse("Not found", { status: 404 });
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "private, no-cache",
          ETag: result.blob.etag,
        },
      });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Cache-Control": "private, no-cache",
        "Content-Type": result.blob.contentType,
        ETag: result.blob.etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[audio GET] Failed to read private audio", { auditId: id, error });
    return new NextResponse("Failed to load audio", { status: 502 });
  }
}
