import { describe, it, expect, afterEach } from "vitest";
import http from "node:http";
import { probeOnce } from "../../server/app.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

describe("probeOnce", () => {
  let server;

  afterEach(async () => {
    if (server) {
      await new Promise((r) => server.close(r));
      server = undefined;
    }
  });

  it("reports online for a reachable http server with latency and status", async () => {
    server = await listen((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    const { port } = server.address();
    const result = await probeOnce(`http://127.0.0.1:${port}/`);
    expect(result.state).toBe("online");
    expect(result.httpStatus).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(result.checkedAt).toEqual(expect.any(String));
  });

  it("treats 401/403/302 as online too - any response means the service is alive", async () => {
    server = await listen((_req, res) => {
      res.writeHead(403);
      res.end();
    });
    const { port } = server.address();
    const result = await probeOnce(`http://127.0.0.1:${port}/`);
    expect(result.state).toBe("online");
    expect(result.httpStatus).toBe(403);
  });

  it("reports offline with a connection error when nothing is listening on the port", async () => {
    // Open a server, grab its port, then close it - a subsequent connect to that
    // loopback port is reliably refused cross-platform (unlike guessing a fixed low port).
    const temp = await listen((_req, res) => res.end());
    const { port } = temp.address();
    await new Promise((r) => temp.close(r));

    const result = await probeOnce(`http://127.0.0.1:${port}/`);
    expect(result.state).toBe("offline");
    expect(result.httpStatus).toBeNull();
    expect(result.latencyMs).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("reports unknown/BAD_URL for a string that isn't a URL at all", async () => {
    const result = await probeOnce("not a url");
    expect(result).toMatchObject({ state: "unknown", latencyMs: null, httpStatus: null, error: "BAD_URL" });
  });

  it("reports unknown/BAD_PROTOCOL for non-http(s) schemes", async () => {
    const result = await probeOnce("ftp://example.com/file");
    expect(result).toMatchObject({ state: "unknown", latencyMs: null, httpStatus: null, error: "BAD_PROTOCOL" });
  });
});
