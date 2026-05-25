import React from "react";

const styles = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100",
  error: "border-rose-200 bg-rose-50 text-rose-900 ring-1 ring-rose-100",
  info: "border-slate-200 bg-white text-slate-900 ring-1 ring-slate-100"
};

export default function Alert({ variant = "info", title, message, onClose }) {
  if (!title && !message) return null;
  return (
    <div
      className={`border rounded-xl px-4 py-3 ${styles[variant] || styles.info}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {title ? <div className="font-bold">{title}</div> : null}
          {message ? (
            <div className="text-sm mt-0.5 break-words">{message}</div>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            className="text-sm font-semibold underline underline-offset-2"
            onClick={onClose}
          >
            Đóng
          </button>
        ) : null}
      </div>
    </div>
  );
}

