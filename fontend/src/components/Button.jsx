import React from "react";

export default function Button({
  children,
  variant = "primary",
  loading,
  disabled,
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
    "focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[var(--gov-navy)] text-white hover:bg-[#19306f]",
    danger: "bg-[var(--gov-red)] text-white hover:bg-[#a31313]",
    ghost:
      "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
            aria-hidden="true"
          />
          <span>Đang xử lý...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

