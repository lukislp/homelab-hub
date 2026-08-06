import { describe, it, expect } from "vitest";
import { isHttpUrl, validateData, seedData } from "../../server/app.mjs";

describe("isHttpUrl", () => {
  it.each([
    ["http://example.com", true],
    ["https://example.com:8443/path?x=1", true],
    ["ftp://example.com", false],
    ["javascript:alert(1)", false],
    ["//example.com", false], // protocol-relative - no base URL to resolve against
    ["", false],
    ["not a url", false],
    ["   ", false],
  ])("isHttpUrl(%j) -> %s", (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });
});

describe("validateData", () => {
  const validDoc = () => ({
    version: 1,
    settings: { title: "My Hub", subtitle: "sub" },
    categories: [{ id: "infra", label: "Infra" }],
    links: [
      {
        id: "l1",
        name: "Service",
        url: "https://service.home.lab",
        description: "desc",
        category: "infra",
        icon: { type: "lucide", name: "server" },
        checkEnabled: true,
        statusUrl: "http://service.internal:8080",
      },
    ],
  });

  it("accepts a well-formed document, including the real seedData()", () => {
    expect(validateData(validDoc())).toBeNull();
    expect(validateData(seedData())).toBeNull();
  });

  it.each([
    [null, "document must be an object"],
    [undefined, "document must be an object"],
    [[], "document must be an object"],
    ["nope", "document must be an object"],
  ])("rejects non-object documents: %j", (input, expectedMsg) => {
    expect(validateData(input)).toBe(expectedMsg);
  });

  it("rejects a version other than 1", () => {
    expect(validateData({ ...validDoc(), version: 2 })).toBe("version must be 1");
  });

  it("rejects a missing/blank settings.title", () => {
    const d = validDoc();
    d.settings.title = "   ";
    expect(validateData(d)).toBe("settings.title invalid");
  });

  it("rejects a title longer than 80 chars", () => {
    const d = validDoc();
    d.settings.title = "a".repeat(81);
    expect(validateData(d)).toBe("settings.title invalid");
  });

  it("rejects a category id that doesn't match the slug pattern", () => {
    const d = validDoc();
    d.categories = [{ id: "Not Valid!", label: "X" }];
    expect(validateData(d)).toMatch(/^category id invalid/);
  });

  it("rejects duplicate category ids", () => {
    const d = validDoc();
    d.categories = [{ id: "a", label: "A" }, { id: "a", label: "A2" }];
    expect(validateData(d)).toMatch(/^duplicate category id/);
  });

  it("rejects a link referencing an unknown category", () => {
    const d = validDoc();
    d.links[0].category = "does-not-exist";
    expect(validateData(d)).toMatch(/^link category unknown/);
  });

  it("rejects a link with a non-http(s) url", () => {
    const d = validDoc();
    d.links[0].url = "javascript:alert(1)";
    expect(validateData(d)).toMatch(/^link url invalid/);
  });

  it("rejects duplicate link ids", () => {
    const d = validDoc();
    d.links.push({ ...d.links[0] });
    expect(validateData(d)).toMatch(/^duplicate link id/);
  });

  it("rejects an unknown icon.type", () => {
    const d = validDoc();
    d.links[0].icon = { type: "emoji" };
    expect(validateData(d)).toMatch(/^link icon\.type invalid/);
  });

  it("rejects a lucide icon with an invalid name", () => {
    const d = validDoc();
    d.links[0].icon = { type: "lucide", name: "Not Valid!" };
    expect(validateData(d)).toMatch(/^link icon\.name invalid/);
  });

  it("rejects a non-boolean checkEnabled", () => {
    const d = validDoc();
    d.links[0].checkEnabled = "yes";
    expect(validateData(d)).toMatch(/^link checkEnabled invalid/);
  });

  it("rejects an invalid statusUrl", () => {
    const d = validDoc();
    d.links[0].statusUrl = "not a url";
    expect(validateData(d)).toMatch(/^link statusUrl invalid/);
  });
});
