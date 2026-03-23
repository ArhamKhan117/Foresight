"use client";

import React, { useState } from "react";
import { IoChevronDown } from "react-icons/io5";

interface CollapsibleDescriptionProps {
  description: string;
  label?: string;
  labelClassName?: string;
  textClassName?: string;
}

const CollapsibleDescription: React.FC<CollapsibleDescriptionProps> = ({
  description,
  label = "Description",
  labelClassName = "text-[#838587] text-lg font-medium font-satoshi",
  textClassName = "text-white text-base font-satoshi leading-relaxed",
}) => {
  const [open, setOpen] = useState(false);

  if (!description) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-2 cursor-pointer group w-fit"
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} description`}
      >
        <span className={labelClassName}>{label}</span>
        <IoChevronDown
          className={`text-[#838587] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      {open && (
        <div className={`${textClassName} mt-1 whitespace-pre-wrap`}>
          {description}
        </div>
      )}
    </div>
  );
};

export default CollapsibleDescription;
