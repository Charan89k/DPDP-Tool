import React from "react";

interface BrandMarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: "w-7 h-7", word: "text-lg", tag: "text-[9px]" },
  md: { mark: "w-9 h-9", word: "text-2xl", tag: "text-[10px]" },
  lg: { mark: "w-11 h-11", word: "text-3xl", tag: "text-[11px]" },
};

/**
 * CloudE5 brand mark: a shield emblem enclosing a check, with the CloudE5 wordmark.
 * `variant` selects colours for dark (navy) or light backgrounds.
 */
export function BrandMark({
  variant = "light",
  size = "md",
  className = "",
  showTagline = false,
}: BrandMarkProps) {
  const isDark = variant === "dark";
  const s = SIZES[size];
  const gradientId = `cloude5-shield-${variant}-${size}`;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg viewBox="0 0 36 36" className={`${s.mark} flex-shrink-0`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="6" y1="3" x2="30" y2="33" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#0052CC" />
          </linearGradient>
        </defs>
        <path
          d="M18 2.5 31 7.4v9.7c0 8.2-5.4 14.6-13 16.9C10.4 31.7 5 25.3 5 17.1V7.4L18 2.5Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="m11.5 18.2 4.4 4.3 8.6-9"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span
          className={`${s.word} font-bold tracking-tight ${isDark ? "text-white" : "text-[#0B192C]"}`}
          aria-label="CloudE5"
        >
          Cloud<span className="text-[#3B82F6]">E5</span>
        </span>
        {showTagline && (
          <span
            className={`${s.tag} mt-1 font-semibold uppercase tracking-[0.18em] ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            DPDP Compliance
          </span>
        )}
      </span>
    </div>
  );
}
