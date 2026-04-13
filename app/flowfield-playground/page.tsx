"use client";

import { useMemo, useState } from "react";
import { FlowFieldBackground } from "@/components/FlowFieldBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

type MeshBlob = {
  color: string;
  alpha: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stop: number;
};

type PlaygroundState = {
  backgroundColor: string;
  backgroundOpacity: number;
  dashColor: string;
  dashThickness: number;
  dashMinLength: number;
  dashMaxLength: number;
  timeScale: number;
  meshEnabled: boolean;
  noiseEnabled: boolean;
  noiseOpacity: number;
  noiseFrequency: number;
  blobs: MeshBlob[];
};

const INITIAL_STATE: PlaygroundState = {
  backgroundColor: "#f7f1e8",
  backgroundOpacity: 1,
  dashColor: "#2b2b2b",
  dashThickness: 0.9,
  dashMinLength: 2.5,
  dashMaxLength: 10,
  timeScale: 1,
  meshEnabled: true,
  noiseEnabled: true,
  noiseOpacity: 0.2,
  noiseFrequency: 0.72,
  blobs: [
    { color: "#1f2937", alpha: 0.35, x: 20, y: 22, width: 80, height: 72, stop: 60 },
    { color: "#111827", alpha: 0.28, x: 84, y: 18, width: 70, height: 62, stop: 58 },
    { color: "#374151", alpha: 0.32, x: 68, y: 78, width: 90, height: 70, stop: 62 },
  ],
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createBlob(index: number): MeshBlob {
  const palette = ["#1f2937", "#334155", "#4b5563", "#1e3a8a", "#3f3f46"];
  return {
    color: palette[index % palette.length],
    alpha: 0.3,
    x: (18 + index * 19) % 100,
    y: (26 + index * 23) % 100,
    width: 78,
    height: 68,
    stop: 60,
  };
}

function NumberRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  showDots = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  showDots?: boolean;
}) {
  const safeValue = Number.isFinite(value) ? value : min;
  const decimals = step < 1 ? 2 : 0;
  const percentage = clamp(((safeValue - min) / (max - min)) * 100, 0, 100);

  return (
    <div className="relative h-11 w-full overflow-hidden rounded-[14px] bg-[#27272a]">
      {/* Fill bar */}
      <div 
        className="absolute bottom-0 left-0 top-0 bg-[#3f3f46] transition-all duration-75" 
        style={{ width: `${percentage}%` }}
      >
        {/* Thumb line */}
        <div className="absolute right-[6px] top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full bg-zinc-400" />
      </div>

      {/* Dots overlay for specific sliders */}
      {showDots && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[25%] opacity-40">
          <div className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
          <div className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
          <div className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
          <div className="h-[3px] w-[3px] rounded-full bg-zinc-500" />
        </div>
      )}

      {/* Content */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
        <span className="text-[15px] font-medium text-zinc-400">{label}</span>
        <span className="text-[15px] font-medium text-zinc-200">{safeValue.toFixed(decimals)}</span>
      </div>

      {/* Invisible Input overlay */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="relative flex h-11 w-full items-center justify-between overflow-hidden rounded-[14px] bg-[#27272a] px-4">
      <span className="text-[15px] font-medium text-zinc-400">{label}</span>
      <div className="flex items-center gap-3">
        <input 
          type="text" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 bg-transparent text-right text-[14px] font-mono text-zinc-400 outline-none focus:text-zinc-200"
        />
        <div className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]" style={{ backgroundColor: value }}>
          <div className="absolute inset-0 rounded-full border border-white/10 z-10 pointer-events-none" />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 scheme-dark"
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) {
  return (
    <div className="relative flex h-11 w-full items-center justify-between overflow-hidden rounded-[14px] bg-[#27272a] px-4">
      <span className="text-[15px] font-medium text-zinc-400">{label}</span>
      <button 
        className={`relative h-6 w-11 rounded-full p-1 transition-colors ${checked ? 'bg-zinc-500' : 'bg-[#3f3f46]'}`}
        onClick={() => onChange(!checked)}
      >
        <div 
          className={`h-4 w-4 rounded-full bg-zinc-100 transition-all shadow-sm ${checked ? 'translate-x-5' : 'translate-x-0'}`} 
        />
      </button>
    </div>
  );
}

function buildFlowfieldSvg(state: PlaygroundState): string {
  const W = 1600;
  const H = 900;
  const COLS = 30;
  const ROWS = 18;
  const cellW = W / COLS;
  const cellH = H / ROWS;
  const scale = W / 400;
  const minCoeff = Math.min(state.dashMinLength, state.dashMaxLength);
  const maxCoeff = Math.max(state.dashMinLength, state.dashMaxLength);
  const maxLen = scale * maxCoeff;
  const minLen = scale * minCoeff;
  const strokeWidth = Math.max(0.25, scale * 0.9 * state.dashThickness);
  const time = 0;

  const meshDefs = state.meshEnabled
    ? state.blobs.map((blob, index) => {
      const centerX = ((blob.x / 100) * W).toFixed(2);
      const centerY = ((blob.y / 100) * H).toFixed(2);
      const radius = ((Math.max(blob.width, blob.height) / 100) * Math.max(W, H) * 0.6).toFixed(2);
      const stopOffset = `${clamp(blob.stop, 0, 100)}%`;
      const rgb = hexToRgb(blob.color);
      return `
      <radialGradient id="mesh-${index}" cx="${centerX}" cy="${centerY}" r="${radius}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="${blob.alpha.toFixed(3)}" />
        <stop offset="${stopOffset}" stop-color="rgb(${rgb.r},${rgb.g},${rgb.b})" stop-opacity="0" />
      </radialGradient>`;
    }).join("")
    : "";

  const meshRects = state.meshEnabled
    ? state.blobs.map((_, index) => `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#mesh-${index})" />`).join("")
    : "";

  const lines: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;
      const nx = c / (COLS - 1);
      const ny = r / (ROWS - 1);
      const base = (0.5 - ny) + (nx - 0.5) * 0.12;
      const wave =
        Math.sin(time * 0.9 + nx * Math.PI * 3.5 + ny * Math.PI * 1.5) * 0.10 +
        Math.sin(time * 0.55 + nx * Math.PI * 1.2 - ny * Math.PI * 2.8) * 0.05;
      const tVal = base + wave;
      const angle = tVal * Math.PI * 2;
      const len = minLen + (maxLen - minLen) * Math.min(Math.abs(tVal) * 2.2, 1);
      const dx = Math.cos(angle) * len / 2;
      const dy = Math.sin(angle) * len / 2;
      lines.push(
        `<line x1="${(cx - dx).toFixed(2)}" y1="${(cy - dy).toFixed(2)}" x2="${(cx + dx).toFixed(2)}" y2="${(cy + dy).toFixed(2)}" />`,
      );
    }
  }

  const noiseLayer = state.noiseEnabled
    ? `<rect x="0" y="0" width="${W}" height="${H}" filter="url(#noise)" opacity="${state.noiseOpacity.toFixed(3)}" />`
    : "";

  const backgroundFill = hexToRgba(state.backgroundColor, state.backgroundOpacity);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${meshDefs}
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="${state.noiseFrequency}" numOctaves="4" stitchTiles="stitch" />
    </filter>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${backgroundFill}" />
  ${meshRects}
  <g fill="none" stroke="${state.dashColor}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round">
    ${lines.join("")}
  </g>
  ${noiseLayer}
</svg>`;
}

export default function FlowfieldPlaygroundPage() {
  const [state, setState] = useState<PlaygroundState>(INITIAL_STATE);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const timeScale = Number.isFinite(state.timeScale) ? state.timeScale : 1;
  const backgroundOpacity = Number.isFinite(state.backgroundOpacity) ? state.backgroundOpacity : 1;
  const backgroundColorWithOpacity = hexToRgba(state.backgroundColor, backgroundOpacity);

  const meshGradient = useMemo(() => {
    if (!state.meshEnabled) return undefined;

    return state.blobs.map((blob) => (
      `radial-gradient(ellipse ${blob.width}% ${blob.height}% at ${blob.x}% ${blob.y}%, ` +
      `${hexToRgba(blob.color, blob.alpha)} 0%, transparent ${blob.stop}%)`
    ));
  }, [state.blobs, state.meshEnabled]);

  const payload = useMemo(
    () => ({
      backgroundColor: backgroundColorWithOpacity,
      dashColor: state.dashColor,
      dashThickness: state.dashThickness,
      dashMinLength: state.dashMinLength,
      dashMaxLength: state.dashMaxLength,
      timeScale,
      meshGradient: meshGradient ?? [],
      noiseOpacity: state.noiseEnabled ? state.noiseOpacity : 0,
      noiseFrequency: state.noiseFrequency,
    }),
    [backgroundColorWithOpacity, meshGradient, state, timeScale],
  );

  return (
    <main className="h-screen w-full overflow-hidden bg-black text-white">
      <style jsx>{`
        .flow-slider {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          height: 26px;
        }

        .flow-slider:focus {
          outline: none;
        }

        .flow-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 9999px;
          background-color: rgba(228, 228, 231, 0.18);
          background-image: radial-gradient(circle, rgba(228, 228, 231, 0.75) 1px, transparent 1.2px);
          background-size: 18px 8px;
          background-position: center;
          border: 1px solid rgba(228, 228, 231, 0.2);
        }

        .flow-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 4px;
          height: 20px;
          margin-top: -7px;
          border-radius: 9999px;
          background: #a1a1aa;
          box-shadow: 0 0 0 1px rgba(63, 63, 70, 0.5);
        }

        .flow-slider::-moz-range-track {
          height: 8px;
          border-radius: 9999px;
          background-color: rgba(228, 228, 231, 0.18);
          background-image: radial-gradient(circle, rgba(228, 228, 231, 0.75) 1px, transparent 1.2px);
          background-size: 18px 8px;
          background-position: center;
          border: 1px solid rgba(228, 228, 231, 0.2);
        }

        .flow-slider::-moz-range-thumb {
          width: 4px;
          height: 20px;
          border: none;
          border-radius: 9999px;
          background: #a1a1aa;
          box-shadow: 0 0 0 1px rgba(63, 63, 70, 0.5);
        }
      `}</style>
      <div className="flex h-full w-full">
        <section className="relative flex-1 bg-[#f8f4ed]">
          <FlowFieldBackground
            backgroundColor={backgroundColorWithOpacity}
            dashColor={state.dashColor}
            dashThickness={state.dashThickness}
            dashMinLength={state.dashMinLength}
            dashMaxLength={state.dashMaxLength}
            timeScale={timeScale}
            meshGradient={meshGradient}
            noiseOpacity={state.noiseEnabled ? state.noiseOpacity : 0}
            noiseFrequency={state.noiseFrequency}
          />

         

        </section>

        <div className={`relative h-full flex-shrink-0 transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isPanelCollapsed ? "w-0" : "w-[350px]"}`}>
          {/* Liquid toggle button */}
          <button 
             onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
             className="absolute top-1/2 -left-[24px] z-50 -translate-y-1/2 flex h-[72px] w-[24px] items-center justify-center rounded-l-2xl border-y border-l border-zinc-800 bg-[#18181b] text-zinc-500 shadow-[-4px_0_24px_rgba(0,0,0,0.5)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:w-[32px] hover:-left-[32px] hover:text-zinc-200 outline-none"
             aria-label={isPanelCollapsed ? "Open panel" : "Close panel"}
          >
            <ChevronRight className={`h-5 w-5 transition-transform duration-500 ${isPanelCollapsed ? 'rotate-180' : ''}`} />
          </button>
          
          <aside className="absolute left-0 top-0 h-full w-[350px] overflow-y-auto bg-[#18181b] border-l border-zinc-800 p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between w-full">
            <div className="flex gap-2 w-full">
              <Button
                variant="ghost"
                className="flex-1 h-10 border-0 rounded-[12px] bg-[#27272a] text-[13px] font-medium text-zinc-400 transition-colors hover:bg-[#3f3f46] hover:text-zinc-200 px-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)]"
                onClick={() => {
                  const svgString = buildFlowfieldSvg(state);
                  const blob = new Blob([svgString], { type: "image/svg+xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "flowfield-background.svg";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success("SVG Saved");
                }}
              >
                save svg
              </Button>
              <Button
                variant="ghost"
                className="flex-1 h-10 border-0 rounded-[12px] bg-[#27272a] text-[13px] font-medium text-zinc-400 transition-colors hover:bg-[#3f3f46] hover:text-zinc-200 px-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)]"
                onClick={() => {
                  window.navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                  toast.success("Properties copied");
                }}
              >
                copy props
              </Button>
              <Button
                variant="ghost"
                className="flex-1 h-10 border-0 rounded-[12px] bg-[#27272a] text-[13px] font-medium text-zinc-400 transition-colors hover:bg-[#3f3f46] hover:text-zinc-200 px-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)]"
                onClick={() => setState(INITIAL_STATE)}
              >
                reset
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Base
              </p>
              <ColorRow
                label="Background"
                value={state.backgroundColor}
                onChange={(color) => setState((prev) => ({ ...prev, backgroundColor: color }))}
              />
              <NumberRow
                label="Bg Opacity"
                value={backgroundOpacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => setState((prev) => ({ ...prev, backgroundOpacity: value }))}
              />
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 mt-4">
                Dashes
              </p>
              <ColorRow
                label="Color"
                value={state.dashColor}
                onChange={(color) => setState((prev) => ({ ...prev, dashColor: color }))}
              />
              <NumberRow
                label="Thickness"
                value={state.dashThickness}
                min={0.25}
                max={2}
                step={0.05}
                onChange={(dashThickness) => setState((prev) => ({ ...prev, dashThickness }))}
                showDots
              />
              <NumberRow
                label="Min length"
                value={state.dashMinLength}
                min={1}
                max={8}
                step={0.1}
                onChange={(dashMinLength) => setState((prev) => ({ ...prev, dashMinLength }))}
              />
              <NumberRow
                label="Max length"
                value={state.dashMaxLength}
                min={4}
                max={18}
                step={0.1}
                onChange={(dashMaxLength) => setState((prev) => ({ ...prev, dashMaxLength }))}
              />
              <NumberRow
                label="Time speed"
                value={timeScale}
                min={0}
                max={3}
                step={0.05}
                onChange={(timeScale) => setState((prev) => ({ ...prev, timeScale }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2 mt-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Noise
                </p>
              </div>
              <ToggleRow
                label="Enabled"
                checked={state.noiseEnabled}
                onChange={(noiseEnabled) => setState((prev) => ({ ...prev, noiseEnabled }))}
              />
              <NumberRow
                label="Opacity"
                value={state.noiseOpacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(noiseOpacity) => setState((prev) => ({ ...prev, noiseOpacity }))}
              />
              <NumberRow
                label="Frequency"
                value={state.noiseFrequency}
                min={0.05}
                max={1}
                step={0.01}
                onChange={(noiseFrequency) => setState((prev) => ({ ...prev, noiseFrequency }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2 mt-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                  Mesh gradients
                </p>
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                  onClick={() => {
                    setState((prev) => ({
                      ...prev,
                      blobs: [...prev.blobs, createBlob(prev.blobs.length)],
                    }));
                  }}
                >
                  + Add blob
                </button>
              </div>
              <ToggleRow
                label="Enabled"
                checked={state.meshEnabled}
                onChange={(meshEnabled) => setState((prev) => ({ ...prev, meshEnabled }))}
              />

              {state.blobs.map((blob, index) => (
                <div key={`blob-${index}`} className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-medium text-zinc-300">Blob {index + 1}</p>
                  </div>
                  
                  <ColorRow
                    label="Color"
                    value={blob.color}
                    onChange={(color) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, color } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="Opacity"
                    value={blob.alpha}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(alpha) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, alpha } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="X position"
                    value={blob.x}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(x) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, x } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="Y position"
                    value={blob.y}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(y) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, y } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="Width"
                    value={blob.width}
                    min={20}
                    max={120}
                    step={1}
                    onChange={(width) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, width } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="Height"
                    value={blob.height}
                    min={20}
                    max={120}
                    step={1}
                    onChange={(height) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, height } : item
                        )),
                      }));
                    }}
                  />
                  <NumberRow
                    label="Fade stop"
                    value={blob.stop}
                    min={35}
                    max={90}
                    step={1}
                    onChange={(stop) => {
                      setState((prev) => ({
                        ...prev,
                        blobs: prev.blobs.map((item, itemIndex) => (
                          itemIndex === index ? { ...item, stop: clamp(stop, 0, 100) } : item
                        )),
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
