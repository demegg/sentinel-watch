/** Returns true when most characters are basic Latin letters/digits/punctuation. */
export function isMostlyLatin(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const latin = (trimmed.match(/[A-Za-z0-9\s.,'()\-/&]/g) ?? []).join("").length;
  return latin / trimmed.length >= 0.55;
}

/**
 * Prefer English labels embedded in mixed-language strings, e.g.
 * "თბილისი FM (Tbilisi FM)" → "Tbilisi FM"
 */
export function toEnglishLabel(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const paren = trimmed.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1] && isMostlyLatin(paren[1])) return paren[1].trim();

  const dash = trimmed.match(/[-–—]\s*([A-Za-z0-9][^-\u0080-\uFFFF]*)$/);
  if (dash?.[1] && isMostlyLatin(dash[1])) return dash[1].trim();

  if (isMostlyLatin(trimmed)) return trimmed;

  const latinChunks = trimmed.match(/[A-Za-z][A-Za-z0-9\s.'&/-]*/g);
  if (latinChunks?.length) {
    const joined = latinChunks.map((s) => s.trim()).filter((s) => s.length > 1).join(" ");
    if (joined.length >= 3) return joined;
  }

  const asciiOnly = trimmed.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  return asciiOnly || trimmed;
}

export function englishRadioName(name: string, country?: string, index = 0): string {
  const label = toEnglishLabel(name);
  if (isMostlyLatin(label)) return label;
  const base = country ? `${country} Radio` : "Radio station";
  return index > 0 ? `${base} ${index + 1}` : base;
}

export function englishCountryName(country: string): string {
  return toEnglishLabel(country);
}
