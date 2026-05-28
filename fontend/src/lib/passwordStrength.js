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

/** Chỉ gồm chữ thường và/hoặc số, không có chữ hoa hoặc ký tự đặc biệt. */
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
 * - Yếu: < 8 ký tự hoặc chỉ có chữ thường/số
 * - Mạnh: đủ 8 ký tự, có chữ hoa + thường + số + ký tự đặc biệt
 * - Trung bình: đủ 8 ký tự, có 2 trong 4 yếu tố và chưa đạt Mạnh
 * @param {string} value
 * @returns {PasswordStrengthLevel | null}
 */
export function getPasswordStrength(value) {
  if (!value) return null;

  if (value.length < 8 || isOnlyLowercaseAndNumbers(value)) {
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

  if (value.length >= 8 && countPasswordFactors(value) >= 2) {
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
  if (value.length < 8) {
    return "Mật khẩu phải có ít nhất 8 ký tự";
  }
  if (getPasswordStrength(value) !== "strong") {
    return "Mật khẩu phải đủ các điều kiện: chữ hoa, chữ thường, chữ số và ký tự đặc biệt.";
  }
  return null;
}

/**
 * @param {string} value
 * @returns {Array<{ id: string, label: string, met: boolean }>}
 */
export function getPasswordRequirementItems(value) {
  const safe = value || "";
  const hasMinStrong = safe.length >= 8;
  const lengthLabel = "Tối thiểu 8 ký tự";

  return [
    { id: "length", label: lengthLabel, met: hasMinStrong },
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
