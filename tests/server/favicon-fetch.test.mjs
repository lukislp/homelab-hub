import { describe, it, expect, vi, afterEach } from "vitest";
import http from "node:http";
import { EventEmitter } from "node:events";
import { fetchFavicon } from "../../server/app.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

describe("fetchFavicon", () => {
  let server;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise((r) => server.close(r));
      server = undefined;
    }
  });

  it("rejects a target url that can't be parsed", async () => {
    await expect(fetchFavicon("not a url", "example.test", 0)).rejects.toThrow("bad url");
  });

  it("rejects a non-http(s) protocol", async () => {
    await expect(fetchFavicon("ftp://example.test/x", "example.test", 0)).rejects.toThrow("blocked");
  });

  it("rejects a hostname that doesn't match the allowed host", async () => {
    await expect(fetchFavicon("http://other.example.test/x", "example.test", 0)).rejects.toThrow("blocked");
  });

  it("follows a redirect within the allowed budget and resolves the final image", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    server = await listen((req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(302, { location: "/real-favicon.ico" });
        res.end();
      } else if (req.url === "/real-favicon.ico") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(png);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    const { port } = server.address();
    const result = await fetchFavicon(`http://127.0.0.1:${port}/favicon.ico`, "127.0.0.1", 2);
    expect(result.type).toBe("image/png");
    expect(result.buf).toEqual(png);
  });

  it("rejects when the redirect target's Location header can't be resolved into a URL", async () => {
    server = await listen((_req, res) => {
      res.writeHead(302, { location: "//[" }); // unterminated IPv6 literal - always invalid
      res.end();
    });
    const { port } = server.address();
    await expect(fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 2)).rejects.toThrow("bad redirect");
  });

  it("rejects when the body exceeds the max icon size", async () => {
    const big = Buffer.alloc(512 * 1024 + 1, 1);
    server = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(big);
    });
    const { port } = server.address();
    await expect(fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0)).rejects.toThrow("too large");
  });

  it("rejects an empty body", async () => {
    server = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end();
    });
    const { port } = server.address();
    await expect(fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0)).rejects.toThrow("empty");
  });

  it("rejects a body that doesn't declare an image type and doesn't look like one", async () => {
    server = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("just some text, not an image");
    });
    const { port } = server.address();
    await expect(fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0)).rejects.toThrow("not an image");
  });

  it("rejects when the underlying request errors (e.g. connection refused)", async () => {
    const temp = await listen((_req, res) => res.end());
    const { port } = temp.address();
    await new Promise((r) => temp.close(r));
    await expect(fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0)).rejects.toThrow();
  });

  it("selects the https transport for https:// targets", async () => {
    const temp = await listen((_req, res) => res.end());
    const { port } = temp.address();
    await new Promise((r) => temp.close(r));
    await expect(fetchFavicon(`https://127.0.0.1:${port}/`, "127.0.0.1", 0)).rejects.toThrow();
  });

  it("rejects a response with no statusCode at all (defensive ?? 0 fallback)", async () => {
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      const fakeReq = new EventEmitter();
      fakeReq.destroy = () => {};
      const fakeRes = new EventEmitter();
      fakeRes.statusCode = undefined;
      fakeRes.headers = {};
      fakeRes.resume = () => {};
      queueMicrotask(() => cb(fakeRes));
      return fakeReq;
    });
    await expect(fetchFavicon("http://example.test/favicon.ico", "example.test", 0)).rejects.toThrow(/status/);
  });

  it("sniffs a valid PNG by magic bytes when no content-type header is present", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0]);
    server = await listen((_req, res) => {
      res.writeHead(200); // deliberately no content-type header
      res.end(png);
    });
    const { port } = server.address();
    const result = await fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0);
    expect(result.type).toBe("image/png");
  });

  it("sniffs a valid ICO by magic bytes when no content-type/PNG/SVG signature matches", async () => {
    const ico = Buffer.from([0, 0, 1, 0, 1, 2, 3, 4, 5]);
    server = await listen((_req, res) => {
      res.writeHead(200);
      res.end(ico);
    });
    const { port } = server.address();
    const result = await fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0);
    expect(result.type).toBe("image/x-icon");
  });

  it("sniffs a valid SVG by its <svg prefix when no content-type/PNG signature matches", async () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    server = await listen((_req, res) => {
      res.writeHead(200);
      res.end(svg);
    });
    const { port } = server.address();
    const result = await fetchFavicon(`http://127.0.0.1:${port}/`, "127.0.0.1", 0);
    expect(result.type).toBe("image/svg+xml");
  });

  it("rejects when the response stream errors after headers were received", async () => {
    const fakeReq = new EventEmitter();
    fakeReq.destroy = () => {};
    vi.spyOn(http, "get").mockImplementation((_u, _opts, cb) => {
      const fakeRes = new EventEmitter();
      fakeRes.statusCode = 200;
      fakeRes.headers = { "content-type": "image/png" };
      queueMicrotask(() => {
        cb(fakeRes);
        queueMicrotask(() => fakeRes.emit("error", new Error("stream boom")));
      });
      return fakeReq;
    });
    await expect(fetchFavicon("http://example.test/favicon.ico", "example.test", 0)).rejects.toThrow("stream boom");
  });
});
