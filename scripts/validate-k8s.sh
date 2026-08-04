#!/usr/bin/env bash
# Validates the k8s manifests: structural checks (always, offline) +
# kubeconform schema validation incl. Gateway API CRD schemas (best effort).
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0

echo "[validate-k8s] structural checks (js-yaml)"
node scripts/validate-k8s-fallback.mjs || FAIL=1

TOOLS=.tools
KC="$TOOLS/kubeconform"
mkdir -p "$TOOLS"
if [ ! -x "$KC" ]; then
  ARCH="$(uname -m)"
  case "$ARCH" in aarch64 | arm64) A=arm64 ;; *) A=amd64 ;; esac
  URL="https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-$A.tar.gz"
  echo "[validate-k8s] fetching kubeconform ($A)…"
  if curl -sfL "$URL" -o "$TOOLS/kc.tgz" && tar -xzf "$TOOLS/kc.tgz" -C "$TOOLS" kubeconform; then
    rm -f "$TOOLS/kc.tgz"
  else
    echo "[validate-k8s] WARN: kubeconform not available — schema validation skipped"
  fi
fi

if [ -x "$KC" ]; then
  echo "[validate-k8s] kubeconform schema validation"
  "$KC" -strict -summary \
    -ignore-filename-pattern 'kustomization.yaml' \
    -schema-location default \
    -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
    k8s/ || FAIL=1
fi

exit $FAIL
