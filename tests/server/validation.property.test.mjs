// Property-based tests for validateData (fast-check): the schema validator is the only thing
// standing between an arbitrary PUT /api/data body and the persisted links.json, so it must
// (1) never throw, whatever shape it gets, (2) accept every document that satisfies the schema
// and (3) reject every single-field corruption of such a document.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validateData } from "../../server/app.mjs";

const slug = fc.stringMatching(/^[a-z0-9-]{1,40}$/);
const shortText = (max) => fc.string({ minLength: 1, maxLength: max }).filter((s) => s.trim().length > 0);
// Hostname labels start with a letter: WHATWG URL parsing treats an all-digit last label as an
// IPv4 address and rejects hosts like "a.0", which would be a generator bug, not a validator bug.
const httpUrl = fc
  .tuple(fc.constantFrom("http", "https"), fc.stringMatching(/^[a-z][a-z0-9]{0,15}(\.[a-z][a-z0-9]{0,9}){0,3}$/))
  .map(([scheme, host]) => `${scheme}://${host}`);

const category = slug.chain((id) => fc.record({ id: fc.constant(id), label: shortText(40) }));

function linkFor(categoryIds) {
  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 64 }),
    name: shortText(80),
    url: httpUrl,
    description: fc.option(fc.string({ maxLength: 240 }), { nil: undefined }),
    category: fc.constantFrom(...categoryIds),
    icon: fc.oneof(
      fc.constant({ type: "favicon" }),
      fc.constant({ type: "monogram" }),
      slug.map((name) => ({ type: "lucide", name })),
    ),
    checkEnabled: fc.boolean(),
    statusUrl: fc.option(httpUrl, { nil: undefined }),
  });
}

const validDocument = fc
  .uniqueArray(category, { minLength: 1, maxLength: 8, selector: (c) => c.id })
  .chain((categories) =>
    fc.record({
      version: fc.constant(1),
      settings: fc.record({
        title: shortText(80),
        subtitle: fc.option(fc.string({ maxLength: 120 }), { nil: undefined }),
      }),
      categories: fc.constant(categories),
      links: fc.uniqueArray(linkFor(categories.map((c) => c.id)), { maxLength: 20, selector: (l) => l.id }),
    }),
  );

describe("validateData (property-based)", () => {
  it("never throws, whatever it is given", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = validateData(input);
        expect(result === null || typeof result === "string").toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it("accepts every document that satisfies the schema", () => {
    fc.assert(
      fc.property(validDocument, (doc) => {
        expect(validateData(doc)).toBeNull();
      }),
      { numRuns: 500 },
    );
  });

  it("rejects a valid document once one link points at an unknown category", () => {
    fc.assert(
      fc.property(validDocument.filter((d) => d.links.length > 0), fc.nat(), (doc, pick) => {
        const links = doc.links.map((l) => ({ ...l }));
        links[pick % links.length].category = "no-such-category";
        expect(validateData({ ...doc, links })).toMatch(/category unknown/);
      }),
      { numRuns: 300 },
    );
  });

  it("rejects a valid document once two links share an id", () => {
    fc.assert(
      fc.property(validDocument.filter((d) => d.links.length > 1), (doc) => {
        const links = doc.links.map((l) => ({ ...l }));
        links[1].id = links[0].id;
        expect(validateData({ ...doc, links })).toMatch(/duplicate link id/);
      }),
      { numRuns: 300 },
    );
  });
});
