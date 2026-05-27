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

/** Ch?? g?"m ch? thu?ng v?/ho?c s?' (kh�ng hoa, kh�ng k? t? ?'?c bi??t). */
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
 * - Y?u: < 6 k? t? HO?C ch?? ch? thu?ng/s?'
 * - M?nh: ??? 8 k? t?, ?'? hoa + thu?ng + s?' + k? t? ?'?c bi??t
 * - Trung b?nh: ??? 6 k? t?, ??? 2 trong 4 y?u t?' (v? kh�ng ?'?t M?nh)
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
    label: "Y?u",
    barClass: "bg-red-500",
    textClass: "text-red-700",
    width: "33%"
  },
  medium: {
    label: "Trung b?nh",
    barClass: "bg-orange-500",
    textClass: "text-orange-700",
    width: "66%"
  },
  strong: {
    label: "M?nh",
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
    return "M�t kh�u ph?i c? ?t nh?t 6 k? t?";
  }
  return "M�t kh�u qu? y?u. C?n k�t h�p ?t nh?t 2 lo?i: ch? hoa, ch? thu?ng, s?', k? t? ?'?c bi??t.";
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
    "T?'i thi?fu 6 k? t? (Trung b?nh) ho?c 8 k? t? (M?nh)";
  if (hasMinStrong) {
    lengthLabel = "T?'i thi?fu 8 k? t? (M?nh)";
  } else if (hasMinMedium) {
    lengthLabel = "T?'i thi?fu 6 k? t? (Trung b?nh)";
  }

  return [
    { id: "length", label: lengthLabel, met: hasMinMedium },
    { id: "uppercase", label: "C? ch?a ch? hoa", met: passwordHasUppercase(safe) },
    { id: "lowercase", label: "C? ch?a ch? thu?ng", met: passwordHasLowercase(safe) },
    { id: "digit", label: "C? ch?a ch? s?'", met: passwordHasDigit(safe) },
    {
      id: "special",
      label: "C? ch?a ?t nh?t 1 k? t? ?'?c bi??t",
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
