import { describe, it, expect, vi, afterEach } from "vitest";
import http from "node:http";
import { EventEmitter } from "node:events";
import { probeOnce } from "../../server/app.mjs";

describe("probeOnce - branches only reachable via a mocked transport", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports online with httpStatus null when the response carries no statusCode (defensive ?? null fallback)", async () => {
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      const fakeReq = new EventEmitter();
      fakeReq.destroy = () => {};
      const fakeRes = new EventEmitter();
      fakeRes.statusCode = undefined;
      fakeRes.resume = () => {};
      queueMicrotask(() => cb(fakeRes));
      return fakeReq;
    });
    const result = await probeOnce("http://example.test/");
    expect(result.state).toBe("online");
    expect(result.httpStatus).toBeNull();
  });

  it("ignores a second (late) settle attempt once the first has already resolved", async () => {
    let fakeReq;
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      fakeReq = new EventEmitter();
      fakeReq.destroy = () => {};
      const fakeRes = new EventEmitter();
      fakeRes.statusCode = 200;
      fakeRes.resume = () => {};
      queueMicrotask(() => cb(fakeRes)); // settles first via the success path
      return fakeReq;
    });
    const result = await probeOnce("http://example.test/");
    expect(result.state).toBe("online");
    // A late 'error' after the promise already settled must be a no-op (the `settled` guard),
    // not throw or attempt to resolve/reject an already-settled promise.
    expect(() => fakeReq.emit("error", new Error("late error - must be ignored"))).not.toThrow();
  });

  it("falls back to err.name when err.code is absent", async () => {
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      const fakeReq = new EventEmitter();
      fakeReq.destroy = () => {};
      queueMicrotask(() => fakeReq.emit("error", { name: "WeirdError" }));
      return fakeReq;
    });
    const result = await probeOnce("http://example.test/");
    expect(result.error).toBe("WeirdError");
  });

  it("falls back to the literal 'ERROR' when the error has neither a code nor a name", async () => {
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      const fakeReq = new EventEmitter();
      fakeReq.destroy = () => {};
      queueMicrotask(() => fakeReq.emit("error", {}));
      return fakeReq;
    });
    const result = await probeOnce("http://example.test/");
    expect(result.error).toBe("ERROR");
  });
});

describe("probeOnce - https transport selection", () => {
  it("selects the https transport for https:// targets", async () => {
    const temp = http.createServer((_req, res) => res.end());
    await new Promise((resolve) => temp.listen(0, "127.0.0.1", resolve));
    const { port } = temp.address();
    await new Promise((r) => temp.close(r));

    const result = await probeOnce(`https://127.0.0.1:${port}/`);
    expect(result.state).toBe("offline"); // nothing listening - connection refused
  });
});
