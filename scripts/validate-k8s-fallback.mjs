// Structural k8s manifest validation without a cluster (js-yaml only).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "js-yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const K8S = path.join(ROOT, "k8s");

let fails = 0;
const fail = (msg) => {
  console.error("  FAIL:", msg);
  fails++;
};
const ok = (msg) => console.log("  ok:", msg);

const docs = {};
for (const file of fs.readdirSync(K8S).filter((f) => f.endsWith(".yaml"))) {
  const text = fs.readFileSync(path.join(K8S, file), "utf8");
  try {
    const loaded = loadAll(text).filter(Boolean);
    docs[file] = loaded;
    if (file === "kustomization.yaml") continue;
    for (const d of loaded) {
      if (!d.apiVersion || !d.kind || !d.metadata?.name) {
        fail(`${file}: apiVersion/kind/metadata.name missing`);
      }
    }
  } catch (e) {
    fail(`${file}: yaml parse error — ${e.message}`);
  }
}

// Some files (e.g. deployment.yaml, which also carries its cert-manager Certificate) hold
// multiple YAML documents - select by `kind` instead of assuming the target resource is
// the first document, which silently grabbed the wrong resource here before.
const ofKind = (file, kind) => (docs[file] ?? []).find((d) => d.kind === kind) ?? {};
const dep = ofKind("deployment.yaml", "Deployment");
const svc = ofKind("service.yaml", "Service");
const pvc = ofKind("pvc.yaml", "PersistentVolumeClaim");
const route = ofKind("httproute.yaml", "HTTPRoute");
const kust = (docs["kustomization.yaml"] ?? [])[0] ?? {};

// Deployment
const tplLabels = dep.spec?.template?.metadata?.labels ?? {};
const selector = dep.spec?.selector?.matchLabels ?? {};
Object.keys(selector).length && Object.entries(selector).every(([k, v]) => tplLabels[k] === v)
  ? ok("deployment selector matches template labels")
  : fail("deployment selector/template labels mismatch");
dep.spec?.strategy?.type === "Recreate"
  ? ok("deployment strategy Recreate")
  : fail("deployment strategy must be Recreate (single-writer JSON + RWO volume)");
const container = dep.spec?.template?.spec?.containers?.[0] ?? {};
container.ports?.[0]?.containerPort === 8080 ? ok("containerPort 8080") : fail("containerPort must be 8080");
container.imagePullPolicy === "IfNotPresent" ? ok("imagePullPolicy IfNotPresent") : fail("imagePullPolicy must be IfNotPresent");
const image = String(container.image ?? "");
image.includes(":") && !image.endsWith(":latest") ? ok(`image tag pinned (${image})`) : fail("image needs a pinned tag (never :latest)");
(dep.spec?.template?.spec?.volumes ?? []).some((v) => v.persistentVolumeClaim?.claimName === pvc.metadata?.name)
  ? ok("deployment references the PVC")
  : fail("deployment must reference the PVC");
container.readinessProbe && container.livenessProbe ? ok("probes present") : fail("readiness/liveness probes missing");
const podSec = dep.spec?.template?.spec?.securityContext ?? {};
podSec.runAsNonRoot === true && podSec.fsGroup ? ok("pod securityContext non-root + fsGroup") : fail("pod securityContext incomplete");

// Service
const targetPort = svc.spec?.ports?.[0]?.targetPort;
const containerPortName = container.ports?.[0]?.name;
targetPort === 8080 || (containerPortName && targetPort === containerPortName)
  ? ok(`service targetPort -> ${targetPort}`)
  : fail("service targetPort must be 8080 or the container's named port");
Object.keys(svc.spec?.selector ?? {}).length &&
Object.entries(svc.spec?.selector ?? {}).every(([k, v]) => tplLabels[k] === v)
  ? ok("service selector matches pod labels")
  : fail("service selector mismatch");

// PVC
pvc.spec?.storageClassName === "local-path" ? ok("pvc storageClassName local-path") : fail("pvc storageClassName must be local-path");
(pvc.spec?.accessModes ?? []).includes("ReadWriteOnce") ? ok("pvc RWO") : fail("pvc accessModes must include ReadWriteOnce");

// HTTPRoute
route.apiVersion === "gateway.networking.k8s.io/v1" ? ok("httproute apiVersion gateway.networking.k8s.io/v1") : fail("httproute apiVersion wrong");
route.spec?.parentRefs?.[0]?.name ? ok("httproute parentRef present") : fail("httproute parentRef missing");
route.spec?.hostnames?.length ? ok("httproute hostname present") : fail("httproute hostname missing");
route.spec?.rules?.[0]?.backendRefs?.[0]?.name === svc.metadata?.name ? ok("httproute -> service backendRef") : fail("httproute backendRef must point to the service");
route.spec?.rules?.[0]?.backendRefs?.[0]?.port === 80 ? ok("httproute backend port 80") : fail("httproute backend port must be 80");

// Kustomization
const res = kust.resources ?? [];
const files = fs.readdirSync(K8S).filter((f) => f.endsWith(".yaml") && f !== "kustomization.yaml");
files.every((f) => res.includes(f)) && res.every((f) => files.includes(f))
  ? ok("kustomization resources complete")
  : fail("kustomization resources out of sync with k8s/*.yaml");
// No kustomize `images:` transformer is used by design (see kustomization.yaml's own
// comment) - the image tag is pinned directly in deployment.yaml, already checked above.

console.log(fails ? `\n[validate-k8s] ${fails} FAILURE(S)` : "\n[validate-k8s] structural checks passed");
process.exit(fails ? 1 : 0);
