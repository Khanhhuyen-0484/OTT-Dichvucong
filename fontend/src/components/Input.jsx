import React from "react";

export default function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}) {
  const inputId = id || props.name || undefined;
  const describedBy = [
    hint ? `${inputId}-hint` : null,
    error ? `${inputId}-error` : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-semibold">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={
          "w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200 " +
          "placeholder:text-slate-400 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] " +
          (error ? "ring-rose-300 focus:ring-rose-200 " : "") +
          className
        }
        {...props}
      />
      {hint ? (
        <div id={`${inputId}-hint`} className="text-xs text-slate-600">
          {hint}
        </div>
      ) : null}
      {error ? (
        <div id={`${inputId}-error`} className="text-xs font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

