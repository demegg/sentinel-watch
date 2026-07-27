/** Cleared when the browser tab / PWA session ends — landing replays on each open. */
export const LANDING_SESSION_KEY = "sw-entered";

export function markAppEntered() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(LANDING_SESSION_KEY, "1");
  }
}

export function hasEnteredAppThisSession() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LANDING_SESSION_KEY) === "1";
}
