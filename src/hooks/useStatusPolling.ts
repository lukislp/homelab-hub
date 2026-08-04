import { useEffect } from "react";
import { getStatus } from "../lib/api";
import { useDashboard } from "../store/dashboard";

/** Polls /api/status; pauses while the tab is hidden, refreshes on return. */
export function useStatusPolling(intervalMs = 10000) {
  const setStatuses = useDashboard((s) => s.setStatuses);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await getStatus();
        if (!cancelled) setStatuses(r.statuses, r.sweepAt);
      } catch {
        /* hub temporarily unreachable — keep last known state */
      }
    };

    void tick();
    const iv = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, setStatuses]);
}
