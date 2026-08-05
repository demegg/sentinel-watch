/** Local-first auth + saved places. Free to run — no external auth service required. */

export interface AuthUser {
  email: string;
  name: string;
  salt: string;
  hash: string;
  /** Opaque session secret — required to claim this account client-side. */
  sessionToken: string;
  createdAt: number;
  onboardingDone: boolean;
}

export interface SavedPlace {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
  label?: string;
  addedAt: number;
}

type SessionPayload = { email: string; token: string };

const USERS_KEY = "sw-users-v1";
const SESSION_KEY = "sw-session-v2";
const LEGACY_SESSION_KEY = "sw-session-v1";

const MIN_PASSWORD_LEN = 10;
const AUTH_FAIL = "Invalid email or password.";

function placesKey(email: string) {
  return `sw-places-v1:${email.toLowerCase()}`;
}

function readUsers(): Record<string, AuthUser> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}") as Record<string, AuthUser>;
  } catch {
    return {};
  }
}

function writeUsers(users: Record<string, AuthUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function bufToHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes.buffer;
}

async function deriveHash(password: string, saltHex: string) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex),
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

function randomHex(bytes = 16) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return bufToHex(buf.buffer);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionPayload;
      if (parsed?.email && parsed?.token) return parsed;
    }
  } catch {
    /* ignore */
  }
  // Drop legacy forgeable email-only sessions
  localStorage.removeItem(LEGACY_SESSION_KEY);
  return null;
}

function writeSession(session: SessionPayload | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

/** Ensure older local accounts get a session token field. */
function ensureSessionToken(user: AuthUser): AuthUser {
  if (user.sessionToken && user.sessionToken.length >= 32) return user;
  const users = readUsers();
  const next = { ...user, sessionToken: randomHex(32) };
  users[user.email.toLowerCase()] = next;
  writeUsers(users);
  return next;
}

export function getSessionEmail(): string | null {
  return readSession()?.email ?? null;
}

export function setSessionEmail(email: string | null) {
  if (!email) {
    writeSession(null);
    return;
  }
  // Prefer rotating via signIn/signUp; this helper only clears or no-ops without token.
  writeSession(null);
}

export function getUser(email: string): AuthUser | null {
  return readUsers()[email.toLowerCase()] ?? null;
}

export function getCurrentUser(): AuthUser | null {
  const session = readSession();
  if (!session) return null;
  const user = getUser(session.email);
  if (!user) {
    writeSession(null);
    return null;
  }
  const withToken = ensureSessionToken(user);
  if (!timingSafeEqual(withToken.sessionToken, session.token)) {
    writeSession(null);
    return null;
  }
  return withToken;
}

export async function signUp(opts: {
  email: string;
  password: string;
  name: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const name = opts.name.trim().slice(0, 60);
  const password = opts.password;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters." };
  if (password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }

  const users = readUsers();
  // Uniform message — do not confirm whether the email is registered.
  if (users[email]) {
    return {
      ok: false,
      error: "Could not complete registration. If you already have an account, sign in.",
    };
  }

  const salt = randomHex(16);
  const hash = await deriveHash(password, salt);
  const sessionToken = randomHex(32);
  const user: AuthUser = {
    email,
    name,
    salt,
    hash,
    sessionToken,
    createdAt: Date.now(),
    onboardingDone: false,
  };
  users[email] = user;
  writeUsers(users);
  writeSession({ email, token: sessionToken });
  return { ok: true, user };
}

export async function signIn(opts: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const user = getUser(email);
  if (!user) {
    // Dummy work to reduce timing oracle on missing accounts
    await deriveHash(opts.password, randomHex(16));
    return { ok: false, error: AUTH_FAIL };
  }
  const hash = await deriveHash(opts.password, user.salt);
  if (!timingSafeEqual(hash, user.hash)) {
    return { ok: false, error: AUTH_FAIL };
  }
  // Rotate session token on each login
  const sessionToken = randomHex(32);
  const users = readUsers();
  const next = { ...ensureSessionToken(user), sessionToken };
  users[email] = next;
  writeUsers(users);
  writeSession({ email, token: sessionToken });
  return { ok: true, user: next };
}

export function signOut() {
  writeSession(null);
}

export function markOnboardingDone(email: string) {
  const users = readUsers();
  const key = email.toLowerCase();
  if (!users[key]) return;
  users[key] = { ...users[key], onboardingDone: true };
  writeUsers(users);
}

export function loadPlaces(email: string): SavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(placesKey(email));
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedPlace[];
    return Array.isArray(list) ? list.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function savePlaces(email: string, places: SavedPlace[]) {
  localStorage.setItem(placesKey(email), JSON.stringify(places.slice(0, 12)));
}

export function publicUser(user: AuthUser) {
  return {
    email: user.email,
    name: user.name,
    onboardingDone: user.onboardingDone,
    createdAt: user.createdAt,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomHex(6)}`;
}

export { MIN_PASSWORD_LEN };
