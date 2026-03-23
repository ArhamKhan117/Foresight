"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import "./landing.css";

/* ── SVG Icons ── */
const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);

const IconTrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);

const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);

const IconRefresh = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);

const IconBitcoin = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/></svg>
);

const IconActivity = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
);

const IconGlobe = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
);

const IconMessageCircle = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>
);

/* ── Animated bar for the preview card ── */
function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="h-2 w-full rounded-full" style={{ background: "#333" }}>
      <div
        className="h-2 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ── TOP MARQUEE ── */}
      <div
        className="font-mono uppercase text-[10px] md:text-sm py-2 border-b-4 border-black overflow-hidden"
        style={{ background: "#121212", color: "#ecfd00" }}
      >
        <div className="marquee-container">
          <div className="marquee-content font-bold">
            FORESIGHT — DECENTRALIZED PREDICTION MARKETS ON HEDERA — TRADE THE FUTURE — POWERED BY HBAR — PREDICT / TRADE / EARN — FORESIGHT — DECENTRALIZED PREDICTION MARKETS ON HEDERA — TRADE THE FUTURE — POWERED BY HBAR — PREDICT / TRADE / EARN —&nbsp;
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <header
        className="sticky top-0 z-50 border-b-4 border-black px-4 py-2 md:px-8 flex justify-between items-center h-[60px] md:h-[70px]"
        style={{ background: "#fff" }}
      >
        <div className="font-display text-3xl md:text-5xl tracking-tighter flex items-center gap-2">
          <span style={{ color: "#07b3ff" }}>FORE</span>SIGHT
        </div>
        <div className="flex gap-3 items-center">
          <Link
            href="/markets"
            className="font-mono font-bold text-sm uppercase px-5 py-2 border-4 border-black shadow-hard-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center gap-2"
            style={{ background: "#07b3ff", color: "#fff" }}
          >
            Launch App <IconArrowRight />
          </Link>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 border-b-4 border-black" style={{ background: "#fff" }}>
        {/* Left — Copy */}
        <div
          className="lg:col-span-7 p-8 md:p-16 flex flex-col justify-center border-b-4 lg:border-b-0 lg:border-r-4 border-black relative overflow-hidden"
          style={{
            backgroundSize: "20px 20px",
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
          }}
        >
          <div className="relative z-10">
            <div
              className="inline-block font-mono text-[10px] px-2 py-0.5 mb-5 transform -rotate-1"
              style={{ background: "#000", color: "#fff", boxShadow: "2px 2px 0px 0px #ecfd00" }}
            >
              BUILT ON HEDERA
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl uppercase leading-[0.85] mb-6 tracking-tighter">
              PREDICT<br />
              THE <span style={{ color: "#07b3ff" }}>FUTURE</span>
            </h1>

            <p
              className="font-mono text-xs md:text-sm max-w-lg mb-10 border-l-4 pl-4"
              style={{ borderColor: "#07b3ff", color: "#555" }}
            >
              Create and trade prediction markets on crypto prices, sports, news, and more.
              Provide liquidity, earn fees, and let the oracle resolve the truth.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/markets"
                className="font-mono font-bold text-base uppercase px-7 py-4 border-4 border-black shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center gap-2"
                style={{ background: "#07b3ff", color: "#fff" }}
              >
                START TRADING <IconArrowRight />
              </Link>
              <Link
                href="/about"
                className="font-mono font-bold text-base uppercase px-7 py-4 border-4 border-black shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                style={{ background: "#fff", color: "#000" }}
              >
                LEARN MORE
              </Link>
            </div>
          </div>
        </div>

        {/* Right — Collage Preview */}
        <div className="lg:col-span-5 bg-black p-6 md:p-10 flex items-center justify-center">
          <div className="relative w-full" style={{ minHeight: "420px" }}>
            {/* Card 1 — Main, slightly rotated left */}
            <div
              className="absolute top-0 left-0 right-4 border-4 border-white/20 rounded-xl overflow-hidden z-30 hover:z-50 transition-all duration-300 hover:scale-105"
              style={{ background: "#1a1a2e", transform: "rotate(-2deg)", maxWidth: "320px" }}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#07b3ff" }}>
                    <IconBitcoin />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold" style={{ color: "#f0f0f0" }}>Will BTC hit $150K?</div>
                    <div className="font-mono text-[10px]" style={{ color: "#888" }}>Expires Mar 31, 2026</div>
                  </div>
                </div>
                <div className="font-mono text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#07b3ff", color: "#fff" }}>
                  LIVE
                </div>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <div className="flex justify-between font-mono text-[10px] mb-1">
                    <span className="font-bold" style={{ color: "#4ade80" }}>YES</span>
                    <span style={{ color: "#4ade80" }}>67%</span>
                  </div>
                  <AnimatedBar pct={67} color="#22c55e" delay={300} />
                </div>
                <div>
                  <div className="flex justify-between font-mono text-[10px] mb-1">
                    <span className="font-bold" style={{ color: "#f87171" }}>NO</span>
                    <span style={{ color: "#f87171" }}>33%</span>
                  </div>
                  <AnimatedBar pct={33} color="#ef4444" delay={500} />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-white/10 flex justify-between items-center">
                <div className="font-mono text-[10px]" style={{ color: "#999" }}>Vol: 2,450 HBAR</div>
                <div className="flex gap-2">
                  <span className="font-mono text-[10px] font-bold px-3 py-1 rounded" style={{ background: "#22c55e", color: "#fff" }}>BUY YES</span>
                  <span className="font-mono text-[10px] font-bold px-3 py-1 rounded" style={{ background: "#ef4444", color: "#fff" }}>BUY NO</span>
                </div>
              </div>
            </div>

            {/* Card 2 — Offset right, rotated right */}
            <div
              className="absolute top-36 right-0 border-4 border-white/20 rounded-xl overflow-hidden z-20 hover:z-50 transition-all duration-300 hover:scale-105"
              style={{ background: "#0f1a2e", transform: "rotate(3deg)", maxWidth: "290px", width: "85%" }}
            >
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#22c55e" }}>
                    <IconActivity />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold" style={{ color: "#f0f0f0" }}>Will SOL reach $200?</div>
                    <div className="font-mono text-[10px]" style={{ color: "#888" }}>Expires Apr 15, 2026</div>
                  </div>
                </div>
                <div className="font-mono text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#22c55e", color: "#fff" }}>
                  LIVE
                </div>
              </div>
              <div className="px-4 pb-3">
                <div className="flex justify-between font-mono text-[10px] mb-1">
                  <span className="font-bold" style={{ color: "#4ade80" }}>YES 42%</span>
                  <span className="font-bold" style={{ color: "#f87171" }}>NO 58%</span>
                </div>
                <AnimatedBar pct={42} color="#22c55e" delay={700} />
              </div>
            </div>

            {/* Card 3 — Top right area, slight tilt */}
            <div
              className="absolute top-4 right-0 border-4 border-white/20 rounded-xl overflow-hidden z-10 hover:z-50 transition-all duration-300 hover:scale-105"
              style={{ background: "#1a0f2e", transform: "rotate(2deg)", maxWidth: "260px", width: "75%" }}
            >
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#f97316" }}>
                    <IconGlobe />
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold" style={{ color: "#f0f0f0" }}>CL Final: Real Madrid?</div>
                    <div className="font-mono text-[10px]" style={{ color: "#888" }}>Expires May 31, 2026</div>
                  </div>
                </div>
                <div className="font-mono text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#f97316", color: "#fff" }}>
                  LIVE
                </div>
              </div>
              <div className="px-4 pb-3">
                <div className="flex justify-between font-mono text-[10px] mb-1">
                  <span className="font-bold" style={{ color: "#4ade80" }}>YES 55%</span>
                  <span className="font-bold" style={{ color: "#f87171" }}>NO 45%</span>
                </div>
                <AnimatedBar pct={55} color="#22c55e" delay={900} />
              </div>
            </div>

            {/* Bottom text points */}
            <div className="absolute bottom-0 left-0 right-0 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#000" }} />
                <span className="font-mono text-sm font-bold" style={{ color: "#000" }}>Powered by Hedera&apos;s fast, low-fee network</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#000" }} />
                <span className="font-mono text-sm font-bold" style={{ color: "#000" }}>Automated market maker for instant trades</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#000" }} />
                <span className="font-mono text-sm font-bold" style={{ color: "#000" }}>Oracle-verified resolution for fair outcomes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <h2 className="font-display text-3xl md:text-4xl uppercase mb-12 flex items-center gap-3">
          <span
            className="inline-flex w-10 h-10 border-4 border-black items-center justify-center"
            style={{ background: "#ecfd00" }}
          >
            <IconRefresh />
          </span>
          HOW IT WORKS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "CREATE OR FIND",
              desc: "Browse active markets or propose your own. Crypto prices, sports outcomes, news events — anything goes.",
              color: "#07b3ff",
              icon: <IconSearch />,
            },
            {
              step: "02",
              title: "TRADE YES / NO",
              desc: "Buy YES or NO shares based on your prediction. Prices move with the market via an automated market maker.",
              color: "#ecfd00",
              icon: <IconTrendingUp />,
            },
            {
              step: "03",
              title: "EARN & COLLECT",
              desc: "When the market resolves, winning shares pay out. Provide liquidity to earn fees from every trade.",
              color: "#ff00ff",
              icon: <IconDollar />,
            },
          ].map((item) => (
            <div
              key={item.step}
              className="border-4 border-black p-6 flex flex-col gap-4 transition-all hover:-translate-y-1 hover:shadow-hard"
              style={{ background: "#fff" }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="font-display text-5xl"
                  style={{ color: item.color, textShadow: "3px 3px 0px #000" }}
                >
                  {item.step}
                </div>
                <div
                  className="w-10 h-10 border-2 border-black flex items-center justify-center"
                  style={{ background: item.color }}
                >
                  {item.icon}
                </div>
              </div>
              <div className="font-display text-xl uppercase">{item.title}</div>
              <div className="font-mono text-xs leading-relaxed text-gray-600">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="border-t-4 border-b-4 border-black" style={{ background: "#000" }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
          <h2 className="font-display text-3xl md:text-4xl uppercase mb-12 text-white tracking-tight">
            MARKET CATEGORIES
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { name: "CRYPTO", desc: "BTC, ETH, SOL & more", icon: <IconBitcoin />, color: "#07b3ff" },
              { name: "SPORTS", desc: "Matches, leagues & finals", icon: <IconActivity />, color: "#22c55e" },
              { name: "NEWS", desc: "World events & politics", icon: <IconGlobe />, color: "#f97316" },
              { name: "TWEETS", desc: "Social media predictions", icon: <IconMessageCircle />, color: "#ff00ff" },
            ].map((cat) => (
              <Link
                key={cat.name}
                href="/markets"
                className="relative border-4 border-black p-6 flex flex-col items-center gap-4 transition-all hover:-translate-y-2 group overflow-hidden"
                style={{ background: cat.color, boxShadow: `6px 6px 0px 0px ${cat.color}44` }}
              >
                {/* Background number watermark */}
                <div
                  className="absolute -right-2 -top-4 font-display text-[80px] leading-none opacity-15 select-none pointer-events-none"
                  style={{ color: "#000" }}
                >
                  {cat.icon}
                </div>

                <div
                  className="relative z-10 w-14 h-14 flex items-center justify-center border-4 border-black rounded-lg"
                  style={{ background: "#fff", color: "#000" }}
                >
                  {cat.icon}
                </div>
                <div className="relative z-10 text-center">
                  <div className="font-display text-lg text-black">{cat.name}</div>
                  <div className="font-mono text-[10px] mt-1" style={{ color: "rgba(0,0,0,0.6)" }}>{cat.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="border-b-4 border-black" style={{ background: "#07b3ff" }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-display text-4xl md:text-5xl uppercase text-white leading-tight">
              READY TO<br />PREDICT?
            </h2>
            <p className="font-mono text-sm text-white/80 mt-3 max-w-md">
              Connect your wallet, pick a market, and start trading in seconds.
            </p>
          </div>
          <Link
            href="/markets"
            className="font-mono font-bold text-lg uppercase px-10 py-5 border-4 border-black shadow-hard transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center gap-3"
            style={{ background: "#ecfd00", color: "#000" }}
          >
            LAUNCH APP <IconArrowRight />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t-4 border-black" style={{ background: "#fff" }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="font-display text-2xl tracking-tighter">
            <span style={{ color: "#07b3ff" }}>FORE</span>SIGHT
          </div>
          <div className="font-mono text-xs text-gray-500 text-center md:text-right">
            Decentralized prediction markets on Hedera
          </div>
        </div>
      </footer>
    </div>
  );
}
