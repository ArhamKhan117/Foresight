"use client";

import { useState } from "react";
import { AboutSection } from "@/components/elements/about/AboutSection";
import AboutSubSidebar from "@/components/elements/about/AboutSubSidebar";

export default function AboutPage() {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  return (
    <div className="w-full flex-1 flex flex-col md:flex-row gap-0">
      <div className="md:w-[240px] flex-shrink-0 border-r border-[#1e1e1e] p-4 md:p-5 md:pt-8">
        <p className="hidden md:block text-[#555] text-xs font-satoshi uppercase tracking-wider mb-4 px-3">FAQ</p>
        <AboutSubSidebar selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} />
      </div>
      <div className="flex-1 px-4 md:px-10 py-4 md:py-8 overflow-auto">
        <AboutSection selectedIndex={selectedIndex} />
      </div>
    </div>
  );
}
