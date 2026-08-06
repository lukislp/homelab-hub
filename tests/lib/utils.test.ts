import { describe, it, expect, afterEach, vi } from "vitest";
import { cn, hostFromUrl, slugify, normalizeUrl, isValidHttpUrl, monogram, uid, pad2 } from "../../src/lib/utils";

describe("cn", () => {
  it("joins truthy class values and drops falsy ones (thin clsx wrapper)", () => {
    expect(cn("a", false, "b", undefined, null, "c")).toBe("a b c");
  });
});

describe("hostFromUrl", () => {
  it("strips the scheme and keeps host + non-root path", () => {
    expect(hostFromUrl("https://grafana.home.lab:3000/d/xyz")).toBe("grafana.home.lab:3000/d/xyz");
  });

  it("omits the path when it's just /", () => {
    expect(hostFromUrl("http://example.com/")).toBe("example.com");
  });

  it("returns the raw input unchanged when it isn't a valid URL", () => {
    expect(hostFromUrl("not a url")).toBe("not a url");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates whitespace", () => {
    expect(slugify("Smart Home")).toBe("smart-home");
  });

  it("collapses punctuation runs and strips leading/trailing hyphens", () => {
    expect(slugify("--Media!!--")).toBe("media");
  });

  it("truncates to 40 chars", () => {
    const long = "a".repeat(60);
    expect(slugify(long)).toHaveLength(40);
  });

  it("falls back to 'misc' for symbol-only or empty input", () => {
    expect(slugify("???")).toBe("misc");
    expect(slugify("")).toBe("misc");
  });
});

describe("normalizeUrl", () => {
  it("leaves http/https URLs untouched", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("HTTP://example.com")).toBe("HTTP://example.com");
  });

  it("prefixes scheme-less input with http://", () => {
    expect(normalizeUrl("example.com")).toBe("http://example.com");
  });

  it("trims surrounding whitespace before checking/prefixing", () => {
    expect(normalizeUrl("  example.com  ")).toBe("http://example.com");
  });

  it("passes empty/whitespace-only input through unchanged", () => {
    expect(normalizeUrl("   ")).toBe("");
  });
});

describe("isValidHttpUrl", () => {
  it.each([
    ["http://example.com", true],
    ["https://example.com:8080/path", true],
    ["ftp://example.com", false],
    ["javascript:alert(1)", false],
    ["//example.com", false],
    ["", false],
    ["not a url", false],
  ])("isValidHttpUrl(%j) -> %s", (input, expected) => {
    expect(isValidHttpUrl(input)).toBe(expected);
  });
});

describe("monogram", () => {
  it("uses the first two letters of a single word", () => {
    expect(monogram("Grafana")).toBe("GR");
  });

  it("uses the first letter of the first two words", () => {
    expect(monogram("Home Assistant")).toBe("HA");
  });

  it("ignores extra whitespace between words", () => {
    expect(monogram("  Uptime   Kuma  ")).toBe("UK");
  });

  it("falls back to '??' for empty/whitespace-only input", () => {
    expect(monogram("")).toBe("??");
    expect(monogram("   ")).toBe("??");
  });
});

describe("uid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces non-empty, unique ids across calls", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("falls back to a manual id when crypto.randomUUID isn't a function (insecure/plain-http context)", () => {
    vi.stubGlobal("crypto", {
      randomUUID: undefined,
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    const id = uid();

    expect(id).toMatch(/^id-[0-9a-f]{20}$/);
  });

  it("falls back to a manual id when crypto.randomUUID throws (insecure context that still exposes the function)", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new DOMException("insecure context", "SecurityError");
      },
      getRandomValues: crypto.getRandomValues.bind(crypto),
    });

    const id = uid();

    expect(id).toMatch(/^id-[0-9a-f]{20}$/);
  });
});

describe("pad2", () => {
  it("zero-pads single digits", () => {
    expect(pad2(5)).toBe("05");
    expect(pad2(0)).toBe("00");
  });

  it("leaves two-digit numbers alone", () => {
    expect(pad2(42)).toBe("42");
  });
});
