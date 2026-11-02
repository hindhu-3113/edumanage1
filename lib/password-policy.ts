export function validatePassword(password: string): string | null {
  if (password.length < 12 || password.length > 128) {
    return "Password must be between 12 and 128 characters.";
  }
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return "Password must include lowercase, uppercase, numeric, and special characters.";
  }
  return null;
}
