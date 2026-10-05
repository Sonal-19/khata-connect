export function ok<T>(data: T, message = "OK") {
  return { success: true as const, message, data };
}

export function fail(message: string) {
  return { success: false as const, message, data: null };
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const normalizeUsername = (u: string) =>
  u.trim().replace(/^@/, "").toLowerCase();

export const USERNAME_PATTERN = "^[a-z0-9_.]{3,16}$";

/** Not available for self-registration (admins can still assign them). */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "khata",
  "khataconnect",
  "system",
  "api",
  "null",
  "undefined",
]);

/** Postgres unique-constraint violation (also when wrapped by drizzle). */
export function isUniqueViolation(e: unknown) {
  const err = e as {
    code?: string;
    errno?: string;
    cause?: { code?: string; errno?: string };
  };
  return [err.code, err.errno, err.cause?.code, err.cause?.errno].includes(
    "23505",
  );
}
