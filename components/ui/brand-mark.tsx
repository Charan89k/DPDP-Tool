import React from "react";

interface BrandMarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: "h-7 w-auto", word: "text-lg", tag: "text-[9px]" },
  md: { mark: "h-9 w-auto", word: "text-2xl", tag: "text-[10px]" },
  lg: { mark: "h-11 w-auto", word: "text-3xl", tag: "text-[11px]" },
};

/**
 * CloudE5 brand mark: the company logo's cloud outline with a cube in front of it, and the
 * CloudE5 wordmark. `variant` selects colours for dark (navy) or light backgrounds.
 * The same emblem is the browser icon (app/icon.svg).
 */
export function BrandMark({
  variant = "light",
  size = "md",
  className = "",
  showTagline = false,
}: BrandMarkProps) {
  const isDark = variant === "dark";
  const s = SIZES[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg viewBox="2 4 44 36" className={`${s.mark} flex-shrink-0`} aria-hidden="true">
        <path
          d="M13 30.5a6.5 6.5 0 0 1-.9-12.94A9.8 9.8 0 0 1 30.6 13a7.6 7.6 0 0 1 8.9 6.3A5.7 5.7 0 0 1 36.5 30.5Z"
          fill="none"
          stroke={isDark ? "#CBD5E1" : "#334155"}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M24 17.2 33.4 22.6v10.8L24 38.8l-9.4-5.4V22.6Z" fill="#3B7DD8" />
        <path d="M24 21.2 30 24.6v6.8L24 34.8l-6-3.4v-6.8Z" fill="#FFFFFF" />
        <path d="M18 24.6 24 28l6-3.4M24 28v6.8" fill="none" stroke="#3B7DD8" strokeWidth="1.7" strokeLinejoin="round" />
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
