export const PASSWORD_MIN = 8;

export function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < PASSWORD_MIN) {
    return `Mot de passe : minimum ${PASSWORD_MIN} caractères.`;
  }
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) {
    return "Mot de passe : au moins une lettre et un chiffre.";
  }
  return null;
}

export function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizePhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
