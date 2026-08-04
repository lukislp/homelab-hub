import { clsx, type ClassValue } from "clsx";

export const cn = (...args: ClassValue[]) => clsx(...args);

/** "https://grafana.home.lab:3000/d/xyz" -> "grafana.home.lab:3000/d/xyz" */
export function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "misc";
}

/** Prefix scheme-less input with http:// (homelab default). */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** crypto.randomUUID needs a secure context — plain-http homelab hosts don't have one. */
export function uid(): string {
  if (typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return "id-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** "Home Assistant" -> "HA", "Grafana" -> "GR" */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
