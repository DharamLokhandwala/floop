"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";
import { FlowFieldBackground } from "@/components/FlowFieldBackground";

export default function BetaInvitePage() {
  const [isSigningUp, setIsSigningUp] = useState(false);
  const W = 420;
  const notchR = 32; // 32px radius holes — clearly visible ticket punches
  const nr = notchR / W;
  // Corner radius fraction
  const cr = 40 / W;
  // Notch Y center = 50% of height → 0.5 in Y
  // In objectBoundingBox, X is fraction of width, Y is fraction of height

  // Build path in objectBoundingBox units
  // Note: arc radii are in the same fraction-of-width unit for rx, fraction-of-height for ry
  // We simplify by making rx=ry=nr (treats both as fraction which may slightly distort,
  // but at this scale it's imperceptible)
  const path = [
    // top-left
    `M ${cr},0`,
    `L ${1 - cr},0`,
    `Q 1,0 1,${cr}`,
    // right side ↓ to notch top
    `L 1,${0.5 - nr}`,
    // right notch — arc sweeping INWARD (large-arc=0, sweep=0 means concave inward)
    `A ${nr},${nr} 0 0,0 1,${0.5 + nr}`,
    // continue down to bottom-right
    `L 1,${1 - cr}`,
    `Q 1,1 ${1 - cr},1`,
    // bottom
    `L ${cr},1`,
    `Q 0,1 0,${1 - cr}`,
    // left side ↑ to notch bottom
    `L 0,${0.5 + nr}`,
    // left notch — arc sweeping INWARD
    `A ${nr},${nr} 0 0,0 0,${0.5 - nr}`,
    // continue up to top-left
    `L 0,${cr}`,
    `Q 0,0 ${cr},0`,
    `Z`,
  ].join(" ");

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden"
      style={{ backgroundColor: "#F8F9FF" }}
    >
      {/* SVG clip-path definition */}
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
        <defs>
          <clipPath id="ticket-clip" clipPathUnits="objectBoundingBox">
            <path d={path} />
          </clipPath>
        </defs>
      </svg>

      {/* Same mesh gradient + flow field as dashboard empty state */}
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

      {/* Card with SVG clip-path that punches ticket holes on left & right */}
      <div
        className="relative z-10 flex flex-col items-center text-center border border-neutral-100"
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: `${W}px`,
          padding: "52px 40px 48px",
          /* drop-shadow renders AFTER clip-path, so it respects the notched shape */
          filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.10)) drop-shadow(0 0 0 rgba(0,0,0,0.04))",
          borderRadius: "40px",
          clipPath: "url(#ticket-clip)",
        }}
      >
        {/* floop logo */}
        <Image
          src="/landing/floop-thin.svg"
          alt="floop"
          width={120}
          height={40}
          style={{
            marginBottom: "28px",
            objectFit: "contain",
          }}
          priority
        />

        {isSigningUp ? (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <h1
              style={{
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: "24px",
                fontWeight: 500,
                lineHeight: 1.2,
                color: "#111111",
                marginBottom: "2px",
              }}
            >
              Create your account
            </h1>
            <p
              style={{
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: "15px",
                lineHeight: 1.5,
                letterSpacing: "-0.01em",
                color: "#6b7280",
                marginBottom: "28px",
              }}
            >
              Enter your email to create an account.
            </p>
            <div className="w-full max-w-[280px] text-left">
              <LoginForm defaultMode="magic" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            {/* Caveat heading */}
            <h1
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "42px",
                fontWeight: 600,
                lineHeight: 1.15,
                color: "#111111",
                marginBottom: "20px",
              }}
            >
              You&apos;re invited for<br />beta testing
            </h1>

            {/* Supporting text */}
            <p
              style={{
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: "15px",
                lineHeight: 1.65,
                color: "#6b7280",
                maxWidth: "280px",
                marginBottom: "36px",
              }}
            >
              Help us shape how designers give and get feedback on live websites.
              Your input matters more than you think.
            </p>

            {/* CTA button */}
            <button
              onClick={() => setIsSigningUp(true)}
              style={{
                display: "inline-block",
                background: "#3a3cff",
                color: "#ffffff",
                fontFamily: "'General Sans', system-ui, sans-serif",
                fontSize: "15px",
                fontWeight: 500,
                padding: "14px 40px",
                borderRadius: "14px",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#2527e8";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(58,60,255,0.35)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#3a3cff";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              Let&apos;s start
            </button>
          </div>
        )}
      </div>

      {/* LinkedIn Footer Link */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-20">
        <p className="text-sm text-neutral-600 font-sans">
          follow us on{" "}
          <a
            href="https://linkedin.com/company/floop-it"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-600 hover:underline font-medium transition-colors"
          >
            Linkedin
          </a>
        </p>
      </div>
    </div>
  );
}
