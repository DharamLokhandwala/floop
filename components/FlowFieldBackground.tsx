"use client";

// ─── FlowField colors ────────────────────────────────────────────────────────
// Reused across the platform — update both here if the palette changes.
export const FLOW_FIELD_BG   = "#F9FAFB"; // page / container background
export const FLOW_FIELD_DASH = "#E5EAF8"; // animated dash strokes
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

/**
 * Animated flow-field background: a 25×35 grid of short dashes that rotate
 * from \ (top) through horizontal (middle) to / (bottom), driven by two
 * slow travelling sine waves (~18 s cycle).
 *
 * Usage:
 *   <div className="relative">
 *     <FlowFieldBackground
 *       backgroundColor={FLOW_FIELD_BG}
 *       dashColor={FLOW_FIELD_DASH}
 *       dashThickness={1.2}
 *       dashMinLength={4}
 *       dashMaxLength={16}
 *       meshGradient={[
 *         "radial-gradient(ellipse 80% 70% at 10% 10%, #3a3cff55 0%, transparent 60%)",
 *         "radial-gradient(ellipse 70% 60% at 90% 5%,  #a78bfa66 0%, transparent 55%)",
 *       ]}
 *       noiseOpacity={0.09}
 *     />
 *     <div className="relative z-10">…content…</div>
 *   </div>
 *
 * Optional: pass `backgroundColor` to paint the canvas (otherwise transparent;
 * you can still set the parent's `backgroundColor` as before).
 *
 * Optional: pass `meshGradient` (array of CSS radial-gradient strings) to render
 * a mesh gradient layer behind the dashes.
 *
 * Optional: pass `noiseOpacity` (0–1) to add an SVG fractal-noise grain overlay.
 * Set to 0 (default) to disable.
 */
export type FlowFieldBackgroundProps = {
  /** Solid fill behind the dashes. Omit for a transparent canvas. */
  backgroundColor?: string;
  /** Stroke color for dashes. Defaults to platform `FLOW_FIELD_DASH`. */
  dashColor?: string;
  /**
   * Line-width multiplier vs the default curve (roughly `max(0.8, scale * 0.9)` px).
   * `1` matches the original look.
   */
  dashThickness?: number;
  /**
   * Shortest dash length coefficient: `minLen = (W/400) * dashMinLength`.
   * Default `3.5` matches the original.
   */
  dashMinLength?: number;
  /**
   * Longest dash length coefficient: `maxLen = (W/400) * dashMaxLength`.
   * Default `13` matches the original. Must be ≥ `dashMinLength`.
   */
  dashMaxLength?: number;
  /**
   * Array of CSS radial-gradient strings stacked as a mesh gradient layer
   * rendered behind the dashes. The last string (or `backgroundColor`) acts
   * as the solid base. Example:
   *   ["radial-gradient(ellipse 80% 70% at 10% 10%, #3a3cff55 0%, transparent 60%)"]
   */
  meshGradient?: string[];
  /**
   * Opacity of the SVG fractal-noise grain overlay (0–1).
   * `0` (default) disables the layer entirely.
   */
  noiseOpacity?: number;
  /**
   * Base frequency for the SVG fractal-noise texture (0–1).
   * Higher = finer grain. Default `0.72`.
   */
  noiseFrequency?: number;
};

export function FlowFieldBackground({
  backgroundColor,
  dashColor = FLOW_FIELD_DASH,
  dashThickness = 0.75,
  dashMinLength = 2.5,
  dashMaxLength = 10,
  meshGradient,
  noiseOpacity = 0,
  noiseFrequency = 0.72,
}: FlowFieldBackgroundProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COLS = 30;
    const ROWS = 18;
    let time = 0;
    let animId: number;

    const minCoeff = Math.min(dashMinLength, dashMaxLength);
    const maxCoeff = Math.max(dashMinLength, dashMaxLength);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, W, H);
      }

      const cellW = W / COLS;
      const cellH = H / ROWS;
      const scale = W / 400;
      const maxLen = scale * maxCoeff;
      const minLen = scale * minCoeff;

      ctx.strokeStyle = dashColor;
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(0.25, scale * 0.9 * dashThickness);
      ctx.lineCap = "round";

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = (c + 0.5) * cellW;
          const cy = (r + 0.5) * cellH;
          const nx = c / (COLS - 1);
          const ny = r / (ROWS - 1);

          // Base flow field: \ at top → horizontal middle → / at bottom
          const base = (0.5 - ny) + (nx - 0.5) * 0.12;

          // Two slow travelling waves for organic feel
          const wave =
            Math.sin(time * 0.9 + nx * Math.PI * 3.5 + ny * Math.PI * 1.5) * 0.10 +
            Math.sin(time * 0.55 + nx * Math.PI * 1.2 - ny * Math.PI * 2.8) * 0.05;

          const tVal = base + wave;
          const angle = tVal * Math.PI * 0.72;
          const len = minLen + (maxLen - minLen) * Math.min(Math.abs(tVal) * 2.2, 1);

          const dx = Math.cos(angle) * len / 2;
          const dy = Math.sin(angle) * len / 2;

          ctx.beginPath();
          ctx.moveTo(cx - dx, cy - dy);
          ctx.lineTo(cx + dx, cy + dy);
          ctx.stroke();
        }
      }

      // ~18 s per full wave cycle  (2π / (18 × 60fps) ≈ 0.00582)
      time += 0.0090;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [backgroundColor, dashColor, dashThickness, dashMinLength, dashMaxLength]);

  const shared: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  const hasMesh = meshGradient && meshGradient.length > 0;
  const hasNoise = noiseOpacity > 0;

  // If no extra layers, return just the canvas (preserves original behaviour)
  if (!hasMesh && !hasNoise) {
    return <canvas ref={canvasRef} style={{ ...shared, display: "block" }} />;
  }

  return (
    <div style={{ ...shared, overflow: "hidden" }}>
      {/* Mesh gradient — sits behind the canvas */}
      {hasMesh && (
        <div
          style={{
            ...shared,
            background: [
              ...(meshGradient as string[]),
              ...(backgroundColor ? [backgroundColor] : []),
            ].join(", "),
          }}
        />
      )}

      {/* Flow-field canvas */}
      <canvas ref={canvasRef} style={{ ...shared, display: "block" }} />

      {/* Noise grain overlay — sits on top of the canvas */}
      {hasNoise && (
        <div
          style={{
            ...shared,
            opacity: noiseOpacity,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${noiseFrequency}' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "200px 200px",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
