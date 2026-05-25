/** @typedef {'weak' | 'medium' | 'strong'} PasswordStrengthLevel */

const SPECIAL_RE = /[^A-Za-z0-9]/;

export function passwordHasUppercase(value) {
  return /[A-Z]/.test(value);
}

export function passwordHasLowercase(value) {
  return /[a-z]/.test(value);
}

export function passwordHasDigit(value) {
  return /\d/.test(value);
}

export function passwordHasSpecial(value) {
  return SPECIAL_RE.test(value);
}

/** Chỉ gồm chữ thường và/hoặc số (không hoa, không ký tự đặc biệt). */
export function isOnlyLowercaseAndNumbers(value) {
  if (!value) return false;
  return /^[a-z0-9]+$/.test(value);
}

export function countPasswordFactors(value) {
  let count = 0;
  if (passwordHasUppercase(value)) count += 1;
  if (passwordHasLowercase(value)) count += 1;
  if (passwordHasDigit(value)) count += 1;
  if (passwordHasSpecial(value)) count += 1;
  return count;
}

/**
 * - Yếu: < 6 ký tự HOẶC chỉ chữ thường/số
 * - Mạnh: ≥ 8 ký tự, đủ hoa + thường + số + ký tự đặc biệt
 * - Trung bình: ≥ 6 ký tự, ≥ 2 trong 4 yếu tố (và không đạt Mạnh)
 * @param {string} value
 * @returns {PasswordStrengthLevel | null}
 */
export function getPasswordStrength(value) {
  if (!value) return null;

  if (value.length < 6 || isOnlyLowercaseAndNumbers(value)) {
    return "weak";
  }

  const hasAllTypes =
    passwordHasUppercase(value) &&
    passwordHasLowercase(value) &&
    passwordHasDigit(value) &&
    passwordHasSpecial(value);

  if (value.length >= 8 && hasAllTypes) {
    return "strong";
  }

  if (value.length >= 6 && countPasswordFactors(value) >= 2) {
    return "medium";
  }

  return "weak";
}

export const PASSWORD_STRENGTH_META = {
  weak: {
    label: "Yếu",
    barClass: "bg-red-500",
    textClass: "text-red-700",
    width: "33%"
  },
  medium: {
    label: "Trung bình",
    barClass: "bg-orange-500",
    textClass: "text-orange-700",
    width: "66%"
  },
  strong: {
    label: "Mạnh",
    barClass: "bg-green-500",
    textClass: "text-green-700",
    width: "100%"
  }
};

export function getRegisterPasswordError(value) {
  if (!value) return null;
  const strength = getPasswordStrength(value);
  if (strength !== "weak") return null;
  if (value.length < 6) {
    return "Mật khẩu phải có ít nhất 6 ký tự";
  }
  return "Mật khẩu quá yếu. Cần kết hợp ít nhất 2 loại: chữ hoa, chữ thường, số, ký tự đặc biệt.";
}

/**
 * @param {string} value
 * @returns {Array<{ id: string, label: string, met: boolean }>}
 */
export function getPasswordRequirementItems(value) {
  const safe = value || "";
  const hasMinMedium = safe.length >= 6;
  const hasMinStrong = safe.length >= 8;

  let lengthLabel =
    "Tối thiểu 6 ký tự (Trung bình) hoặc 8 ký tự (Mạnh)";
  if (hasMinStrong) {
    lengthLabel = "Tối thiểu 8 ký tự (Mạnh)";
  } else if (hasMinMedium) {
    lengthLabel = "Tối thiểu 6 ký tự (Trung bình)";
  }

  return [
    { id: "length", label: lengthLabel, met: hasMinMedium },
    { id: "uppercase", label: "Có chứa chữ hoa", met: passwordHasUppercase(safe) },
    { id: "lowercase", label: "Có chứa chữ thường", met: passwordHasLowercase(safe) },
    { id: "digit", label: "Có chứa chữ số", met: passwordHasDigit(safe) },
    {
      id: "special",
      label: "Có chứa ít nhất 1 ký tự đặc biệt",
      met: passwordHasSpecial(safe)
    }
  ];
}

export function getPasswordRequirementProgress(value) {
  const items = getPasswordRequirementItems(value);
  const metCount = items.filter((item) => item.met).length;
  return {
    metCount,
    total: items.length,
    percent: Math.round((metCount / items.length) * 100)
  };
}
