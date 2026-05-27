import React, { useId, useMemo, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import {
  getPasswordRequirementItems,
  getPasswordRequirementProgress,
  getPasswordStrength,
  PASSWORD_STRENGTH_META
} from "../lib/passwordStrength.js";

function RequirementRow({ met, label }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
          met
            ? "border-green-500 bg-green-500"
            : "border-slate-300 bg-transparent"
        }`}
        aria-hidden="true"
      >
        {met ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
      </span>
      <span
        className={`text-sm leading-snug transition-colors duration-200 ${
          met ? "font-medium text-green-700" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </li>
  );
}

export default function RegisterPasswordField({
  label = "Mật khẩu",
  name = "password",
  value,
  onChange,
  error,
  required = false,
  autoComplete = "new-password",
  placeholder = "Nhập mật khẩu của bạn"
}) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const strength = getPasswordStrength(value);
  const requirements = useMemo(
    () => getPasswordRequirementItems(value),
    [value]
  );
  const progress = useMemo(
    () => getPasswordRequirementProgress(value),
    [value]
  );

  const strengthMeta = strength
    ? PASSWORD_STRENGTH_META[strength]
    : {
        label: "Chưa nhập",
        barClass: "bg-slate-300",
        textClass: "text-slate-500",
        width: "0%"
      };

  const barWidth = value
    ? `${Math.max(progress.percent, strength === "weak" ? 8 : 0)}%`
    : "0%";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-semibold">
          {label}
        </label>
        <div className="relative">
          <input
            id={inputId}
            name={name}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={
              "w-full rounded-xl bg-white py-2.5 pl-3 pr-11 text-sm ring-1 ring-slate-200 " +
              "placeholder:text-slate-400 focus:ring-2 focus:ring-[rgba(30,58,138,0.35)] " +
              (error ? "ring-rose-300 focus:ring-rose-200 " : "")
            }
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-800"
            aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            tabIndex={-1}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error ? (
          <div id={errorId} className="text-xs font-semibold text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600">Độ mạnh mật khẩu</span>
          <span className={`font-bold ${strengthMeta.textClass}`}>
            {strengthMeta.label}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label={`Độ mạnh mật khẩu: ${strengthMeta.label}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${strengthMeta.barClass}`}
            style={{ width: barWidth }}
          />
        </div>
      </div>

      <ul className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        {requirements.map((item) => (
          <RequirementRow key={item.id} met={item.met} label={item.label} />
        ))}
      </ul>
    </div>
  );
}
