"use client";

import { useEffect, useRef } from "react";

/**
 * Grain/noise texture overlay — renders a static or animated canvas of
 * monochromatic noise pixels on top of whatever is behind it.
 *
 * Usage (static grain overlay):
 *   <div className="relative">
 *     <div className="relative z-10">…content…</div>
 *     <NoiseTexture opacity={0.04} />
 *   </div>
 *
 * Usage (animated, colored):
 *   <NoiseTexture opacity={0.06} animated color="#8b5cf6" />
 */
export type NoiseTextureProps = {
  /**
   * Overall opacity of the noise layer. 0–1.
   * Keep this low (0.02–0.08) for a subtle film-grain feel.
   * Default: 0.04
   */
  opacity?: number;
  /**
   * Side length of each noise "pixel" in CSS pixels.
   * 1 = true pixel noise; 2–4 = coarser grain.
   * Default: 1
   */
  grain?: number;
  /**
   * Tint color applied to each noise pixel (CSS color string).
   * Default: "#000000" (neutral grey noise)
   */
  color?: string;
  /**
   * When true, regenerates the noise pattern every frame (~60fps).
   * Gives a film-grain shimmer effect. Has a small GPU cost.
   * Default: false (static — noise is drawn once)
   */
  animated?: boolean;
};

export function NoiseTexture({
  opacity = 0.04,
  grain = 1,
  color = "#000000",
  animated = false,
}: NoiseTextureProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    // Parse the tint color into r,g,b components
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = 1;
    const tc = tmp.getContext("2d")!;
    tc.fillStyle = color;
    tc.fillRect(0, 0, 1, 1);
    const [cr, cg, cb] = tc.getImageData(0, 0, 1, 1).data;

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      const pw = Math.ceil(W * dpr);
      const ph = Math.ceil(H * dpr);

      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const g = Math.max(1, Math.round(grain * dpr));
      const cols = Math.ceil(pw / g);
      const rows = Math.ceil(ph / g);
      const imageData = ctx.createImageData(pw, ph);
      const data = imageData.data;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const brightness = Math.random();
          const alpha = Math.round(brightness * 255);
          // Fill the grain block
          for (let dy = 0; dy < g && row * g + dy < ph; dy++) {
            for (let dx = 0; dx < g && col * g + dx < pw; dx++) {
              const idx = ((row * g + dy) * pw + (col * g + dx)) * 4;
              data[idx]     = cr;
              data[idx + 1] = cg;
              data[idx + 2] = cb;
              data[idx + 3] = alpha;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      if (animated) animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [opacity, grain, color, animated]);

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
        mixBlendMode: "multiply",
      }}
    />
  );
}
