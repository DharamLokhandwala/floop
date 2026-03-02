"use client";

import { useState, useRef, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddPinModal } from "@/components/AddPinModal";
import type { Pin } from "@/types/audit";
import { Pin as PinIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  SEO: "bg-blue-500",
  "Visual Design": "bg-purple-500",
  CRO: "bg-green-500",
  Feedback: "bg-zinc-500",
};

interface AuditViewerProps {
  screenshotUrl: string;
  pins: Pin[];
  userPins?: Pin[];
  auditId: string;
  onPinAdded?: (pin: Pin) => void;
  selectedPinIndex?: number | null;
}

export function AuditViewer({
  screenshotUrl,
  pins,
  userPins = [],
  auditId,
  onPinAdded,
  selectedPinIndex = null,
}: AuditViewerProps) {
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<(HTMLDivElement | null)[]>([]);

  type PinWithMeta = Pin & { isUserPin: boolean; index: number };
  
  const allPins: PinWithMeta[] = [
    ...pins.map((pin, i) => ({ ...pin, isUserPin: false, index: i })),
    ...userPins.map((pin, i) => ({ ...pin, isUserPin: true, index: pins.length + i })),
  ];

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    // Position as percentage of image (0–100) so it matches the pin overlay, which is image-sized
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Ensure coordinates are within bounds
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setClickPosition({ x: clampedX, y: clampedY });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (selectedPinIndex == null || selectedPinIndex < 0 || selectedPinIndex >= allPins.length) return;
    const el = pinRefs.current[selectedPinIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [selectedPinIndex, allPins.length]);

  const handleSavePin = async (pin: Pin) => {
    try {
      const response = await fetch(`/audit/${auditId}/add-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pin),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to save pin (${response.status})`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to save pin");
      }

      if (onPinAdded) {
        onPinAdded(pin);
      }
      
      // Refresh the page to show the new pin
      window.location.reload();
    } catch (error) {
      console.error("Error saving pin:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save pin. Please try again.";
      alert(errorMessage);
    }
  };

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click on the screenshot to add your own pin
        </p>
      </div>
      
      <div
        ref={containerRef}
        className="w-full flex-1 min-h-0 overflow-auto rounded-lg border border-border shadow-lg bg-muted/20"
      >
        {/* Wrapper sizes to the image so the pin overlay matches image dimensions (fixes pin offset when image is scrollable) */}
        <div className="relative inline-block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={screenshotUrl}
            alt="Website screenshot"
            className="w-full h-auto block cursor-crosshair"
            onClick={handleImageClick}
          />
          <div className="absolute inset-0 pointer-events-none">
          {allPins.map((pin) => (
            <div
              key={`${pin.isUserPin ? "user" : "ai"}-${pin.index}`}
              ref={(el) => {
                pinRefs.current[pin.index] = el;
              }}
              className="absolute pointer-events-auto"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-white shadow-md hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      CATEGORY_COLORS[pin.category ?? "Feedback"],
                      pin.isUserPin && "ring-2 ring-yellow-400 ring-offset-2",
                      selectedPinIndex === pin.index && "ring-4 ring-primary ring-offset-2 animate-pulse"
                    )}
                    aria-label={`Pin: ${pin.category ?? "Feedback"}`}
                  >
                    <PinIcon className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-xs p-3"
                >
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {pin.category ?? "Feedback"} {pin.isUserPin && "(Your Pin)"}
                  </p>
                  <p className="text-sm">{pin.feedback}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
          </div>
        </div>
      </div>

      <AddPinModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={handleSavePin}
        position={clickPosition}
      />
    </div>
  );
}
