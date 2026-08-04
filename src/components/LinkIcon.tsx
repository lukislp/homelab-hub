import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ICONS } from "../lib/icons";
import { monogram } from "../lib/utils";
import type { LinkItem } from "../types";

/**
 * Icon tile: favicon (via backend proxy) -> curated lucide icon -> monogram.
 * The favicon <img> falls back to the monogram on load error.
 */
export default function LinkIcon({ link }: { link: LinkItem }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  useEffect(() => setFaviconFailed(false), [link.id, link.url]);

  let inner: ReactNode = null;

  if (link.icon.type === "lucide") {
    const Icon = ICONS[link.icon.name];
    if (Icon) {
      inner = (
        <Icon
          size={18}
          strokeWidth={1.6}
          className="text-phosphor-dim transition-colors duration-200 group-hover:text-phosphor"
        />
      );
    }
  } else if (link.icon.type === "favicon" && !faviconFailed) {
    // A light backdrop keeps dark/monochrome favicons (common — GitHub, many
    // minimalist services) visible against this app's dark theme.
    inner = (
      <span className="grid size-7 place-items-center rounded-sm bg-white/95">
        <img
          src={`/api/icon/${link.id}`}
          alt=""
          width={18}
          height={18}
          draggable={false}
          onError={() => setFaviconFailed(true)}
          className="size-[18px] object-contain"
        />
      </span>
    );
  }

  if (!inner) {
    inner = (
      <span className="font-mono text-[11px] tracking-widest text-phosphor-dim transition-colors duration-200 group-hover:text-phosphor">
        {monogram(link.name)}
      </span>
    );
  }

  return (
    <span className="grid size-10 shrink-0 place-items-center border border-line bg-surface-2 transition-colors duration-200 group-hover:border-line-bright">
      {inner}
    </span>
  );
}
