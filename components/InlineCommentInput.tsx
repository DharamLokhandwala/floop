"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Send, Square, Loader2 } from "lucide-react";
import type { Pin } from "@/types/audit";

export type PendingLiveClick = {
  x: number;
  y: number;
  pageUrl?: string;
  selector?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  scrollX?: number;
  scrollY?: number;
  docX?: number;
  docY?: number;
};

interface InlineCommentInputProps {
  /** Whether the inline input is visible */
  open: boolean;
  /** Viewport-relative position (px) where the user clicked */
  anchorPosition: { x: number; y: number } | null;
  /** Click payload with pin metadata */
  pendingClick: PendingLiveClick | null;
  /** Audit ID used for the transcribe-audio API route */
  auditId: string;
  /** Called when user submits the comment */
  onSave: (pin: Pin) => void;
  /** Called when the user dismisses (clicks away, presses Escape) */
  onDismiss: () => void;
}

type RecordingState = "idle" | "recording" | "transcribing";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 52;
const GAP = 12;

export function InlineCommentInput({
  open,
  anchorPosition,
  pendingClick,
  auditId,
  onSave,
  onDismiss,
}: InlineCommentInputProps) {
  const [feedback, setFeedback] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [micError, setMicError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveformBarsRef = useRef<(HTMLSpanElement | null)[]>([]);

  // Reset all state when opened/closed
  useEffect(() => {
    if (open) {
      setFeedback("");
      setAudioUrl(null);
      setRecordingState("idle");
      setMicError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      stopStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopWaveformLoop() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    // Reset bars to idle state
    waveformBarsRef.current.forEach((bar) => {
      if (bar) { bar.style.height = "4px"; bar.style.opacity = "0.25"; }
    });
  }

  function stopStream() {
    stopWaveformLoop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignored */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }

  function startWaveformLoop(stream: MediaStream) {
    try {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins — plenty for 12 bars
      analyser.smoothingTimeConstant = 0.75;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      void audioCtx.resume();

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const NUM_BARS = 12;

      function draw() {
        analyserRef.current?.getByteFrequencyData(dataArray);
        waveformBarsRef.current.forEach((bar, i) => {
          if (!bar) return;
          const bin = Math.floor((i / NUM_BARS) * dataArray.length * 0.6); // use lower-freq half
          const v = dataArray[bin] / 255; // 0–1
          const height = 4 + v * 18; // 4px silent → 22px loud
          bar.style.height = `${height}px`;
          bar.style.opacity = v < 0.05 ? "0.2" : String(0.4 + v * 0.6);
        });
        animFrameRef.current = requestAnimationFrame(draw);
      }
      draw();
    } catch {
      // AudioContext unavailable — silently skip; bars stay static
    }
  }

  // Click-outside to dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onDismiss]);

  // Escape to dismiss
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onDismiss]);

  const handleSubmit = useCallback(() => {
    if (!feedback.trim() || !pendingClick) return;

    const pin: Pin = {
      x: pendingClick.x,
      y: pendingClick.y,
      category: "Feedback",
      feedback: feedback.trim(),
    };
    if (pendingClick.pageUrl) pin.pageUrl = pendingClick.pageUrl;
    if (pendingClick.selector) pin.selector = pendingClick.selector;
    if (typeof pendingClick.viewportWidth === "number") pin.viewportWidth = pendingClick.viewportWidth;
    if (typeof pendingClick.viewportHeight === "number") pin.viewportHeight = pendingClick.viewportHeight;
    if (typeof pendingClick.scrollX === "number") pin.scrollX = pendingClick.scrollX;
    if (typeof pendingClick.scrollY === "number") pin.scrollY = pendingClick.scrollY;
    if (typeof pendingClick.docX === "number") pin.docX = pendingClick.docX;
    if (typeof pendingClick.docY === "number") pin.docY = pendingClick.docY;
    if (audioUrl) pin.audioUrl = audioUrl;

    onSave(pin);
    setFeedback("");
    setAudioUrl(null);
  }, [feedback, audioUrl, pendingClick, onSave]);

  const handleMicClick = useCallback(async () => {
    setMicError(null);

    if (recordingState === "recording") {
      // Stop recording — onstop handler will do the upload+transcribe
      mediaRecorderRef.current?.stop();
      return;
    }

    if (recordingState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Pick a supported mime type
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"]
        .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopWaveformLoop();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        chunksRef.current = [];

        setRecordingState("transcribing");

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, `recording.${mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm"}`);

          const res = await fetch(`/audit/${auditId}/transcribe-audio`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Transcription failed");
          }

          if (data.audioUrl) setAudioUrl(data.audioUrl);
          if (data.transcript) {
            setFeedback(data.transcript);
            // Re-focus textarea so user can edit
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                // Auto-resize after setting value
                inputRef.current.style.height = "auto";
                inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
              }
            });
          } else if (data.error) {
            setMicError(data.error);
          }
        } catch (err) {
          setMicError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setRecordingState("idle");
          mediaRecorderRef.current = null;
        }
      };

      recorder.start(250); // collect chunks every 250 ms
      setRecordingState("recording");
      startWaveformLoop(stream);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not access microphone";
      setMicError(msg);
      setRecordingState("idle");
    }
  }, [recordingState, auditId]);

  if (!open || !anchorPosition) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = anchorPosition.x + GAP;
  let top = anchorPosition.y - CARD_HEIGHT / 2;

  if (left + CARD_WIDTH > vw - 16) left = anchorPosition.x - CARD_WIDTH - GAP;
  if (top < 16) top = 16;
  if (top + CARD_HEIGHT > vh - 16) top = vh - CARD_HEIGHT - 16;

  const isRecording = recordingState === "recording";
  const isTranscribing = recordingState === "transcribing";
  const isBusy = isRecording || isTranscribing;

  return (
    <>
      {/* Pin dot */}
      <div
        style={{
          position: "fixed",
          left: anchorPosition.x,
          top: anchorPosition.y,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--color-floop-blue, #3A3CFF)",
          border: "2px solid #fff",
          transform: "translate(-50%, -50%)",
          zIndex: 2147483645,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          animation: "pin-drop 0.25s ease-out",
          pointerEvents: "none",
        }}
      />

      {/* Comment card */}
      <div
        ref={cardRef}
        style={{
          position: "fixed",
          left,
          top,
          width: CARD_WIDTH,
          zIndex: 2147483646,
          animation: "comment-pop 0.2s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Input row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              padding: "8px 8px 8px 14px",
            }}
          >
            {/* Waveform shown while recording, textarea shown otherwise */}
            {isRecording ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 0",
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                  <span
                    key={i}
                    ref={(el) => { waveformBarsRef.current[i] = el; }}
                    style={{
                      display: "inline-block",
                      width: 3,
                      height: 4,
                      borderRadius: 2,
                      background: "#788BE6",
                      opacity: 0.25,
                      willChange: "height, opacity",
                    }}
                  />
                ))}
              </div>
            ) : (
              <textarea
                ref={inputRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isTranscribing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={isTranscribing ? "Transcribing…" : "Add a comment…"}
                rows={1}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: 14,
                  lineHeight: "20px",
                  padding: "6px 0",
                  background: "transparent",
                  color: isTranscribing ? "#9ca3af" : "#111",
                  fontFamily: "inherit",
                  minHeight: 32,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
            )}

            {/* Mic / stop / spinner button */}
            <button
              onClick={handleMicClick}
              disabled={isTranscribing}
              title={isRecording ? "Stop recording" : "Record voice comment"}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: isRecording ? "#ef4444" : "#f3f4f6",
                color: isRecording ? "#fff" : "#6b7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isTranscribing ? "default" : "pointer",
                flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
                animation: isRecording ? "mic-pulse 1.2s ease-in-out infinite" : "none",
              }}
            >
              {isTranscribing ? (
                <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
              ) : isRecording ? (
                <Square size={12} fill="currentColor" />
              ) : (
                <Mic size={14} />
              )}
            </button>

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={!feedback.trim() || isBusy}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: feedback.trim() && !isBusy ? "var(--color-floop-blue, #3A3CFF)" : "#e5e7eb",
                color: feedback.trim() && !isBusy ? "#fff" : "#9ca3af",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: feedback.trim() && !isBusy ? "pointer" : "default",
                transition: "background 0.15s, color 0.15s",
                flexShrink: 0,
              }}
            >
              <Send size={14} />
            </button>
          </div>

          {/* Error message */}
          {micError && (
            <div
              style={{
                fontSize: 11,
                color: "#ef4444",
                padding: "0 14px 8px",
                lineHeight: 1.4,
              }}
            >
              {micError}
            </div>
          )}

          {/* Audio attached badge */}
          {audioUrl && !isTranscribing && (
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                padding: "0 14px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Mic size={10} />
              Voice recording attached
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pin-drop {
          from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes comment-pop {
          from { transform: scale(0.9) translateY(4px); opacity: 0; }
          to   { transform: scale(1) translateY(0);     opacity: 1; }
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
