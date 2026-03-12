import React from "react";

interface AboutSubSidebarProps {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

const items = [
  "What is Foresight?",
  "How do prediction markets work?",
  "Is Foresight safe and secure?",
  "How do I get started?",
  "What can I trade on Foresight?",
  "How does liquidity work?",
  "What are the fees?",
];

const AboutSubSidebar: React.FC<AboutSubSidebarProps> = ({ selectedIndex, setSelectedIndex }) => {
  return (
    <nav className="w-full flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible py-1 md:py-0">
      {items.map((title, index) => (
        <button
          key={index}
          onClick={() => setSelectedIndex(index)}
          className={`text-left whitespace-nowrap md:whitespace-normal px-3 py-2.5 rounded-lg text-sm font-satoshi transition-all duration-150 flex-shrink-0 ${
            index === selectedIndex
              ? "bg-[#07b3ff]/8 text-[#07b3ff] border-l-2 border-[#07b3ff] font-medium"
              : "text-[#777] hover:text-[#aaa] hover:bg-[#1a1a1a] border-l-2 border-transparent"
          }`}
        >
          {title}
        </button>
      ))}
    </nav>
  );
};

export default AboutSubSidebar;
