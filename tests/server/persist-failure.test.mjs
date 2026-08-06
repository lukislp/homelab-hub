import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

// DATA_DIR is read once at module load, so it has to be set before app.mjs is imported.
// Vitest gives each test file its own module registry, so this doesn't leak into other
// test files that rely on the default DATA_DIR.
let mod;
let tmpDir;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "homelab-hub-test-"));
  // A regular FILE where DATA_DIR expects to be able to create a directory - fsp.mkdir(...,
  // { recursive: true }) reliably fails against this cross-platform (ENOTDIR/EEXIST), giving
  // a real (not mocked) persist() failure to exercise the write-failure branches with.
  const blockingFile = path.join(tmpDir, "blocked");
  await fs.writeFile(blockingFile, "block");
  process.env.DATA_DIR = blockingFile;
  mod = await import("../../server/app.mjs");
});

afterAll(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("persist() failure handling", () => {
  it("rejects when the data directory can't be created, and the write chain survives for the next call", async () => {
    const doc = { version: 1, settings: { title: "t" }, categories: [], links: [] };
    await expect(mod.persist(doc)).rejects.toThrow();
    // writeChain swallows the failure internally so a second call must still be attempted
    // rather than staying permanently wedged behind the first rejection.
    await expect(mod.persist(doc)).rejects.toThrow();
  });

  it("handlePut surfaces a persist() failure as 500 and rolls back the in-memory document", async () => {
    const prevDoc = { version: 1, settings: { title: "before" }, categories: [], links: [] };
    mod.setData(prevDoc);
    const newDoc = { version: 1, settings: { title: "after" }, categories: [], links: [] };

    const req = new EventEmitter();
    req.headers = { "content-type": "application/json" };
    const res = {
      writeHead(code) {
        this.statusCode = code;
      },
      end(b) {
        this.body = b;
      },
    };

    const p = mod.handlePut(req, res);
    queueMicrotask(() => {
      req.emit("data", Buffer.from(JSON.stringify(newDoc)));
      req.emit("end");
    });
    await p;

    expect(res.statusCode).toBe(500);
    expect(mod.getData()).toEqual(prevDoc);
  });
});
