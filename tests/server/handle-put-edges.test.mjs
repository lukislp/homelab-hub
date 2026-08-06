import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { EventEmitter } from "node:events";
import { readBody, handlePut, requestHandler, setData } from "../../server/app.mjs";

function fakeReq(headers = {}) {
  const req = new EventEmitter();
  req.headers = headers;
  req.resume = () => {};
  return req;
}

function fakeRes() {
  return {
    statusCode: undefined,
    body: undefined,
    writeHead(code) {
      this.statusCode = code;
    },
    end(b) {
      this.body = b;
    },
  };
}

describe("readBody", () => {
  it("resolves with the concatenated body on a normal end", async () => {
    const req = fakeReq({});
    const p = readBody(req);
    req.emit("data", Buffer.from("hello "));
    req.emit("data", Buffer.from("world"));
    req.emit("end");
    await expect(p).resolves.toBe("hello world");
  });

  it("rejects immediately when the declared content-length exceeds the cap", async () => {
    const req = fakeReq({ "content-length": String(2 * 1024 * 1024) });
    await expect(readBody(req)).rejects.toMatchObject({ statusCode: 413 });
  });

  it("rejects once actual streamed bytes exceed the cap, even without a declared content-length", async () => {
    const req = fakeReq({});
    const p = readBody(req);
    req.emit("data", Buffer.alloc(1024 * 1024 + 1));
    await expect(p).rejects.toMatchObject({ statusCode: 413 });
    // Further events after the done guard trips must be no-ops, not a second settle attempt.
    req.emit("data", Buffer.from("more"));
    req.emit("end");
    expect(() => req.emit("error", new Error("late"))).not.toThrow();
  });

  it("rejects when the request itself errors mid-stream", async () => {
    const req = fakeReq({});
    const p = readBody(req);
    req.emit("data", Buffer.from("partial"));
    req.emit("error", new Error("socket hang up"));
    await expect(p).rejects.toThrow("socket hang up");
    // A late 'end' after the error must not resolve the already-rejected promise.
    req.emit("end");
  });
});

describe("handlePut - error paths driven directly", () => {
  beforeEach(() => {
    delete process.env.READ_ONLY;
  });

  it("rejects a PUT with no content-type header at all (not just a wrong one)", async () => {
    const req = fakeReq({});
    const res = fakeRes();
    await handlePut(req, res);
    expect(res.statusCode).toBe(415);
  });

  it("responds 400 when readBody rejects with a non-413 error (e.g. a dropped connection)", async () => {
    const req = fakeReq({ "content-type": "application/json" });
    const res = fakeRes();
    const p = handlePut(req, res);
    queueMicrotask(() => req.emit("error", new Error("socket hang up")));
    await p;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("socket hang up");
  });
});

describe("handlePut - oversized body via real HTTP", () => {
  let server;
  let base;

  beforeAll(async () => {
    server = http.createServer(requestHandler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
  });

  beforeEach(() => {
    setData({ version: 1, settings: { title: "t" }, categories: [], links: [] });
    delete process.env.READ_ONLY;
  });

  it("rejects a real oversized PUT body with 413", async () => {
    const bigBody = JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) });
    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(res.status).toBe(413);
  });
});
