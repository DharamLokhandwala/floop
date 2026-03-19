"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

type PointerId = "stakeholder" | "team" | "you";

const flyInFromLeft = (delay: number) => ({
  initial: { x: -80, y: 16, opacity: 0, rotate: -15 },
  animate: {
    x: 0,
    y: 0,
    opacity: 1,
    rotate: 0,
  },
  transition: {
    duration: 0.9,
    delay,
    ease: [0.22, 0.61, 0.36, 1] as const,
  },
});

const flyInFromRight = (delay: number) => ({
  initial: { x: 80, y: 16, opacity: 0, rotate: 15 },
  animate: {
    x: 0,
    y: 0,
    opacity: 1,
    rotate: 0,
  },
  transition: {
    duration: 0.9,
    delay,
    ease: [0.22, 0.61, 0.36, 1] as const,
  },
});

/** Continuous float - each traces a 4-point path (different coordinates) */
const floatPath1 = {
  animate: { x: [0, 40, 15, 0, 0], y: [0, 0, -10, -25, 0] },
  transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
};
const floatPath2 = {
  animate: { x: [0, -40, -15, 0, 0], y: [0, 0, 15, 30, 0] },
  transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" as const },
};
const floatPath3 = {
  animate: { x: [0, 8, 0, -8, 0], y: [0, -40, 10, 30, 0] },
  transition: { duration: 4.2, repeat: Infinity, ease: "easeInOut" as const },
};

export function HeroSection() {
  const [openPointer, setOpenPointer] = useState<PointerId | null>("stakeholder");
  const [ctaHovered, setCtaHovered] = useState(false);

  const togglePointer = (id: PointerId) => {
    setOpenPointer((current) => (current === id ? null : id));
  };

  return (
    <section className="relative w-full flex flex-col flex-1 min-h-0 bg-white pt-8 sm:pt-0 pb-0 sm:pb-[45vh] md:pb-[50vh]">
      <div className="relative z-10 sm:flex-1 flex items-center justify-center min-h-0 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="relative z-10 max-w-4xl mx-auto text-left sm:text-center space-y-4 sm:space-y-5">
            <h1 className="text-4xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-tight">
              <span>Share your live website</span>
              <br />
              <span>and get </span>
              <span className="relative inline-flex items-center">
                <span className="relative inline-flex items-center  border border-blue-400 bg-blue-50 px-2 sm:px-3 py-1 text-blue-600 mt-2 sm:mt-0">
                  design feedback
                  {/* Corner handles */}
                  <span className="pointer-events-none absolute -top-1 -left-1 h-1.5 w-1.5 bg-blue-500" />
                  <span className="pointer-events-none absolute -top-1 -right-1 h-1.5 w-1.5  bg-blue-500" />
                  <span className="pointer-events-none absolute -bottom-1 -left-1 h-1.5 w-1.5  bg-blue-500" />
                  <span className="pointer-events-none absolute -bottom-1 -right-1 h-1.5 w-1.5  bg-blue-500" />
                </span>
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl sm:mx-auto">
              from stakeholders, peers, friends – anyone looking at your live site.
            </p>
            <div className="pt-2 sm:pt-4 flex flex-col items-start sm:items-center gap-3">
              <Link
                href="https://tally.so/r/3j4JAY"
                onMouseEnter={() => setCtaHovered(true)}
                onMouseLeave={() => setCtaHovered(false)}
              >
                <Button
                  size="lg"
                  className="rounded-full px-8 sm:px-10 text-sm sm:text-base font-medium bg-blue-600 hover:bg-blue-600/90 text-white transition-transform duration-150 hover:scale-[1.03]"
                >
                  Get early access
                </Button>
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Join 50+ designers testing early
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive browser mockup - flows natively on mobile, fixed to bottom on desktop */}
      <div className="relative sm:fixed sm:bottom-0 sm:left-0 sm:right-0 w-full sm:z-0 overflow-hidden mt-10 sm:mt-0">
        <motion.div
          className="relative w-full flex justify-start sm:justify-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="relative w-[115vw] sm:w-[150vw] md:w-full min-w-0 sm:shrink-0 max-w-none -ml-3 sm:ml-0 -mb-10 sm:mb-0">
            {/* Full browser + sidebar wireframe SVG */}
            <picture>
              <source media="(min-width: 640px)" srcSet="/landing/website-wirerfame.svg" />
              <img
                src="/mobile-website-wireframe.svg"
                alt="Browser with website and feedback sidebar"
                className="w-full mx-auto h-auto max-h-none sm:max-h-screen md:max-h-[60vh] object-cover sm:object-contain object-top sm:object-bottom"
                loading="eager"
                decoding="async"
              />
            </picture>

            {/* Floating pointers over the SVG */}
            {/* Stakeholder - flies in from left, moves toward CTA on hover */}
            <motion.button
              type="button"
              onClick={() => togglePointer("stakeholder")}
              className="absolute top-[8%] right-[6%] sm:top-[10%] sm:right-[10%] md:top-[12%] md:right-[12%] flex flex-col items-center gap-1 focus:outline-none touch-manipulation"
              {...flyInFromLeft(0)}
            >
              <motion.span
                className="flex flex-col items-center"
                animate={{ x: ctaHovered ? -180 : 0, y: ctaHovered ? 120 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.span className="flex flex-col items-center" {...floatPath1}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/landing/stakeholder.svg"
                    alt="Stakeholder cursor"
                    className="h-16 sm:h-16 w-auto drop-shadow-[0_8px_16px_rgba(15,23,42,0.28)]"
                  />
                </motion.span>
              </motion.span>
            </motion.button>

            {/* Team - flies in from left, moves toward CTA on hover */}
            <motion.button
              type="button"
              onClick={() => togglePointer("team")}
              className="absolute bottom-[28%] left-[4%] sm:bottom-[22%] sm:left-[6%] md:bottom-[18%] md:left-[8%] flex flex-col items-center gap-1 focus:outline-none touch-manipulation"
              {...flyInFromLeft(0.2)}
            >
              <motion.span
                className="flex flex-col items-center"
                animate={{ x: ctaHovered ? 160 : 0, y: ctaHovered ? -120 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.span className="flex flex-col items-center" {...floatPath2}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/landing/team.svg"
                    alt="Team cursor"
                    className="h-16 sm:h-16 w-auto drop-shadow-[0_8px_16px_rgba(15,23,42,0.28)]"
                  />
                </motion.span>
              </motion.span>
            </motion.button>

            {/* You - flies in from right, moves toward CTA on hover */}
            <motion.button
              type="button"
              onClick={() => togglePointer("you")}
              className="absolute bottom-[18%] right-[12%] sm:bottom-[14%] sm:right-[14%] md:bottom-[12%] md:right-[16%] flex flex-col items-center gap-1 focus:outline-none touch-manipulation"
              {...flyInFromRight(0.35)}
            >
              <motion.span
                className="flex flex-col items-center"
                animate={{ x: ctaHovered ? -160 : 0, y: ctaHovered ? -100 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.span className="flex flex-col items-center" {...floatPath3}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/landing/you.svg"
                    alt="Your cursor"
                    className="h-16 sm:h-14 w-auto drop-shadow-[0_8px_16px_rgba(15,23,42,0.28)]"
                  />
                </motion.span>
              </motion.span>
            </motion.button>


          </div>
        </motion.div>
      </div>
    </section>
  );
}
