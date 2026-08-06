import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData, HealthResponse, LinkStatus } from "../../src/types";

const api = vi.hoisted(() => ({
  getData: vi.fn(),
  getHealth: vi.fn(),
  putData: vi.fn(),
}));

// vi.mock's relative path resolves against this test file, but it resolves to the same
// absolute src/lib/api.ts module that src/store/dashboard.ts imports via "../lib/api".
vi.mock("../../src/lib/api", () => api);

const { useDashboard } = await import("../../src/store/dashboard");

const baseDoc = (): DashboardData => ({
  version: 1,
  settings: { title: "t" },
  categories: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  links: [
    { id: "l1", name: "One", url: "http://one.test", category: "a", icon: { type: "monogram" }, checkEnabled: true },
    { id: "l2", name: "Two", url: "http://two.test", category: "a", icon: { type: "monogram" }, checkEnabled: true },
    { id: "l3", name: "Three", url: "http://three.test", category: "b", icon: { type: "monogram" }, checkEnabled: true },
  ],
});

const healthOk = (readOnly = false): HealthResponse => ({ ok: true, version: "x", uptime: 1, readOnly });

beforeEach(async () => {
  vi.useFakeTimers();
  api.getData.mockReset();
  api.getHealth.mockReset();
  api.putData.mockReset();
  api.getData.mockResolvedValue(baseDoc());
  api.getHealth.mockResolvedValue(healthOk());
  api.putData.mockResolvedValue({ ok: true });

  useDashboard.setState({
    loadError: null,
    readOnly: false,
    statuses: {},
    sweepAt: null,
    saving: "idle",
    filterCategory: null,
    query: "",
    editMode: false,
    modal: null,
    lastDragEndAt: 0,
  });
  // Populates both `data` and the module-private `lastSynced` consistently, so rollback
  // assertions later have a well-defined "last acknowledged state" to roll back to.
  await useDashboard.getState().load();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("load()", () => {
  it("loads data and the readOnly flag from the API", async () => {
    const doc = baseDoc();
    api.getData.mockResolvedValue(doc);
    api.getHealth.mockResolvedValue(healthOk(true));

    await useDashboard.getState().load();

    expect(useDashboard.getState().data).toEqual(doc);
    expect(useDashboard.getState().readOnly).toBe(true);
  });

  it("records a loadError but still resolves readOnly when getData fails", async () => {
    api.getData.mockRejectedValue(new Error("boom"));
    api.getHealth.mockResolvedValue(healthOk(false));

    await useDashboard.getState().load();

    expect(useDashboard.getState().loadError).toBe("boom");
    expect(useDashboard.getState().readOnly).toBe(false);
  });

  it("defaults readOnly to false when the health endpoint is unreachable", async () => {
    api.getData.mockResolvedValue(baseDoc());
    api.getHealth.mockRejectedValue(new Error("unreachable"));

    await useDashboard.getState().load();

    expect(useDashboard.getState().readOnly).toBe(false);
  });

  it("stringifies a non-Error rejection instead of reading a nonexistent .message", async () => {
    api.getData.mockRejectedValue("plain string failure"); // e.g. a rejected fetch Response, not an Error
    api.getHealth.mockResolvedValue(healthOk());

    await useDashboard.getState().load();

    expect(useDashboard.getState().loadError).toBe("plain string failure");
  });
});

describe("simple setters", () => {
  it("setStatuses replaces statuses + sweepAt together", () => {
    const status: LinkStatus = { state: "online", latencyMs: 12, httpStatus: 200, checkedAt: "2026-01-01T00:00:00Z" };
    useDashboard.getState().setStatuses({ l1: status }, "2026-01-01T00:00:00Z");
    expect(useDashboard.getState().statuses).toEqual({ l1: status });
    expect(useDashboard.getState().sweepAt).toBe("2026-01-01T00:00:00Z");
  });

  it("setFilterCategory sets/clears the active filter", () => {
    useDashboard.getState().setFilterCategory("a");
    expect(useDashboard.getState().filterCategory).toBe("a");
    useDashboard.getState().setFilterCategory(null);
    expect(useDashboard.getState().filterCategory).toBeNull();
  });

  it("setQuery updates the search query", () => {
    useDashboard.getState().setQuery("grafana");
    expect(useDashboard.getState().query).toBe("grafana");
  });

  it("toggleEditMode flips editMode", () => {
    expect(useDashboard.getState().editMode).toBe(false);
    useDashboard.getState().toggleEditMode();
    expect(useDashboard.getState().editMode).toBe(true);
    useDashboard.getState().toggleEditMode();
    expect(useDashboard.getState().editMode).toBe(false);
  });

  it("openModal/closeModal set and clear the modal state", () => {
    useDashboard.getState().openModal({ mode: "create", category: "a" });
    expect(useDashboard.getState().modal).toEqual({ mode: "create", category: "a" });
    useDashboard.getState().closeModal();
    expect(useDashboard.getState().modal).toBeNull();
  });

  it("markDragEnd records the current timestamp", () => {
    expect(useDashboard.getState().lastDragEndAt).toBe(0);
    useDashboard.getState().markDragEnd();
    expect(useDashboard.getState().lastDragEndAt).toBeGreaterThan(0);
  });
});

describe("category pruning (categories exist only through links)", () => {
  it("drops a category once its last link is deleted", () => {
    useDashboard.getState().deleteLink("l3"); // l3 is the only link in category "b"
    expect(useDashboard.getState().data!.categories.map((c) => c.id)).toEqual(["a"]);
  });

  it("keeps a category that still has links", () => {
    useDashboard.getState().deleteLink("l1");
    expect(useDashboard.getState().data!.categories.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("clears filterCategory when the filtered category gets pruned away", () => {
    useDashboard.setState({ filterCategory: "b" });
    useDashboard.getState().deleteLink("l3");
    expect(useDashboard.getState().filterCategory).toBeNull();
  });

  it("keeps filterCategory when it still refers to a surviving category", () => {
    useDashboard.setState({ filterCategory: "a" });
    useDashboard.getState().deleteLink("l3");
    expect(useDashboard.getState().filterCategory).toBe("a");
  });
});

describe("upsertLink", () => {
  it("creates a new category from newCategoryLabel and assigns the link to it", () => {
    useDashboard.getState().upsertLink(
      { id: "l4", name: "Four", url: "http://four.test", category: "", icon: { type: "monogram" }, checkEnabled: true },
      "Smart Home!"
    );
    const d = useDashboard.getState().data!;
    expect(d.categories.some((c) => c.id === "smart-home")).toBe(true);
    expect(d.links.find((l) => l.id === "l4")!.category).toBe("smart-home");
  });

  it("updates an existing link in place instead of duplicating it", () => {
    useDashboard.getState().upsertLink({ ...baseDoc().links[0], name: "Renamed" });
    const d = useDashboard.getState().data!;
    expect(d.links.filter((l) => l.id === "l1")).toHaveLength(1);
    expect(d.links.find((l) => l.id === "l1")!.name).toBe("Renamed");
  });

  it("closes the modal after upserting", () => {
    useDashboard.setState({ modal: { mode: "create" } });
    useDashboard.getState().upsertLink(baseDoc().links[0]);
    expect(useDashboard.getState().modal).toBeNull();
  });

  it("reuses an existing category instead of creating a duplicate when the slug already matches", () => {
    // baseDoc already has category "a" labeled "A" - slugify("A") is also "a".
    useDashboard.getState().upsertLink(
      { id: "l4", name: "Four", url: "http://four.test", category: "", icon: { type: "monogram" }, checkEnabled: true },
      "A"
    );
    const d = useDashboard.getState().data!;
    expect(d.categories.filter((c) => c.id === "a")).toHaveLength(1);
    expect(d.links.find((l) => l.id === "l4")!.category).toBe("a");
  });
});

describe("mutations are a no-op before data has loaded", () => {
  it("mutate() (via deleteLink) does nothing when data is null", () => {
    useDashboard.setState({ data: null });
    expect(() => useDashboard.getState().deleteLink("l1")).not.toThrow();
    expect(useDashboard.getState().data).toBeNull();
    expect(api.putData).not.toHaveBeenCalled();
  });

  it("flushNow() (via retrySave) does nothing when data is null", async () => {
    useDashboard.setState({ data: null });
    useDashboard.getState().retrySave();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.putData).not.toHaveBeenCalled();
  });
});

describe("reorderLink", () => {
  it("reorders within the same category", () => {
    useDashboard.getState().reorderLink("l1", "l2");
    expect(useDashboard.getState().data!.links.map((l) => l.id)).toEqual(["l2", "l1", "l3"]);
  });

  it("is a no-op across different categories", () => {
    const before = useDashboard.getState().data!.links.map((l) => l.id);
    useDashboard.getState().reorderLink("l1", "l3");
    expect(useDashboard.getState().data!.links.map((l) => l.id)).toEqual(before);
  });

  it("is a no-op for unknown ids", () => {
    const before = useDashboard.getState().data!.links.map((l) => l.id);
    useDashboard.getState().reorderLink("l1", "ghost");
    expect(useDashboard.getState().data!.links.map((l) => l.id)).toEqual(before);
  });
});

describe("reorderCategory", () => {
  it("reorders whole categories", () => {
    useDashboard.getState().reorderCategory("a", "b");
    expect(useDashboard.getState().data!.categories.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("is a no-op for unknown category ids", () => {
    const before = useDashboard.getState().data!.categories.map((c) => c.id);
    useDashboard.getState().reorderCategory("a", "ghost");
    expect(useDashboard.getState().data!.categories.map((c) => c.id)).toEqual(before);
  });

  it("is a no-op when active and target are the same category", () => {
    const before = useDashboard.getState().data!.categories.map((c) => c.id);
    useDashboard.getState().reorderCategory("a", "a");
    expect(useDashboard.getState().data!.categories.map((c) => c.id)).toEqual(before);
  });
});

describe("read-only mode", () => {
  it("applies edits locally without ever calling putData", () => {
    useDashboard.setState({ readOnly: true });
    useDashboard.getState().deleteLink("l1");

    expect(useDashboard.getState().data!.links.some((l) => l.id === "l1")).toBe(false);
    expect(useDashboard.getState().saving).toBe("readonly");
    expect(api.putData).not.toHaveBeenCalled();
  });
});

describe("saving flow", () => {
  it("debounces and flushes an edit through putData", async () => {
    useDashboard.getState().deleteLink("l1");
    expect(useDashboard.getState().saving).toBe("idle"); // not yet flushed - still debouncing

    await vi.advanceTimersByTimeAsync(700);

    expect(api.putData).toHaveBeenCalledTimes(1);
    expect(useDashboard.getState().saving).toBe("saved");
  });

  it("rolls back to the last synced document when the flush fails", async () => {
    api.putData.mockRejectedValue(new Error("network down"));
    const before = useDashboard.getState().data;

    useDashboard.getState().deleteLink("l1");
    await vi.advanceTimersByTimeAsync(700);

    expect(useDashboard.getState().saving).toBe("error");
    expect(useDashboard.getState().data).toEqual(before);
  });

  it("retrySave() flushes immediately without waiting for the debounce", async () => {
    useDashboard.getState().deleteLink("l1");
    useDashboard.getState().retrySave();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.putData).toHaveBeenCalledTimes(1);
  });

  it("retrySave() flushes immediately even with no pending debounce timer scheduled yet", async () => {
    // No prior mutate() call, so flushNow's own internal flushTimer is still null -
    // covers the "nothing to clear" branch, distinct from the test above where deleteLink()
    // already scheduled one.
    useDashboard.getState().retrySave();
    await vi.advanceTimersByTimeAsync(0);

    expect(api.putData).toHaveBeenCalledTimes(1);
  });

  it("resets saving from 'saved' back to 'idle' after the 2.5s display window", async () => {
    useDashboard.getState().deleteLink("l1");
    await vi.advanceTimersByTimeAsync(700);
    expect(useDashboard.getState().saving).toBe("saved");

    await vi.advanceTimersByTimeAsync(2500);

    expect(useDashboard.getState().saving).toBe("idle");
  });

  it("does not overwrite a since-changed saving state when the 2.5s timer fires", async () => {
    useDashboard.getState().deleteLink("l1");
    await vi.advanceTimersByTimeAsync(700); // flush completes -> "saved", schedules the 2.5s reset
    expect(useDashboard.getState().saving).toBe("saved");

    // Simulate a new save having started in the meantime (saving is no longer "saved" by
    // the time the original timer fires) - the guard must leave this alone, not force "idle".
    useDashboard.setState({ saving: "saving" });

    await vi.advanceTimersByTimeAsync(2500);

    expect(useDashboard.getState().saving).toBe("saving");
  });
});
