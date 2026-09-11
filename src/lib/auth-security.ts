import { z } from "zod";

/** Strong-password policy enforced on signup and password reset. */
export const passwordSchema = z
  .string()
  .min(12, { message: "Use at least 12 characters" })
  .max(128, { message: "Password is too long" })
  .regex(/[a-z]/, { message: "Add a lowercase letter" })
  .regex(/[A-Z]/, { message: "Add an uppercase letter" })
  .regex(/[0-9]/, { message: "Add a number" })
  .regex(/[^A-Za-z0-9]/, { message: "Add a symbol" });

const COMMON = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin",
  "alaska",
];

export function passwordProblem(password: string): string | null {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Password is too weak";
  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word))) return "Avoid common words like this";
  return null;
}

/** 0-4 strength score for the meter. */
export function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export const emailSchema = z.string().trim().email().max(255);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: "Username needs at least 3 characters" })
  .max(24, { message: "Username is too long" })
  .regex(/^[a-z0-9_]+$/, { message: "Use letters, numbers and underscores only" });

/* ------------------------------------------------------------------ */
/* Brute-force throttle (per browser, backs up the server-side limits) */
/* ------------------------------------------------------------------ */

const KEY = "alaska.login.attempts";
const MAX_ATTEMPTS = 5;

type AttemptState = { count: number; lockedUntil: number };

function read(): AttemptState {
  if (typeof window === "undefined") return { count: 0, lockedUntil: 0 };
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "") as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function write(state: AttemptState) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

/** Seconds remaining in the current lockout, or 0 when sign-in is allowed. */
export function lockoutSeconds(): number {
  const { lockedUntil } = read();
  const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function recordFailedLogin(): number {
  const state = read();
  const count = (state.count ?? 0) + 1;
  // Exponential backoff after 5 failures: 30s, 60s, 120s … capped at 15 min.
  const over = count - MAX_ATTEMPTS;
  const lockedUntil =
    over >= 0 ? Date.now() + Math.min(30 * 2 ** over, 900) * 1000 : (state.lockedUntil ?? 0);
  write({ count, lockedUntil });
  return Math.max(MAX_ATTEMPTS - count, 0);
}

export function clearLoginAttempts() {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}
