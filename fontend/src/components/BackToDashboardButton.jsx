import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackToDashboardButton({
  to: _to,
  label = "Quay lại",
  variant = "default",
  className = "",
  showBackIcon: _showBackIcon,
  ...props
}) {
  const navigate = useNavigate();
  const styles = {
    default: "bg-[#003366] text-white hover:opacity-95 shadow-sm",
    soft: "bg-blue-50 text-[#1d4ed8] hover:bg-blue-100 ring-1 ring-blue-100",
    ghost: "bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200",
  };

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none ${styles[variant] || styles.default} ${className}`}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
