import React from "react";

interface BrandMarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: "h-8 w-auto", word: "text-lg", name: "text-[10px]", tag: "text-[9px]" },
  md: { mark: "h-10 w-auto", word: "text-2xl", name: "text-[11px]", tag: "text-[10px]" },
  lg: { mark: "h-12 w-auto", word: "text-3xl", name: "text-xs", tag: "text-[11px]" },
};

/** The shield emblem alone; the same artwork is the browser icon (app/icon.svg). */
export function BrandEmblem({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true">
      <path d="M20 2 37 8v12.5C37 31 29.8 38.6 20 42 10.2 38.6 3 31 3 20.5V8Z" fill="#0B3B6F" />
      <path
        d="M20 5.4 34 10.3v10.2C34 29.2 28.2 35.6 20 38.6 11.8 35.6 6 29.2 6 20.5V10.3Z"
        fill="none"
        stroke={dark ? "#60A5FA" : "#3B82F6"}
        strokeWidth="1.4"
      />
      <path d="M11.5 15h8M15.5 15v12M21.5 15v12h5M29.5 15v12" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Truth Labs International brand mark: the shield emblem with the TLI monogram, the TLI wordmark
 * and the full company name. `variant` selects colours for dark (navy) or light backgrounds.
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
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} role="img" aria-label="Truth Labs International">
      <BrandEmblem className={`${s.mark} flex-shrink-0`} dark={isDark} />
      <span className="flex flex-col leading-none" aria-hidden="true">
        <span className={`${s.word} font-bold tracking-tight ${isDark ? "text-white" : "text-[#0B192C]"}`}>TLI</span>
        <span className={`${s.name} mt-0.5 font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          Truth Labs International
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
