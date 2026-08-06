import { describe, it, expect, afterEach } from "vitest";
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
});
