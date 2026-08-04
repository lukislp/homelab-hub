import type { LinkStatus } from "../types";

export default function StatusDot({ enabled, status }: { enabled: boolean; status?: LinkStatus }) {
  if (!enabled) {
    return (
      <span className="microlabel flex items-center gap-1.5 text-faint">
        <span className="size-1.5 border border-faint" />
        NO PROBE
      </span>
    );
  }

  const state = status?.state ?? "unknown";

  if (state === "online") {
    return (
      <span className="microlabel flex items-center gap-1.5 text-phosphor">
        <span className="relative flex size-1.5">
          <span className="ping-dot absolute inset-0 bg-phosphor/60" />
          <span className="relative size-1.5 bg-phosphor" />
        </span>
        ONLINE
        {typeof status?.latencyMs === "number" && (
          <span className="text-phosphor-dim">{status.latencyMs}MS</span>
        )}
      </span>
    );
  }

  if (state === "offline") {
    return (
      <span className="microlabel flex items-center gap-1.5 text-alert">
        <span className="blink-soft size-1.5 bg-alert" />
        OFFLINE
      </span>
    );
  }

  return (
    <span className="microlabel flex items-center gap-1.5 text-muted">
      <span className="size-1.5 bg-muted/50" />
      SCAN…
    </span>
  );
}
