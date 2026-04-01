"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Send, Square, Loader2 } from "lucide-react";

type RecordingState = "idle" | "recording" | "transcribing";

export interface PinReplyComposerProps {
  auditId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** e.g. missing pin id */
  disabled?: boolean;
  /** Parent is posting reply */
  submitting?: boolean;
  placeholder?: string;
}

/**
 * Single-row reply field with voice-to-text (same flow as InlineCommentInput).
 */
export function PinReplyComposer({
  auditId,
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitting = false,
  placeholder = "Write a reply…",
}: PinReplyComposerProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [micError, setMicError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveformBarsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  function stopWaveformLoop() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    waveformBarsRef.current.forEach((bar) => {
      if (bar) {
        bar.style.height = "4px";
        bar.style.opacity = "0.25";
      }
    });
  }

  function stopStream() {
    stopWaveformLoop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
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
      analyser.fftSize = 64;
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
          const bin = Math.floor((i / NUM_BARS) * dataArray.length * 0.6);
          const v = dataArray[bin] / 255;
          const height = 4 + v * 18;
          bar.style.height = `${height}px`;
          bar.style.opacity = v < 0.05 ? "0.2" : String(0.4 + v * 0.6);
        });
        animFrameRef.current = requestAnimationFrame(draw);
      }
      draw();
    } catch {
      /* ignore */
    }
  }

  const handleMicClick = useCallback(async () => {
    setMicError(null);

    if (recordingState === "recording") {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (recordingState !== "idle") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported(t)
        ) ?? "";

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
          formData.append(
            "audio",
            audioBlob,
            `recording.${mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm"}`
          );

          const res = await fetch(`/audit/${auditId}/transcribe-audio`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || "Transcription failed");
          }

          if (data.transcript) {
            onChange(data.transcript);
            requestAnimationFrame(() => inputRef.current?.focus());
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

      recorder.start(250);
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
  }, [recordingState, auditId, onChange]);

  const isRecording = recordingState === "recording";
  const isTranscribing = recordingState === "transcribing";
  const isBusy = isRecording || isTranscribing;
  const blocked = disabled || submitting;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {isRecording ? (
          <div className="flex min-h-9 min-w-0 flex-1 items-center gap-0.5 px-1 py-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <span
                key={i}
                ref={(el) => {
                  waveformBarsRef.current[i] = el;
                }}
                className="inline-block w-[3px] rounded-sm bg-[#788BE6] will-change-[height,opacity]"
                style={{ height: 4, opacity: 0.25 }}
              />
            ))}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={blocked || isTranscribing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !blocked && !isBusy) onSubmit();
              }
            }}
            placeholder={isTranscribing ? "Transcribing…" : placeholder}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border/50 bg-muted/40 px-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-[#3A3CFF]/50 focus:outline-none disabled:text-muted-foreground"
          />
        )}

        <button
          type="button"
          onClick={handleMicClick}
          disabled={blocked || isTranscribing}
          title={isRecording ? "Stop recording" : "Record voice reply"}
          style={isRecording ? { animation: "pin-reply-mic-pulse 1.2s ease-in-out infinite" } : undefined}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 transition-colors ${
            isRecording ? "bg-red-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
          } disabled:cursor-default disabled:opacity-50`}
        >
          {isTranscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-3 w-3 fill-current" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50 ${
            value.trim() && !blocked && !isBusy ? "bg-[#3A3CFF]" : "bg-[#3A3CFF]/60"
          }`}
          disabled={!value.trim() || blocked || isBusy}
          onClick={onSubmit}
          title="Send reply"
        >
          <Send className="h-4 w-4 ml-[-2px]" />
        </button>
      </div>
      {micError && <p className="text-[11px] text-red-600">{micError}</p>}
      <style>{`
        @keyframes pin-reply-mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
