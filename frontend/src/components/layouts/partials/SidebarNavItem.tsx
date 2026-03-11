import Icon from "@/components/elements/Icons";
import { SidebarNavItemProps } from "@/types/type";
import Link from "next/link";
import { FC } from "react";

const SidebarNavItem: FC<SidebarNavItemProps> = ({
  label,
  href,
  isActive,
  onClick,
  isCollapsed,
}) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`self-stretch transition-all duration-200 ease-in-out rounded-lg
        ${
          isCollapsed
            ? "p-2.5 md:justify-center"
            : "px-3 py-2 gap-2.5 justify-start items-center"
        } 
        ${
          isActive
            ? "bg-[#07b3ff]/10 outline outline-1 outline-[#07b3ff]/30"
            : "hover:bg-[#ffffff]/5"
        }
        inline-flex items-center gap-2.5 cursor-pointer z-1`}
    >
      <Icon
        name={label}
        size={20}
        color={isActive ? "#07b3ff" : "#838587"}
        className="transition-all duration-200 ease-in-out flex-shrink-0"
      />

      {!isCollapsed && (
        <div
          className={`font-satoshi text-sm font-medium leading-5 transition-all duration-200 ease-in-out
          ${isActive ? "text-[#07b3ff]" : "text-[#838587]"}`}
        >
          {label}
        </div>
      )}

      <div
        className={`md:hidden font-satoshi text-sm font-medium leading-5 transition-all duration-200 ease-in-out
          ${isActive ? "text-[#07b3ff]" : "text-[#838587]"}`}
      >
        {label}
      </div>
    </Link>
  );
};

export default SidebarNavItem;
