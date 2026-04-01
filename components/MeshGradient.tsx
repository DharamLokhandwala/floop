"use client";

import { useEffect, useRef } from "react";

/**
 * Animated mesh-gradient background — several large radial-gradient "blobs"
 * that drift slowly around the canvas, blending together into an organic,
 * aurora-like wash of color.
 *
 * Usage:
 *   <div className="relative overflow-hidden">
 *     <MeshGradient
 *       colors={["#818cf8", "#c084fc", "#fb7185", "#34d399"]}
 *       speed={0.4}
 *       blur={120}
 *     />
 *     <div className="relative z-10">…content…</div>
 *   </div>
 *
 * Tips:
 *  - Wrap in a `relative overflow-hidden` container.
 *  - For a subtle tinted background, lower `opacity` and `blur`.
 *  - For a vivid aurora, increase `blur` and use saturated colors.
 */
export type MeshGradientProps = {
  /**
   * Array of CSS color strings for each blob.
   * 3–6 colors works best. More colors = richer mesh.
   * Default: indigo / violet / rose / teal (floop palette)
   */
  colors?: string[];
  /**
   * Overall opacity of the gradient layer (0–1).
   * Default: 1
   */
  opacity?: number;
  /**
   * CSS blur radius applied to each blob (px).
   * Higher values = softer, more diffuse blobs.
   * Default: 120
   */
  blur?: number;
  /**
   * Drift speed multiplier. 1 = default (~30 s full cycle). 0 = static.
   * Default: 1
   */
  speed?: number;
  /**
   * Background color painted under the blobs.
   * Default: "transparent"
   */
  backgroundColor?: string;
};

type Blob = {
  /** 0–1 fractional position */
  x: number;
  y: number;
  /** Radius as fraction of min(W,H) */
  r: number;
  color: string;
  /** Phase offsets for lissajous drift */
  phaseX: number;
  phaseY: number;
  /** Frequency multipliers */
  freqX: number;
  freqY: number;
  /** Amplitude of drift as fraction of canvas dimension */
  ampX: number;
  ampY: number;
};

// Matches the FlowFieldBackground palette: soft blue-lavender blobs on a near-white base.
// Import FLOW_FIELD_BG / FLOW_FIELD_DASH from FlowFieldBackground if you want
// to keep a single source of truth, or pass custom colors as props.
const DEFAULT_COLORS = [
  "#E5EAF8", // FlowField dash — soft blue-lavender (primary blob)
  "#EEF0FB", // slightly lighter tint
  "#D8DFFA", // a touch more saturated
  "#EAE8F7", // muted periwinkle
];

export function MeshGradient({
  colors = DEFAULT_COLORS,
  opacity = 1,
  blur = 160,
  speed = 0.5,
  backgroundColor = "#F9FAFB",
}: MeshGradientProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    let animId: number;

    // Seed blobs deterministically so they don't jump on re-render
    const blobs: Blob[] = colors.map((color, i) => {
      const t = i / colors.length;
      return {
        x: 0.15 + t * 0.7,
        y: 0.15 + ((i * 0.37) % 0.7),
        r: 0.45 + (i % 3) * 0.1,
        color,
        phaseX: (i * 1.3) % (Math.PI * 2),
        phaseY: (i * 2.1) % (Math.PI * 2),
        freqX: 0.31 + (i % 4) * 0.09,
        freqY: 0.27 + (i % 3) * 0.11,
        ampX: 0.18 + (i % 2) * 0.08,
        ampY: 0.15 + (i % 3) * 0.07,
      };
    });

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      const pw = Math.round(W * dpr);
      const ph = Math.round(H * dpr);

      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background fill
      if (backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.clearRect(0, 0, W, H);
      }

      const minDim = Math.min(W, H);

      ctx.save();
      // Apply blur via filter (GPU-accelerated in most browsers)
      ctx.filter = `blur(${blur}px)`;

      for (const blob of blobs) {
        // Lissajous drift around the anchor point
        const cx = (blob.x + Math.sin(time * blob.freqX + blob.phaseX) * blob.ampX) * W;
        const cy = (blob.y + Math.cos(time * blob.freqY + blob.phaseY) * blob.ampY) * H;
        const radius = blob.r * minDim;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, blob.color);
        grad.addColorStop(1, "transparent");

        ctx.globalAlpha = 0.9;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // ~30 s per cycle at speed=1: Δt = 2π / (30 × 60) ≈ 0.00349
      time += 0.00349 * speed;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [colors, blur, speed, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
