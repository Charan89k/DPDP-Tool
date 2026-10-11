import React from "react";

interface TliBrandMarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  showSubtitle?: boolean;
}

export function TliBrandMark({
  variant = "light",
  size = "md",
  className = "",
  showSubtitle = true,
}: TliBrandMarkProps) {
  const isDark = variant === "dark";

  const sizeClasses = {
    sm: {
      shield: "w-7 h-7",
      title: "text-xl",
      sub1: "text-[8px] tracking-[0.18em]",
      sub2: "text-[7px] tracking-[0.2em]",
    },
    md: {
      shield: "w-9 h-9",
      title: "text-2xl",
      sub1: "text-[9px] tracking-[0.2em]",
      sub2: "text-[8px] tracking-[0.22em]",
    },
    lg: {
      shield: "w-11 h-11",
      title: "text-3xl",
      sub1: "text-[10px] tracking-[0.22em]",
      sub2: "text-[9px] tracking-[0.24em]",
    },
  }[size];

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Blue Emblem Shield */}
      <div className={`relative flex-shrink-0 ${sizeClasses.shield}`}>
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
          aria-hidden="true"
        >
          {/* Base Shield with Gradient */}
          <path
            d="M18 3L6 7.5V17C6 24.5 11.2 31.4 18 33C24.8 31.4 30 24.5 30 17V7.5L18 3Z"
            fill="url(#tli-shield-gradient)"
          />
          {/* Inner Shield Bezel */}
          <path
            d="M18 5.8L8.5 9.2V17C8.5 23 12.6 28.5 18 29.8C23.4 28.5 27.5 23 27.5 17V9.2L18 5.8Z"
            stroke={isDark ? "#93C5FD" : "#DBEAFE"}
            strokeWidth="1.2"
            fill="none"
          />
          {/* Silhouette Figure Head */}
          <circle cx="18" cy="13.5" r="2.2" fill="#FFFFFF" />
          {/* Silhouette Figure Shoulders */}
          <path
            d="M13.5 22.5C13.5 20 15.5 18.5 18 18.5C20.5 18.5 22.5 20 22.5 22.5V23.5H13.5V22.5Z"
            fill="#FFFFFF"
          />
          <defs>
            <linearGradient
              id="tli-shield-gradient"
              x1="6"
              y1="3"
              x2="30"
              y2="33"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#0066FF" />
              <stop offset="1" stopColor="#0047B3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="flex items-center gap-2.5">
        <span
          className={`font-sans font-bold tracking-tight leading-none ${sizeClasses.title} ${
            isDark ? "text-white" : "text-[#0B192C]"
          }`}
        >
          TLI
        </span>
        {showSubtitle && (
          <div className="flex flex-col justify-center border-l pl-2.5 border-slate-400/30 leading-none">
            <span
              className={`font-bold uppercase ${sizeClasses.sub1} ${
                isDark ? "text-slate-200" : "text-slate-800"
              }`}
            >
              Truth Labs
            </span>
            <span
              className={`font-semibold uppercase mt-0.5 ${sizeClasses.sub2} ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              International
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

