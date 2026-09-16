/** Cyber Essentials: min 12 characters, or 8+ with deny list — we enforce min 12 + deny list. */
export const MIN_PASSWORD_LENGTH = 12;

/** Small built-in deny list of common passwords (lowercase). */
const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password123",
    "password1234",
    "123456789012",
    "1234567890123",
    "qwertyuiopas",
    "letmeinletmein",
    "welcome12345",
    "adminadmin12",
    "changeme1234",
    "iloveyou1234",
    "football1234",
    "monkey123456",
    "dragon123456",
    "master123456",
    "loginlogin12",
    "abc123abc123",
    "passw0rd1234",
    "cryptotrading",
    "papertrading1",
  ].map((p) => p.toLowerCase()),
);

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Choose a less common password";
  }
  return null;
}
