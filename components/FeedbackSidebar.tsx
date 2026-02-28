"use client";

import { Bell, RotateCcw, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Pin } from "@/types/audit";
import { cn } from "@/lib/utils";

type PinWithIndex = Pin & { index: number; isUserPin: boolean };

interface FeedbackSidebarProps {
  goal: string;
  pins: Pin[];
  userPins: Pin[];
  selectedPinIndex: number | null;
  onSelectPin: (index: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  createdAt: Date;
}

function buildAllPins(pins: Pin[], userPins: Pin[]): PinWithIndex[] {
  return [
    ...pins.map((pin, i) => ({ ...pin, index: i, isUserPin: false })),
    ...userPins.map((pin, i) => ({ ...pin, index: pins.length + i, isUserPin: true })),
  ];
}

export function FeedbackSidebar({
  goal,
  pins,
  userPins,
  selectedPinIndex,
  onSelectPin,
  collapsed,
  onToggleCollapse,
  createdAt,
}: FeedbackSidebarProps) {
  const allPins = buildAllPins(pins, userPins);
  const createdDate = new Date(createdAt);
  const isToday =
    createdDate.toDateString() === new Date().toDateString();

  return (
    <aside
      className={cn(
        "flex flex-col border-border bg-muted/30 transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-12 shrink-0" : "w-full lg:w-[320px] lg:min-w-[320px] max-h-[45vh] lg:max-h-none"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-10 shrink-0 border-b border-border bg-background hover:bg-muted/50"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
        ) : (
          <PanelRightClose className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Activity - commented out for now
          <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Activity
              </span>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-sm text-muted-foreground border-l-1 border-muted-foreground/40 pl-3">
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {isToday ? "TODAY" : createdDate.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}
                </span>
                <p className="mt-0.5">You created this feedback</p>
              </div>
              {allPins.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    {isToday ? "TODAY" : "—"}
                  </span>
                  <p className="mt-0.5">
                    {allPins.length} comment{allPins.length !== 1 ? "s" : ""} added
                  </p>
                </div>
              )}
            </div>
          </section>
          */}

          {/* Goal */}
          <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Goal
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed">{goal}</p>
          </section>

          {/* Feedback */}
          <section className="rounded-xl border border-border bg-background p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Feedback
              </span>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              {allPins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No feedback yet. Switch to Comment mode and click on the page to add a pin.</p>
              ) : (
                allPins.map((pin) => (
                  <button
                    key={pin.index}
                    type="button"
                    onClick={() => onSelectPin(pin.index)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      selectedPinIndex === pin.index
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/30 hover:bg-accent"
                    )}
                  >
                    {pin.pageUrl && (() => {
                      try {
                        const path = new URL(pin.pageUrl).pathname || "/";
                        return (
                          <p className="text-xs text-muted-foreground truncate mb-1">
                            {path === "/" ? "/index" : path}
                          </p>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                    {!pin.pageUrl && (
                      <p className="text-xs text-muted-foreground truncate mb-1">/index</p>
                    )}
                    <p className="text-sm text-foreground line-clamp-2">{pin.feedback}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
