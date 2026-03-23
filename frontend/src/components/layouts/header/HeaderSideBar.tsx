"use client";

import Icon from "@/components/elements/Icons";
import Link from "next/link";
import SidebarNav from "../partials/SidebarNav";
import { useWindowSize } from "@/hooks/useWindowSize";
import { RxCross2 } from "react-icons/rx";

interface HeaderSideBarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isCancel?: boolean;
  setIsCanceled?: React.Dispatch<React.SetStateAction<boolean>>;
}

const HeaderSideBar = ({ isCollapsed, setIsCollapsed, isCancel, setIsCanceled }: HeaderSideBarProps) => {
  const { width } = useWindowSize();

  return (
    <div
      className={`hidden md:flex fixed top-0 left-0 h-screen z-30 ${isCollapsed ? "w-[72px]" : "w-[220px]"} bg-[#1E1E1E] flex-col transition-all duration-300 border-r border-[#2a2a2a]`}
    >
      {/* Logo */}
      <div
        className={`md:flex hidden flex-none items-center h-14 gap-2 px-4 shrink-0 self-stretch transition-all duration-300 ${isCollapsed ? "justify-center" : "justify-start"}`}
      >
        <div className="flex items-center gap-2 cursor-pointer">
          <Link href="/markets">
            <Icon name="Logo" size={32} />
          </Link>
          {!isCollapsed && (
            <Link
              href="/markets"
              className="text-2xl leading-7 font-normal font-['anton'] text-white uppercase"
            >
              foresight
            </Link>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-[#2a2a2a]" />

      <div className="md:hidden self-stretch h-[50px] px-4 py-2 inline-flex justify-start items-center gap-2">
        <div
          onClick={() => setIsCanceled && setIsCanceled(!isCancel)}
          className="w-4 h-4 relative overflow-hidden"
        >
          <RxCross2 className="text-white" />
        </div>
        <div className="flex-1 flex justify-start items-center gap-0.5">
          <Link href="/markets">
            <Icon name="Logo" size={20} />
          </Link>
          <Link
            href="/markets"
            className="text-lg leading-7 font-normal font-['anton'] text-white uppercase"
          >
            foresight
          </Link>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <SidebarNav isCollapsed={isCollapsed} />

      {/* Collapse toggle */}
      <div
        data-size="Small"
        data-type="Tertiary"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`w-6 h-6 ${isCollapsed ? "left-[84px] top-[44px]" : "left-[232px] top-[44px]"} absolute origin-top-left hover:bg-[#3a3a3a] rotate-180 cursor-pointer bg-[#282828] rounded-full border border-[#3a3a3a] md:inline-flex hidden justify-center items-center`}
      >
        <Icon
          name={isCollapsed ? "ArrowRight" : "ArrowLeft"}
          color={"white"}
          size={12}
        />
      </div>
    </div>
  );
};

export default HeaderSideBar;
