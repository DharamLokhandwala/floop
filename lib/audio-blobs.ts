import "server-only";

import { del, put } from "@vercel/blob";
import { v4 } from "uuid";
import type { Pin } from "@/types/audit";

const AUDIO_BLOB_PREFIX = "audio-pins";
const DELETE_ATTEMPTS = 3;
const AUDIO_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webm|ogg|m4a|wav)$/i;

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

type AudioFileMetadata = {
  contentType: string;
  extension: "webm" | "ogg" | "m4a" | "wav";
};

type AudioDeleteTarget = {
  identifier: string;
  token: string;
};

function privateAudioToken(): string {
  const token = process.env.AUDIO_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "AUDIO_BLOB_READ_WRITE_TOKEN is not configured for the private audio Blob store"
    );
  }
  return token;
}

function publicBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not configured for legacy public audio cleanup"
    );
  }
  return token;
}

export function getAudioFileMetadata(file: File): AudioFileMetadata {
  const contentType = (file.type || "audio/webm").split(";")[0].trim().toLowerCase();
  if (contentType === "audio/ogg") {
    return { contentType, extension: "ogg" };
  }
  if (
    contentType === "audio/mp4" ||
    contentType === "audio/m4a" ||
    contentType === "audio/x-m4a"
  ) {
    return { contentType, extension: "m4a" };
  }
  if (contentType === "audio/wav" || contentType === "audio/x-wav") {
    return { contentType, extension: "wav" };
  }
  if (contentType === "audio/webm") {
    return { contentType, extension: "webm" };
  }
  throw new Error("Unsupported audio format");
}

export function isAudioBlobFilename(value: string): boolean {
  return AUDIO_FILENAME_PATTERN.test(value);
}

export function audioBlobPath(auditId: string, filename: string): string {
  if (!isAudioBlobFilename(filename)) {
    throw new Error("Invalid audio filename");
  }
  return `${AUDIO_BLOB_PREFIX}/${encodeURIComponent(auditId)}/${filename}`;
}

function audioDeliveryPath(auditId: string, filename: string): string {
  return `/audit/${encodeURIComponent(auditId)}/audio/${encodeURIComponent(filename)}`;
}

export async function uploadPinAudio(
  auditId: string,
  file: File
): Promise<{ audioUrl: string; pathname: string }> {
  if (file.size <= 0) throw new Error("Audio file is empty");
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio file too large (max 10 MB)");
  }

  const { contentType, extension } = getAudioFileMetadata(file);
  const filename = `${v4()}.${extension}`;
  const pathname = audioBlobPath(auditId, filename);
  await put(pathname, file, {
    access: "private",
    cacheControlMaxAge: 60,
    contentType,
    token: privateAudioToken(),
  });

  return {
    audioUrl: audioDeliveryPath(auditId, filename),
    pathname,
  };
}

function getDeleteTarget(auditId: string, audioUrl: string): AudioDeleteTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(audioUrl, "https://floop.invalid");
  } catch {
    return null;
  }

  if (parsed.origin === "https://floop.invalid") {
    let segments: string[];
    try {
      segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return null;
    }
    if (
      segments.length === 4 &&
      segments[0] === "audit" &&
      segments[1] === auditId &&
      segments[2] === "audio" &&
      isAudioBlobFilename(segments[3])
    ) {
      return {
        identifier: audioBlobPath(auditId, segments[3]),
        token: privateAudioToken(),
      };
    }
    return null;
  }

  const isVercelBlob =
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(".blob.vercel-storage.com");
  const isLegacyAudio = parsed.pathname.startsWith(`/${AUDIO_BLOB_PREFIX}/`);
  if (!isVercelBlob || !isLegacyAudio) return null;

  return {
    identifier: parsed.href,
    token: parsed.hostname.endsWith(".private.blob.vercel-storage.com")
      ? privateAudioToken()
      : publicBlobToken(),
  };
}

async function deleteWithRetry(target: AudioDeleteTarget): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt += 1) {
    try {
      await del(target.identifier, { token: target.token });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < DELETE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to delete audio blob after retries");
}

/**
 * Deletes current private audio references and legacy public audio-pins URLs.
 * Unknown URLs are not handed to Blob deletion, which prevents pin data from
 * turning this helper into an arbitrary object-deletion primitive.
 */
export async function deletePinAudio(
  auditId: string,
  audioUrl: string | null | undefined
): Promise<void> {
  if (!audioUrl) return;
  const target = getDeleteTarget(auditId, audioUrl);
  if (!target) {
    console.warn("[audio-blob] Skipped unrecognized audio reference", { auditId });
    return;
  }
  await deleteWithRetry(target);
}

export async function deletePinAudioForPins(
  auditId: string,
  pins: Pin[]
): Promise<void> {
  const audioUrls = [
    ...new Set(
      pins
        .map((pin) => pin.audioUrl)
        .filter((audioUrl): audioUrl is string => Boolean(audioUrl))
    ),
  ];
  await Promise.all(audioUrls.map((audioUrl) => deletePinAudio(auditId, audioUrl)));
}
