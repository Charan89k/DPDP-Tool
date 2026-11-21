import React from "react";

interface BrandMarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: {
    mark: "h-8 w-auto",
    word: "text-[14px] tracking-[0.05em]",
    bar: "h-[2px] w-7 mt-0.5 mb-0.5",
    intl: "text-[8.5px] tracking-[0.24em]",
    tag: "text-[8px] tracking-[0.16em]",
    badge: "text-[9px] px-1.5 py-0.5",
  },
  md: {
    mark: "h-10 w-auto",
    word: "text-[17px] tracking-[0.06em]",
    bar: "h-[2.5px] w-9 mt-0.5 mb-0.5",
    intl: "text-[10px] tracking-[0.26em]",
    tag: "text-[9px] tracking-[0.18em]",
    badge: "text-[10px] px-2 py-0.5",
  },
  lg: {
    mark: "h-14 w-auto",
    word: "text-[22px] tracking-[0.07em]",
    bar: "h-[3px] w-12 mt-1 mb-0.5",
    intl: "text-[12px] tracking-[0.28em]",
    tag: "text-[10px] tracking-[0.20em]",
    badge: "text-[11px] px-2.5 py-0.5",
  },
};

/**
 * Truth Labs International official digital winged "T" emblem.
 * Uses high-resolution clean asset with cyan/teal and electric blue trust gradients.
 */
export function BrandEmblem({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/favicon-clean.png"
      alt="Truth Labs International emblem"
      aria-hidden="true"
      className={`object-contain flex-shrink-0 ${dark ? "drop-shadow-[0_2px_8px_rgba(44,179,196,0.35)]" : "drop-shadow-[0_2px_6px_rgba(6,20,91,0.12)]"} ${className}`}
    />
  );
}

/**
 * Truth Labs International official brand mark:
 * Official winged "T" emblem, high-contrast TRUTH LABS wordmark, cyan accent divider,
 * tracked INTERNATIONAL wordmark, and TLI indicator.
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
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      role="img"
      aria-label="Truth Labs International"
    >
      <BrandEmblem className={`${s.mark} flex-shrink-0`} dark={isDark} />
      <span className="flex flex-col leading-none" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className={`${s.word} font-extrabold ${isDark ? "text-white" : "text-[#06145B]"}`}>
            TRUTH LABS
          </span>
          <span className={`${s.badge} font-bold rounded bg-[#2CB3C4]/15 text-[#2CB3C4] border border-[#2CB3C4]/30 uppercase`}>TLI</span>
        </span>
        <span className={`${s.bar} bg-[#2CB3C4] rounded-full`} />
        <span className={`${s.intl} font-bold uppercase text-[#2CB3C4]`}>
          INTERNATIONAL
        </span>
        {showTagline && (
          <span
            className={`${s.tag} mt-1 font-semibold uppercase ${
              isDark ? "text-slate-400" : "text-[#223471]"
            }`}
          >
            DPDP Compliance
          </span>
        )}
      </span>
    </div>
  );
}
