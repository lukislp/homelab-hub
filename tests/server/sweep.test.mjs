import { describe, it, expect, afterEach, vi } from "vitest";
import http from "node:http";
import { sweep, sweepSoon, setData, statuses, stopSweep } from "../../server/app.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const doc = (links) => ({
  version: 1,
  settings: { title: "t" },
  categories: [{ id: "c", label: "C" }],
  links,
});

describe("sweep", () => {
  let servers = [];

  afterEach(async () => {
    // sweep() always reschedules itself in its `finally` block - cancel that timer so it
    // doesn't fire mid another test and pollute `statuses`.
    stopSweep();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    servers = [];
    setData(null);
    statuses.clear();
  });

  it("probes only checkEnabled links and stores results keyed by link id", async () => {
    const online = await listen((_req, res) => {
      res.writeHead(200);
      res.end();
    });
    servers.push(online);
    const { port: onlinePort } = online.address();

    // A closed port to get a deterministic offline result.
    const temp = await listen((_req, res) => res.end());
    const { port: closedPort } = temp.address();
    await new Promise((r) => temp.close(r));

    setData(
      doc([
        { id: "a", name: "A", url: `http://127.0.0.1:${onlinePort}/`, category: "c", icon: { type: "monogram" }, checkEnabled: true },
        { id: "b", name: "B", url: `http://127.0.0.1:${closedPort}/`, category: "c", icon: { type: "monogram" }, checkEnabled: true },
        { id: "c-disabled", name: "C", url: "http://127.0.0.1:1/", category: "c", icon: { type: "monogram" }, checkEnabled: false },
      ])
    );

    await sweep();

    expect(statuses.get("a")?.state).toBe("online");
    expect(statuses.get("b")?.state).toBe("offline");
    expect(statuses.has("c-disabled")).toBe(false); // never probed - checkEnabled: false
  });

  it("prefers statusUrl over url as the probe target when set", async () => {
    const online = await listen((_req, res) => {
      res.writeHead(200);
      res.end();
    });
    servers.push(online);
    const { port } = online.address();

    setData(
      doc([
        {
          id: "a",
          name: "A",
          url: "http://127.0.0.1:1/", // would fail if probed
          statusUrl: `http://127.0.0.1:${port}/`,
          category: "c",
          icon: { type: "monogram" },
          checkEnabled: true,
        },
      ])
    );

    await sweep();
    expect(statuses.get("a")?.state).toBe("online");
  });

  it("drops stale statuses for links that no longer exist in the current data", async () => {
    setData(doc([]));
    statuses.set("ghost", { state: "online", latencyMs: 1, httpStatus: 200, checkedAt: "x" });

    await sweep();

    expect(statuses.has("ghost")).toBe(false);
  });

  it("sweepSoon triggers a sweep shortly after being called", async () => {
    const online = await listen((_req, res) => {
      res.writeHead(200);
      res.end();
    });
    servers.push(online);
    const { port } = online.address();

    setData(doc([{ id: "x", name: "X", url: `http://127.0.0.1:${port}/`, category: "c", icon: { type: "monogram" }, checkEnabled: true }]));

    sweepSoon();
    await new Promise((r) => setTimeout(r, 400));

    expect(statuses.get("x")?.state).toBe("online");
  }, 2000);

  it("collapses sweep()/sweepSoon() calls made while a sweep is already in flight into one fast re-sweep", async () => {
    let calls = 0;
    const slow = await listen((_req, res) => {
      calls += 1;
      setTimeout(() => {
        res.writeHead(200);
        res.end();
      }, 150);
    });
    servers.push(slow);
    const { port } = slow.address();

    setData(doc([{ id: "x", name: "X", url: `http://127.0.0.1:${port}/`, category: "c", icon: { type: "monogram" }, checkEnabled: true }]));

    const inFlight = sweep(); // sweeping = true for ~150ms
    await new Promise((r) => setTimeout(r, 20)); // let it actually start probing
    sweep(); // hits the `if (sweeping) { resweepRequested = true; return; }` guard
    sweepSoon(); // hits sweepSoon's matching guard
    await inFlight;
    expect(calls).toBe(1); // the collapsed re-sweep hasn't run yet - only the original sweep did

    // resweepRequested caused the reschedule delay to be 250ms instead of SWEEP_INTERVAL_MS -
    // wait past that for the collapsed re-sweep to actually fire and re-probe.
    await new Promise((r) => setTimeout(r, 400));
    expect(calls).toBeGreaterThanOrEqual(2);
  }, 3000);

  it("sweeps cleanly when no data has been loaded yet (data is null)", async () => {
    setData(null);
    await expect(sweep()).resolves.toBeUndefined();
    expect(statuses.size).toBe(0);
  });

  it("sweepSoon cancels a previously scheduled timer instead of stacking a second one", async () => {
    let calls = 0;
    const online = await listen((_req, res) => {
      calls += 1;
      res.writeHead(200);
      res.end();
    });
    servers.push(online);
    const { port } = online.address();
    setData(doc([{ id: "x", name: "X", url: `http://127.0.0.1:${port}/`, category: "c", icon: { type: "monogram" }, checkEnabled: true }]));

    sweepSoon(); // schedules a timer
    sweepSoon(); // sweepTimer is now truthy - exercises the clearTimeout(sweepTimer) branch
    await new Promise((r) => setTimeout(r, 400));

    expect(calls).toBe(1); // stacking calls didn't leak a second live timer
  });

  it("stopSweep() is a safe no-op when no timer is currently pending", () => {
    stopSweep(); // afterEach already cleared any timer from a prior test - sweepTimer is null here
    expect(() => stopSweep()).not.toThrow(); // calling it again is still a no-op, not an error
  });

  it("tolerates a timer object without .unref (e.g. non-Node runtimes) in both sweep() and sweepSoon()", async () => {
    const realSetTimeout = global.setTimeout;
    const withoutUnref = (fn, delay) => {
      const real = realSetTimeout(fn, delay);
      return new Proxy(real, { get: (target, prop) => (prop === "unref" ? undefined : target[prop]) });
    };

    setData(doc([]));

    vi.spyOn(global, "setTimeout").mockImplementationOnce(withoutUnref);
    await sweep(); // schedules its reschedule-timer via the unref-less proxy - covers sweep()'s branch

    vi.spyOn(global, "setTimeout").mockImplementationOnce(withoutUnref);
    sweepSoon(); // schedules via the unref-less proxy too - covers sweepSoon()'s branch
    await new Promise((r) => setTimeout(r, 250));

    vi.restoreAllMocks();
  });
});
