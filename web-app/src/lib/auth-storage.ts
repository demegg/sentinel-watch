/**
 * Device-local profile storage — NOT a server auth system.
 *
 * At rest (localStorage): AES-GCM ciphertext only (key = PBKDF2 of passphrase).
 * No password hashes are stored. Active profile lives in sessionStorage for the tab.
 */

export interface AuthUser {
  email: string;
  name: string;
  /** Present only for legacy v1 records during migration. */
  salt?: string;
  hash?: string;
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

type VaultRecordV2 = {
  v: 2;
  salt: string;
  iv: string;
  ciphertext: string;
};

type VaultPayload = {
  name: string;
  sessionToken: string;
  createdAt: number;
  onboardingDone: boolean;
};

const USERS_KEY = "sw-users-v1";
const USERS_KEY_V2 = "sw-users-v2";
const SESSION_KEY = "sw-session-v2";
const PROFILE_KEY = "sw-profile-v2";
const LEGACY_SESSION_KEY = "sw-session-v1";

const MIN_PASSWORD_LEN = 10;
const AUTH_FAIL = "Invalid email or password.";
const PBKDF2_ITERATIONS = 210_000;

function placesKey(email: string) {
  return `sw-places-v1:${email.toLowerCase()}`;
}

function bufToHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes.buffer;
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

async function deriveBits(password: string, saltHex: string, iterations: number) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
}

async function deriveAesKey(password: string, saltHex: string) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVault(password: string, payload: VaultPayload): Promise<VaultRecordV2> {
  const salt = randomHex(16);
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  return {
    v: 2,
    salt,
    iv: bufToHex(ivBytes.buffer),
    ciphertext: bufToHex(cipher),
  };
}

async function decryptVault(
  password: string,
  record: VaultRecordV2
): Promise<VaultPayload | null> {
  try {
    const key = await deriveAesKey(password, record.salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(hexToBuf(record.iv)) },
      key,
      hexToBuf(record.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plain)) as VaultPayload;
  } catch {
    return null;
  }
}

async function verifyLegacyHash(password: string, salt: string, hash: string): Promise<boolean> {
  const bits = await deriveBits(password, salt, 120_000);
  return timingSafeEqual(bufToHex(bits), hash);
}

function readVaultMap(): Record<string, VaultRecordV2 | AuthUser> {
  if (typeof window === "undefined") return {};
  try {
    const v2 = localStorage.getItem(USERS_KEY_V2);
    if (v2) return JSON.parse(v2) as Record<string, VaultRecordV2 | AuthUser>;
    const v1 = localStorage.getItem(USERS_KEY);
    if (v1) return JSON.parse(v1) as Record<string, AuthUser>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeVaultMap(users: Record<string, VaultRecordV2 | AuthUser>) {
  localStorage.setItem(USERS_KEY_V2, JSON.stringify(users));
  localStorage.removeItem(USERS_KEY);
}

function isVaultV2(entry: VaultRecordV2 | AuthUser): entry is VaultRecordV2 {
  return (entry as VaultRecordV2).v === 2 && Boolean((entry as VaultRecordV2).ciphertext);
}

function readSession(): SessionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionPayload;
      if (parsed?.email && parsed?.token) return parsed;
    }
  } catch {
    /* ignore */
  }
  // Drop legacy persistent sessions (email+token in localStorage)
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  return null;
}

function writeSession(session: SessionPayload | null, profile: AuthUser | null = null) {
  if (typeof window === "undefined") return;
  if (session && profile) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

function readProfile(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as AuthUser;
    if (profile?.email && profile?.sessionToken) return profile;
  } catch {
    /* ignore */
  }
  return null;
}

export function getSessionEmail(): string | null {
  return readSession()?.email ?? null;
}

export function setSessionEmail(email: string | null) {
  if (!email) writeSession(null, null);
}

export function getUser(email: string): AuthUser | null {
  const profile = readProfile();
  if (profile && profile.email.toLowerCase() === email.toLowerCase()) return profile;
  return null;
}

export function getCurrentUser(): AuthUser | null {
  const session = readSession();
  const profile = readProfile();
  if (!session || !profile) {
    writeSession(null, null);
    return null;
  }
  if (profile.email.toLowerCase() !== session.email.toLowerCase()) {
    writeSession(null, null);
    return null;
  }
  if (!timingSafeEqual(profile.sessionToken, session.token)) {
    writeSession(null, null);
    return null;
  }
  return profile;
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

  const users = readVaultMap();
  if (users[email]) {
    return {
      ok: false,
      error: "Could not complete registration. If you already have an account, sign in.",
    };
  }

  const sessionToken = randomHex(32);
  const user: AuthUser = {
    email,
    name,
    sessionToken,
    createdAt: Date.now(),
    onboardingDone: false,
  };
  users[email] = await encryptVault(password, {
    name: user.name,
    sessionToken: user.sessionToken,
    createdAt: user.createdAt,
    onboardingDone: user.onboardingDone,
  });
  writeVaultMap(users);
  writeSession({ email, token: sessionToken }, user);
  return { ok: true, user };
}

export async function signIn(opts: {
  email: string;
  password: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase();
  const users = readVaultMap();
  const entry = users[email];

  if (!entry) {
    await deriveAesKey(opts.password, randomHex(16)).catch(() => undefined);
    return { ok: false, error: AUTH_FAIL };
  }

  let user: AuthUser | null = null;

  if (isVaultV2(entry)) {
    const payload = await decryptVault(opts.password, entry);
    if (!payload) return { ok: false, error: AUTH_FAIL };
    const onboard =
      payload.onboardingDone ||
      localStorage.getItem(`sw-onboard-v1:${email}`) === "1";
    user = {
      email,
      name: payload.name,
      sessionToken: payload.sessionToken,
      createdAt: payload.createdAt,
      onboardingDone: onboard,
    };
  } else if (entry.salt && entry.hash) {
    const ok = await verifyLegacyHash(opts.password, entry.salt, entry.hash);
    if (!ok) return { ok: false, error: AUTH_FAIL };
    user = {
      email,
      name: entry.name,
      sessionToken: entry.sessionToken || randomHex(32),
      createdAt: entry.createdAt,
      onboardingDone: entry.onboardingDone,
    };
  } else {
    return { ok: false, error: AUTH_FAIL };
  }

  const sessionToken = randomHex(32);
  const next: AuthUser = { ...user, sessionToken };
  users[email] = await encryptVault(opts.password, {
    name: next.name,
    sessionToken: next.sessionToken,
    createdAt: next.createdAt,
    onboardingDone: next.onboardingDone,
  });
  writeVaultMap(users);
  writeSession({ email, token: sessionToken }, next);
  return { ok: true, user: next };
}

export function signOut() {
  writeSession(null, null);
}

export function markOnboardingDone(email: string) {
  const profile = getCurrentUser();
  if (!profile || profile.email.toLowerCase() !== email.toLowerCase()) return;
  const next = { ...profile, onboardingDone: true };
  const session = readSession();
  if (session) writeSession(session, next);

  // Best-effort vault update: rewrite ciphertext requires passphrase, so store a
  // non-secret onboard flag that sign-in merges on next decrypt.
  try {
    localStorage.setItem(`sw-onboard-v1:${email.toLowerCase()}`, "1");
  } catch {
    /* ignore */
  }
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
  const onboardFlag =
    typeof window !== "undefined" &&
    localStorage.getItem(`sw-onboard-v1:${user.email.toLowerCase()}`) === "1";
  return {
    email: user.email,
    name: user.name,
    onboardingDone: user.onboardingDone || onboardFlag,
    createdAt: user.createdAt,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomHex(6)}`;
}

export { MIN_PASSWORD_LEN };
