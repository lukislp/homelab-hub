#!/usr/bin/env node
/**
 * homelab-hub — zero-dependency backend (Node >= 20, node: builtins only).
 *
 * Bootstrap only: wires up the TLS/plain-HTTP listener and process signal handling around
 * requestHandler/loadData/sweep. All actual request handling, data validation, and probing
 * logic lives in ./app.mjs so it can be imported and unit-tested without the side effects of
 * opening a socket (see server/app.mjs's header comment for the API surface).
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { DATA_FILE, DIST, HOST, PORT, loadData, requestHandler, stopSweep, sweep } from "./app.mjs";

const log = (...args) => console.log("[hub]", ...args);

// Native TLS termination for the Gateway->pod hop (k8s/deployment.yaml's
// BackendTLSPolicy verifies against this) - falls back to plain HTTP when unset
// (local dev via `npm run server`, no cert available there).
const TLS_KEY_PATH = process.env.HOMELAB_HUB_TLS_KEY;
const TLS_CERT_PATH = process.env.HOMELAB_HUB_TLS_CERT;
const useTls = Boolean(TLS_KEY_PATH && TLS_CERT_PATH);
const server = useTls
  ? https.createServer({ key: fs.readFileSync(TLS_KEY_PATH), cert: fs.readFileSync(TLS_CERT_PATH) }, requestHandler)
  : http.createServer(requestHandler);

function shutdown(signal) {
  log(`${signal} received, shutting down`);
  stopSweep();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await loadData();
server.listen(PORT, HOST, () => {
  log(`listening on ${useTls ? "https" : "http"}://${HOST}:${PORT} (data: ${DATA_FILE}, dist: ${fs.existsSync(DIST) ? "ok" : "MISSING"})`);
  sweep();
});
