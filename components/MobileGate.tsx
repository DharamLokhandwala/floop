"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { FlowFieldBackground } from "@/components/FlowFieldBackground";

const DESKTOP_BREAKPOINT = 1024;
const LANDING_PATHS = ["/"];

export function MobileGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < DESKTOP_BREAKPOINT);
    check();
    setMounted(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted) return <>{children}</>;

  const isLandingPage = LANDING_PATHS.includes(pathname);

  if (isMobile && !isLandingPage) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden" style={{ backgroundColor: "#F8F9FF" }}>

        <FlowFieldBackground
          dashColor="#E3E5FF"
          dashThickness={0.6}
          meshGradient={[
            "radial-gradient(ellipse 80% 70% at 10% 10%, #3a3cff55 0%, transparent 60%)",
            "radial-gradient(ellipse 70% 60% at 90% 5%,  #a78bfa66 0%, transparent 55%)",
            "radial-gradient(ellipse 90% 70% at 55% 95%, #6366f155 0%, transparent 60%)",
            "radial-gradient(ellipse 65% 55% at 0%  80%,  #818cf855 0%, transparent 50%)",
            "radial-gradient(ellipse 55% 45% at 95% 60%, #4f46e544 0%, transparent 45%)",
          ]}
          noiseOpacity={0.3}
        />

        {/* Card — updated to match reference image */}
        <div className="relative z-10 w-full max-w-[460px] bg-white rounded-[48px] px-10 py-16 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] border border-neutral-100 flex flex-col items-center text-center gap-10">
          
          {/* Graphic Area */}
          <div className="flex items-center justify-center">
            <img
              src="/floop-no.svg"
              alt=""
              className="w-[160px] h-[160px] md:w-[180px] md:h-[180px] object-contain"
            />
          </div>

          {/* Text Area */}
          <div className="flex flex-col gap-4">
            <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight text-neutral-900">
              You need a bigger device
            </h1>
            <p className="text-[16px] md:text-[17px] leading-relaxed text-neutral-500 max-w-[340px]">
              We want you to enjoy floop to its fullest capacity and recommend you to hop on to bigger device like laptop or desktop
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
