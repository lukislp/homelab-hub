import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { sendFile, serveStatic, requestHandler, DIST } from "../../server/app.mjs";

function fakeRes() {
  return {
    statusCode: undefined,
    headers: undefined,
    body: undefined,
    headersSent: false,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      this.headersSent = true;
    },
    end(b) {
      this.body = b;
    },
    destroy: vi.fn(),
  };
}

describe("sendFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("404s for a path that doesn't exist at all", async () => {
    const res = fakeRes();
    sendFile(res, path.join(DIST, "definitely-does-not-exist.html"), "/definitely-does-not-exist.html", "GET");
    await new Promise((r) => setTimeout(r, 30));
    expect(res.statusCode).toBe(404);
  });

  it("404s for a path that resolves to a directory rather than a file", async () => {
    await fsp.mkdir(DIST, { recursive: true });
    const res = fakeRes();
    sendFile(res, DIST, "/", "GET");
    await new Promise((r) => setTimeout(r, 30));
    expect(res.statusCode).toBe(404);
  });

  it("applies a long, immutable cache-control for paths under /assets/ (via a real ServerResponse - HEAD-only fake res can't support .pipe())", async () => {
    await fsp.mkdir(path.join(DIST, "assets"), { recursive: true });
    const file = path.join(DIST, "assets", "coverage-marker-asset.js");
    await fsp.writeFile(file, "console.log(1)");
    const server = http.createServer((req, res) => {
      sendFile(res, file, "/assets/coverage-marker-asset.js", req.method);
    });
    try {
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    } finally {
      await new Promise((r) => server.close(r));
      await fsp.rm(file, { force: true });
    }
  });

  it("skips the body for HEAD requests but still sets content headers", async () => {
    await fsp.mkdir(DIST, { recursive: true });
    const file = path.join(DIST, "coverage-marker-head.txt");
    await fsp.writeFile(file, "hello");
    try {
      const res = fakeRes();
      sendFile(res, file, "/coverage-marker-head.txt", "HEAD");
      await new Promise((r) => setTimeout(r, 30));
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-length"]).toBe(5);
      expect(res.body).toBeUndefined();
    } finally {
      await fsp.rm(file, { force: true });
    }
  });

  it("responds 500 when the stream errors before headers were (defensively) marked sent", async () => {
    await fsp.mkdir(DIST, { recursive: true });
    const file = path.join(DIST, "coverage-marker-err1.txt");
    await fsp.writeFile(file, "hello");
    try {
      const fakeStream = new EventEmitter();
      fakeStream.pipe = () => {};
      vi.spyOn(fs, "createReadStream").mockReturnValue(fakeStream);

      const res = fakeRes();
      // Real http.ServerResponse instances flip headersSent true synchronously inside
      // writeHead(), making the "!res.headersSent" branch effectively unreachable there - this
      // is exercised directly against a controlled fake res to cover that defensive branch.
      res.writeHead = (code, headers) => {
        res.statusCode = code;
        res.headers = headers;
      };
      sendFile(res, file, "/coverage-marker-err1.txt", "GET");
      await new Promise((r) => setTimeout(r, 20));
      fakeStream.emit("error", new Error("disk read failed"));
      await new Promise((r) => setTimeout(r, 20));
      expect(res.statusCode).toBe(500);
    } finally {
      await fsp.rm(file, { force: true });
    }
  });

  it("destroys the response when the stream errors after headers were already sent (the realistic case)", async () => {
    await fsp.mkdir(DIST, { recursive: true });
    const file = path.join(DIST, "coverage-marker-err2.txt");
    await fsp.writeFile(file, "hello");
    try {
      const fakeStream = new EventEmitter();
      fakeStream.pipe = () => {};
      vi.spyOn(fs, "createReadStream").mockReturnValue(fakeStream);

      const res = fakeRes(); // writeHead() here sets headersSent = true, matching the real type
      sendFile(res, file, "/coverage-marker-err2.txt", "GET");
      await new Promise((r) => setTimeout(r, 20));
      fakeStream.emit("error", new Error("disk read failed"));
      await new Promise((r) => setTimeout(r, 20));
      expect(res.destroy).toHaveBeenCalled();
    } finally {
      await fsp.rm(file, { force: true });
    }
  });
});

describe("serveStatic edge cases", () => {
  it("404s when the pathname contains a malformed percent-encoding", async () => {
    const res = fakeRes();
    serveStatic({ method: "GET" }, res, "/%zz");
    await new Promise((r) => setTimeout(r, 20));
    expect(res.statusCode).toBe(404);
  });

  it("404s when the decoded pathname contains a null byte", async () => {
    const res = fakeRes();
    serveStatic({ method: "GET" }, res, "/foo%00bar");
    await new Promise((r) => setTimeout(r, 20));
    expect(res.statusCode).toBe(404);
  });
});

describe("requestHandler / serveStatic - real file end to end", () => {
  let server;
  let base;

  beforeAll(async () => {
    await fsp.mkdir(DIST, { recursive: true });
    await fsp.writeFile(path.join(DIST, "index.html"), "<html>hub</html>");
    server = http.createServer(requestHandler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await fsp.rm(path.join(DIST, "index.html"), { force: true });
  });

  it("maps the root path to index.html and serves it for real", async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toBe("<html>hub</html>");
  });

  it("responds 400 for a request url the WHATWG URL parser rejects outright", async () => {
    const res = fakeRes();
    requestHandler({ url: "http://a b/", method: "GET" }, res);
    await new Promise((r) => setTimeout(r, 20));
    expect(res.statusCode).toBe(400);
  });

  it("serves GET /api/status with the last sweep time and cached statuses", async () => {
    const res = await fetch(`${base}/api/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sweepAt");
    expect(body).toHaveProperty("statuses");
  });
});
