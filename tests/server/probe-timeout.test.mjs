import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import http from "node:http";

// PROBE_TIMEOUT_MS is read once at module load, so it has to be set before app.mjs is
// imported - vitest gives each test file its own module registry, so this doesn't leak
// into other test files that need the default 5s timeout.
let probeOnce;
let server;

beforeAll(async () => {
  process.env.PROBE_TIMEOUT_MS = "150";
  ({ probeOnce } = await import("../../server/app.mjs"));
});

afterAll(() => {
  delete process.env.PROBE_TIMEOUT_MS;
});

afterEach(async () => {
  if (server) {
    await new Promise((r) => server.close(r));
    server = undefined;
  }
});

describe("probeOnce timeout handling", () => {
  it("reports offline/TIMEOUT when the target never responds within PROBE_TIMEOUT_MS", async () => {
    server = http.createServer(() => {
      /* deliberately never respond - forces the AbortSignal.timeout() path */
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    const result = await probeOnce(`http://127.0.0.1:${port}/`);
    expect(result.state).toBe("offline");
    expect(result.httpStatus).toBeNull();
    expect(result.error).toBe("TIMEOUT");
  }, 2000);
});
