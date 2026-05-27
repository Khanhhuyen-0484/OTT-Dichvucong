const SPECIAL_RE = /[^A-Za-z0-9]/;

function passwordHasUppercase(value) {
  return /[A-Z]/.test(value);
}

function passwordHasLowercase(value) {
  return /[a-z]/.test(value);
}

function passwordHasDigit(value) {
  return /\d/.test(value);
}

function passwordHasSpecial(value) {
  return SPECIAL_RE.test(value);
}

function isOnlyLowercaseAndNumbers(value) {
  if (!value) return false;
  return /^[a-z0-9]+$/.test(value);
}

function countPasswordFactors(value) {
  let count = 0;
  if (passwordHasUppercase(value)) count += 1;
  if (passwordHasLowercase(value)) count += 1;
  if (passwordHasDigit(value)) count += 1;
  if (passwordHasSpecial(value)) count += 1;
  return count;
}

function getPasswordStrength(value) {
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

function validateRegisterPassword(value) {
  if (!value || typeof value !== "string") {
    return { ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự" };
  }
  if (value.length < 6) {
    return { ok: false, message: "Mật khẩu phải có ít nhất 6 ký tự" };
  }
  if (getPasswordStrength(value) === "weak") {
    return {
      ok: false,
      message:
        "Mật khẩu quá yếu. Cần kết hợp ít nhất 2 loại: chữ hoa, chữ thường, số, ký tự đặc biệt."
    };
  }
  return { ok: true };
}

module.exports = {
  getPasswordStrength,
  validateRegisterPassword
};
