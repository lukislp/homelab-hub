import { useEffect, useState } from "react";
import { useDashboard } from "../store/dashboard";
import type { SaveState } from "../store/dashboard";
import { pad2 } from "../lib/utils";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function SaveIndicator({ saving, onRetry }: { saving: SaveState; onRetry: () => void }) {
  if (saving === "saving") return <span className="microlabel blink-soft text-amber">WRITING…</span>;
  if (saving === "error") {
    return (
      <button
        onClick={onRetry}
        className="microlabel cursor-pointer text-alert underline decoration-dotted underline-offset-4 transition-colors hover:text-text"
      >
        WRITE FAILED — RETRY
      </button>
    );
  }
  if (saving === "saved") return <span className="microlabel text-phosphor">SYNC OK</span>;
  return <span className="microlabel text-faint">IN SYNC</span>;
}

export default function Header() {
  const data = useDashboard((s) => s.data);
  const statuses = useDashboard((s) => s.statuses);
  const saving = useDashboard((s) => s.saving);
  const retrySave = useDashboard((s) => s.retrySave);
  const now = useClock();

  const probed = data?.links.filter((l) => l.checkEnabled) ?? [];
  const online = probed.filter((l) => statuses[l.id]?.state === "online").length;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  return (
    <header className="pt-5 sm:pt-7">
      <div className="fx-ruler h-1.5 w-full border-b border-line" />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-6 pt-6 sm:pt-8">
        <div className="min-w-0">
          <div className="microlabel text-muted">
            {data?.settings.subtitle ?? "self-hosted service registry"}
          </div>
          <h1 className="mt-2 truncate font-mono text-2xl font-medium tracking-tight sm:text-3xl">
            <span className="text-faint">~/</span>
            <span className="text-text">{data?.settings.title ?? "homelab-hub"}</span>
            <span className="caret ml-1 inline-block text-phosphor">▊</span>
          </h1>
        </div>
        <div className="flex items-end gap-8 sm:gap-10">
          <div className="hidden text-right md:block">
            <div className="font-mono text-lg leading-none tabular-nums text-text">{time}</div>
            <div className="microlabel mt-2 text-faint">{date} LOCAL</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg leading-none tabular-nums">
              <span className="text-phosphor">{pad2(online)}</span>
              <span className="text-faint">/{pad2(probed.length)}</span>
            </div>
            <div className="microlabel mt-2 text-faint">SERVICES UP</div>
          </div>
          <div className="hidden text-right sm:block">
            <SaveIndicator saving={saving} onRetry={retrySave} />
          </div>
        </div>
      </div>
    </header>
  );
}
