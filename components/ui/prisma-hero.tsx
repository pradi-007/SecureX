'use client';

import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import React, { useRef } from "react";

/* ---------------- WordsPullUp ---------------- */
interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp = ({ text, className = "", showAsterisk = false, style }: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block relative"
            style={{ marginRight: isLast ? 0 : "0.25em" }}
          >
            {word}
            {showAsterisk && isLast && (
              <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ---------------- WordsPullUpMultiStyle ---------------- */
interface Segment {
  text: string;
  className?: string;
}

interface WordsPullUpMultiStyleProps {
  segments: Segment[];
  className?: string;
  style?: React.CSSProperties;
}

export const WordsPullUpMultiStyle = ({ segments, className = "", style }: WordsPullUpMultiStyleProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const words: { word: string; className?: string }[] = [];
  segments.forEach((seg) => {
    seg.text.split(" ").forEach((w) => {
      if (w) words.push({ word: w, className: seg.className });
    });
  });

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${className}`} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-block ${w.className ?? ""}`}
          style={{ marginRight: "0.25em" }}
        >
          {w.word}
        </motion.span>
      ))}
    </div>
  );
};

/* ---------------- Hero ---------------- */
export interface NavItem {
  label: string;
  href: string;
}

export interface PrismaHeroProps {
  title?: string;
  tagline?: string;
  description?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  navItems?: NavItem[];
}

const defaultNav: NavItem[] = [
  { label: "Overview", href: "#overview" },
  { label: "Case Manager", href: "#cases" },
  { label: "Custody Chain", href: "#custody" },
  { label: "Vendor Matrix", href: "#vendors" },
  { label: "CLI Console", href: "#cli" },
];

const PrismaHero: React.FC<PrismaHeroProps> = ({
  title = "DVRX",
  tagline = "SURVEILLANCE EVIDENCE FORENSIC PLATFORM",
  description = "A vendor-agnostic DVR/NVR forensic analysis tool for standardized acquisition, proprietary file system parsing, deleted footage recovery, and tamper-evident chain of custody.",
  ctaText = "Launch Investigation",
  onCtaClick,
  navItems = defaultNav,
}) => {
  return (
    <section className="h-screen w-full relative">
      <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[2rem] border border-white/10 shadow-2xl">
        
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />

        {/* Noise overlay */}
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/85" />

        {/* Top Status Capsule */}
        <div className="absolute top-4 left-6 z-20 hidden md:flex items-center gap-2 px-3.5 py-1.5 liquid-glass-pill text-[11px] font-mono text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span>FORENSIC ENGINE READY · PHASE 1 PASS (22/22)</span>
        </div>

        {/* Navbar */}
        <nav className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 liquid-glass-pill px-5 py-2 sm:gap-6 md:gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[11px] transition-all sm:text-xs md:text-sm font-medium tracking-wide hover:text-white hover:scale-105"
                style={{ color: "rgba(225, 224, 204, 0.85)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(225, 224, 204, 0.85)")}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 sm:px-6 md:px-10">
          <div className="grid grid-cols-12 items-end gap-4">
            
            <div className="col-span-12 lg:col-span-8">
              <div className="inline-block px-3 py-1 rounded-full bg-orange-500/15 border border-orange-400/30 backdrop-blur-md text-[11px] font-mono uppercase tracking-[0.25em] text-orange-300 mb-3 font-semibold shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                {tagline}
              </div>
              <h1
                className="font-medium leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw] select-none drop-shadow-2xl"
                style={{ color: "#E1E0CC" }}
              >
                <WordsPullUp text={title} showAsterisk />
              </h1>
            </div>

            <div className="col-span-12 flex flex-col gap-5 pb-6 lg:col-span-4 lg:pb-10">
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-2xl liquid-glass text-xs sm:text-sm md:text-base text-slate-200 font-normal leading-relaxed backdrop-blur-xl"
              >
                {description}
              </motion.div>

              <motion.button
                onClick={onCtaClick}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group inline-flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-[#E1E0CC] to-white py-1.5 pl-6 pr-1.5 text-sm font-semibold text-black transition-all hover:gap-3 sm:text-base shadow-[0_10px_30px_rgba(225,224,204,0.3)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.45)] cursor-pointer"
              >
                {ctaText}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                  <ArrowRight className="h-4 w-4" style={{ color: "#E1E0CC" }} />
                </span>
              </motion.button>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { PrismaHero };
