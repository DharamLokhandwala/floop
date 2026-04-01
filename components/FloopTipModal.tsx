"use client";

import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FlowFieldBackground, FLOW_FIELD_DASH } from "@/components/FlowFieldBackground";

interface FloopTipModalProps {
  open: boolean;
  onDismiss: () => void;
  isMac: boolean;
}

export function FloopTipModal({ open, onDismiss, isMac }: FloopTipModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onDismiss();
      }}
    >
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-[420px] rounded-[20px] border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] bg-white"
        showCloseButton={false}
      >
        {/* Top Graphic Area */}
        <div className="relative w-full h-[280px] bg-white flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 70%)",
            }}
          >
            <FlowFieldBackground
              backgroundColor="#ffffff"
              dashColor={FLOW_FIELD_DASH}
              dashThickness={1.2}
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[180px] h-[180px] bg-[#3a3cff]/15 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex items-center justify-center">
            <img
              src="/ctrl-point-icons.svg"
              alt="Hold Ctrl and click on the page to add a pin"
              className="w-[200px] h-[200px] object-contain drop-shadow-sm"
            />
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-white to-transparent z-10" />
        </div>

        <div className="relative z-20 flex flex-col gap-3 px-8 pb-8 pt-0 bg-white">
          <DialogHeader className="space-y-2.5 text-left">
            <DialogTitle className="text-[22px] font-semibold tracking-tight text-zinc-900">
              How to add feedback
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-[15px] leading-relaxed text-zinc-500">
                Hold{" "}
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-zinc-100 px-2 font-mono text-sm font-medium text-zinc-900 border border-zinc-200 mx-1">
                  {isMac ? "⌘" : "Ctrl"}
                </kbd>{" "}
                and{" "}
                <span className="relative inline-flex items-center justify-center w-6 h-6 mx-1 align-middle">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#3a3cff]/30 animate-ping duration-[1.5s]"></span>
                  <MousePointerClick className="relative h-[18px] w-[18px] text-[#3a3cff]" />
                </span>
                {" "}on the live site to drop a pin and write your comment. Release the key to browse normally.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start mt-3 p-0">
            <Button
              type="button"
              className="bg-[#3a3cff] hover:bg-[#1E20DC] text-white rounded-lg px-6 py-5 text-[15px] font-medium transition-all shadow-md shadow-[#7c3aed]/20 border-none"
              onClick={onDismiss}
            >
              Start flooping
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
