"use client";

import React, { useState } from "react";
import { FlowFieldBackground, FLOW_FIELD_BG } from "@/components/FlowFieldBackground";
import Link from "next/link";
import { CalDemoButton } from "@/components/landing/CalDemoButton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Zap,
  Map
} from "lucide-react";

type Entry = {
  id: string;
  date: string;
  day: string;
  month: string;
  title: string;
  description: string;
  image: string;
  type: "Update" | "Improvement" | "Roadmap";
  quote: string;
  caption: string;
};

const entries: Entry[] = [
  {
    id: "3",
    date: "Mar 22, 2026",
    day: "22",
    month: "Mar",
    title: "Skeuomorphic Redesign & Inline Comments",
    description:
      "We've completely overhauled the design to feel more tactile and human. You can now also leave inline comments anywhere on the screen, just like in Figma.\n\nUse Ctrl + Click to add feedback instantly right where you need it.\n\nThe tactile feel is designed to make giving feedback less of a chore and more of an interactive experience.",
    image: "/landing/feedback.png",
    type: "Update",
    quote: "Making feedback feel as natural as pointing at a screen.",
    caption: "A more tactile feedback loop",
  },
  {
    id: "2",
    date: "Mar 15, 2026",
    day: "15",
    month: "Mar",
    title: "Minimap & Deep Insights",
    description:
      "Added a minimap to easily navigate through long pages and find comments. We've also boosted performance for a smoother experience.\n\nYou can now see exactly where pins are located at a glance. Clicking the minimap instantly jumps you to the feedback.",
    image: "/emptyState1.webp",
    type: "Improvement",
    quote: "Never lose track of feedback on long landing pages.",
    caption: "Gaining the 10,000 foot view",
  },
  {
    id: "1",
    date: "Apr 2026",
    day: "TBD",
    month: "Apr",
    title: "Video Feedback & Linear Integration",
    description:
      "Soon you'll be able to leave video feedback directly on the page. We are also working on Jira and Linear integrations so your feedback flows directly into your issue tracker.\n\nStay tuned for more updates as we build the ultimate workflow for design feedback.",
    image: "/landing/Add-comment.png",
    type: "Roadmap",
    quote: "The future of feedback is synchronous and integrated.",
    caption: "What's coming next for floop",
  },
];

export default function ChangelogPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeEntry = entries[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev < entries.length - 1 ? prev + 1 : prev));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Update":
        return <Sparkles className="w-4 h-4 text-primary" />;
      case "Improvement":
        return <Zap className="w-4 h-4 text-primary" />;
      case "Roadmap":
        return <Map className="w-4 h-4 text-primary" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen text-foreground flex flex-col font-sans relative overflow-x-hidden" style={{ backgroundColor: FLOW_FIELD_BG }}>
      <header className="sticky top-0 z-50 backdrop-blur-md shrink-0 w-full border-b border-border/20" style={{ backgroundColor: `${FLOW_FIELD_BG}e6` }}>
        <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-4 flex items-center justify-between gap-2 sm:gap-3">
          <Link
            href="/"
            className="shrink-0 hover:opacity-90 transition-opacity flex items-center"
            aria-label="floop"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/floop-thin.svg"
              alt="floop"
              className="h-6 sm:h-7 w-auto"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <CalDemoButton />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 relative w-full overflow-hidden">
        {/* Flow-field background */}
        <FlowFieldBackground />

        <div className="text-center w-full mb-8 lg:mb-12 relative z-20">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-foreground lowercase">
            changelog
          </h1>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-6xl relative z-10">

          {/* Mobile Tabs (Top) */}
          <div className="flex md:hidden w-full overflow-x-auto gap-2 p-2 mb-4 scrollbar-hide">
            {entries.map((entry, idx) => (
              <button
                key={entry.id}
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeIndex === idx
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
              >
                {entry.month}
              </button>
            ))}
          </div>

          {/* Desktop Tabs (Left side) */}
          <div className="hidden md:flex flex-col gap-2 mr-[-10px] z-0 mt-8 w-[72px]">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].slice(0, new Date().getMonth() + 1).map((monthStr) => {
              const hasEntry = entries.some(e => e.month.startsWith(monthStr));
              const isCurrentMonth = activeEntry.month.startsWith(monthStr);

              const handleMonthClick = () => {
                const idx = entries.findIndex(e => e.month.startsWith(monthStr));
                if (idx !== -1) setActiveIndex(idx);
              };

              return (
                <button
                  key={monthStr}
                  onClick={handleMonthClick}
                  disabled={!hasEntry}
                  className={`relative flex items-center justify-center py-2 rounded-l-2xl transition-all font-bold uppercase tracking-wider w-full border-none ${isCurrentMonth
                    ? "bg-primary text-primary-foreground shadow-[rgba(0,0,0,0.1)_-4px_4px_12px] z-10 text-[13px]"
                    : hasEntry
                      ? "bg-[#f4f4f5] text-muted-foreground/70 hover:bg-[#e4e4e7] shadow-[rgba(0,0,0,0.03)_-2px_2px_5px] z-0 text-[13px]"
                      : "bg-[#fcfcfc] text-muted-foreground/30 cursor-not-allowed z-0 text-[13px]"
                    }`}
                  style={{
                    minHeight: "48px"
                  }}
                >
                  <span className={isCurrentMonth ? "" : "opacity-90"}>{monthStr}</span>
                </button>
              );
            })}
          </div>

          {/* The Book Container */}
          <div className="w-full md:w-[900px] lg:w-[1000px] h-auto min-h-[700px] md:h-[650px] bg-primary/20 p-2 md:p-3 rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)] relative z-10 flex flex-col md:flex-row">


            {/* Inner Pages Wrapper */}
            <div className="w-full h-full bg-card text-card-foreground rounded-xl md:rounded-2xl shadow-inner relative flex flex-col md:flex-row overflow-hidden border border-border">

              {/* Binder Rings (Desktop) */}
              <div className="hidden md:flex absolute left-1/2 top-0 bottom-0 w-8 flex-col justify-between py-12 z-50 pointer-events-none items-center" style={{ transform: 'translateX(-50%)' }}>
                {/* Fake gradient shadow exactly directly under the rings, perfectly centered */}
                <div className="absolute inset-y-0 left-1/2 w-16 -translate-x-1/2 bg-linear-to-r from-black/0 via-black/10 to-transparent mix-blend-multiply"></div>

                {/* The metal rings */}
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="relative w-8 h-8 flex items-center justify-center">
                    <div className="w-10 h-3 bg-linear-to-b from-gray-300 via-gray-100 to-gray-400 rounded-full shadow-md border border-gray-400/50 absolute z-20"
                      style={{ boxShadow: "0 4px 6px rgba(0,0,0,0.3) inset, 0 2px 4px rgba(0,0,0,0.2)" }} />
                    {/* Left hole */}
                    <div className="w-3 h-3 bg-gray-800 rounded-full absolute left-[-2px] z-10 shadow-inner"></div>
                    {/* Right hole */}
                    <div className="w-3 h-3 bg-gray-800 rounded-full absolute right-[-2px] z-10 shadow-inner"></div>
                  </div>
                ))}
              </div>

              {/* Binder Rings (Mobile - Top spiral) */}
              <div className="flex md:hidden absolute top-0 left-0 right-0 h-6 justify-center gap-4 pt-1 z-50 pointer-events-none">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="relative w-3 h-6 flex flex-col items-center">
                    <div className="w-2 h-6 bg-linear-to-r from-gray-300 via-gray-100 to-gray-400 rounded-full shadow-md border border-gray-400/50 absolute z-20"></div>
                    <div className="w-3 h-3 bg-gray-800 rounded-full absolute bottom-[-4px] z-10 shadow-inner"></div>
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeEntry.id}
                  initial={{ opacity: 0, rotateY: -10 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: 10 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="flex flex-col md:flex-row w-full h-full pt-6 md:pt-0"
                >
                  {/* Left Page (Visuals) */}
                  <div className="w-full md:w-1/2 h-full p-6 md:p-10 flex flex-col relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 z-10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-full shadow-sm">
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{activeEntry.month}</p>
                          {/* <p className="text-foreground text-sm font-medium">{activeEntry.date}</p> */}
                        </div>
                      </div>
                      <div className="text-muted-foreground text-xs italic font-medium">
                        {activeEntry.type === 'Roadmap' ? 'On the horizon...' : 'Deployed to production.'}
                      </div>
                    </div>

                    {/* Body: Polaroid */}
                    <div className="flex-1 flex flex-col items-center justify-center z-10 -mt-4">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-card p-4 pb-12 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.05)] border border-border w-full max-w-[320px] relative transition-transform hover:-translate-y-1 hover:rotate-1"
                      >
                        <div className="aspect-4/3 w-full bg-muted rounded overflow-hidden flex items-center justify-center relative border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activeEntry.image}
                            alt="Update Visual"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/floop-thin.png'; // fallback
                            }}
                          />
                        </div>
                        <p className="absolute bottom-4 left-0 right-0 text-center font-medium text-muted-foreground text-sm font-serif italic">
                          {activeEntry.caption}
                        </p>
                      </motion.div>
                    </div>

                    {/* Footer Left: Type */}
                    <div className="mt-auto z-10 w-fit">
                      <div className="px-3 py-1.5 bg-muted rounded-lg flex items-center gap-2 shadow-inner border border-border/50">
                        {getTypeIcon(activeEntry.type)}
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{activeEntry.type}</span>
                      </div>
                    </div>

                  </div>

                  {/* Right Page (Content) */}
                  <div className="w-full md:w-1/2 h-full relative"
                    style={{
                      backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, var(--color-border) 31px, var(--color-border) 32px)",
                      backgroundPosition: "0 40px",
                    }}
                  >
                    <div className="h-full w-full p-6 md:p-10 flex flex-col">

                      {/* Top Right Highlight Card */}
                      <div className="bg-card p-5 rounded-2xl shadow-md border border-border mb-8 relative z-10 backdrop-blur-sm self-end w-4/5 ml-auto">
                        <div className="flex items-center justify-between mb-3 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Highlight</span>
                          </div>
                          <span className="text-xs font-mono">{activeEntry.type === 'Roadmap' ? 'Future' : 'Released'}</span>
                        </div>
                        <p className="text-foreground font-medium text-lg mb-2 font-serif leading-tight">
                          &quot;{activeEntry.quote}&quot;
                        </p>
                      </div>

                      {/* Handwriting text layer */}
                      <div className="flex-1 relative z-10 pl-2 pr-6">
                        <div className="flex items-start mb-2 text-primary">
                          <h2 className="text-xl md:text-2xl font-bold text-foreground" style={{ lineHeight: '32px' }}>
                            {activeEntry.title}
                          </h2>
                        </div>

                        <div className="mt-2 text-foreground/80 text-[15px] space-y-0 relative z-20">
                          {activeEntry.description.split('\n').map((paragraph, i) => (
                            <p key={i} className="min-h-[32px] font-medium leading-[32px]">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

            </div>

            {/* Nav Controls for Desktop */}
            <div className="hidden md:flex absolute -right-6 -bottom-6 gap-2">
              <button
                onClick={handlePrev}
                disabled={activeIndex === entries.length - 1}
                className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 border-none"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                disabled={activeIndex === 0}
                className="w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 border-none"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="flex md:hidden justify-between w-full mt-6 px-4">
            <button
              onClick={handlePrev}
              disabled={activeIndex === entries.length - 1}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow disabled:opacity-50 border-none"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Older
            </button>
            <button
              onClick={handleNext}
              disabled={activeIndex === 0}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow disabled:opacity-50 border-none"
            >
              Newer <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>

        </div>

        <div className="mt-16 text-center text-sm font-medium text-muted-foreground/60 relative z-20 pb-8">
          Design inspired from <a href="https://strongme.app" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline underline-offset-4 decoration-border">strongme.app</a>
        </div>

      </div>
    </div>
  );
}
