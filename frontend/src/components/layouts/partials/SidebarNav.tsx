"use client";
import { SidebarNavProps } from "@/types/type";
import SidebarNavItem from "./SidebarNavItem";
import { useState } from "react";
import { FaGithub, FaYoutube, FaXTwitter } from "react-icons/fa6";
import { IoDocumentTextOutline } from "react-icons/io5";

const sidebarNavList = [
  { label: "Home", href: "/" },
  { label: "FundMarket", href: "/fund" },
  { label: "ProposeMarket", href: "/propose" },
  { label: "Referral", href: "/referral" },
  { label: "Profile", href: "/profile" },
  { label: "About", href: "/about" },
] as const;

const socialLinks = [
  { icon: FaGithub, href: "https://github.com", label: "GitHub" },
  { icon: FaXTwitter, href: "https://x.com", label: "Twitter" },
  { icon: FaYoutube, href: "https://youtube.com", label: "YouTube" },
  { icon: IoDocumentTextOutline, href: "/about", label: "Docs" },
];

const SidebarNav: React.FC<SidebarNavProps> = ({ isCollapsed }) => {
  const [activeItem, setActiveItem] = useState<string>("Home");

  return (
    <nav className="flex grow px-3 py-4 flex-col items-start gap-1.5 relative self-stretch">
      {sidebarNavList.map(({ label, href }) => (
        <SidebarNavItem
          key={label}
          label={label}
          href={href}
          isActive={activeItem === label}
          onClick={() => setActiveItem(label)}
          isCollapsed={isCollapsed}
        />
      ))}

      {/* Social links */}
      <div className={`mt-auto z-10 flex pt-4 ${isCollapsed ? "flex-col items-center gap-2 w-full" : "flex-row items-center gap-3 px-1"}`}>
        {socialLinks.map(({ icon: Icon, href, label }) => (
          <a
            key={label}
            href={href}
            {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            aria-label={label}
            className="w-8 h-8 rounded-full bg-[#282828] border border-[#3a3a3a] flex items-center justify-center text-[#838587] hover:text-white hover:bg-[#3a3a3a] transition-all duration-200 flex-shrink-0"
          >
            <Icon size={14} />
          </a>
        ))}
      </div>

      {/* Bottom decorative image */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 pointer-events-none">
          <img
            src="/spec.png"
            className="w-[180px] h-[170px] mix-blend-screen opacity-80"
            alt=""
          />
        </div>
      )}
    </nav>
  );
};

export default SidebarNav;
