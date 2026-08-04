import type { MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, Pencil } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useDashboard } from "../store/dashboard";
import { cn, hostFromUrl, pad2 } from "../lib/utils";
import type { LinkItem, LinkStatus } from "../types";
import CornerBrackets from "./CornerBrackets";
import LinkIcon from "./LinkIcon";
import StatusDot from "./StatusDot";

interface Props {
  link: LinkItem;
  index: number;
  status?: LinkStatus;
  categoryLabel: string;
  dragDisabled: boolean;
}

export default function LinkCard({ link, index, status, categoryLabel, dragDisabled }: Props) {
  const editMode = useDashboard((s) => s.editMode);
  const openModal = useDashboard((s) => s.openModal);
  const reduced = useReducedMotion();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: dragDisabled,
  });

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // browsers fire a click on the anchor right after a drag ends — swallow it
    if (Date.now() - useDashboard.getState().lastDragEndAt < 250) {
      e.preventDefault();
      return;
    }
    if (editMode) {
      e.preventDefault();
      openModal({ mode: "edit", id: link.id });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn("group relative", isDragging && "z-50")}
    >
      {/* entrance animation on an inner node — never on the dnd-transformed node */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: Math.min(index * 0.04, 0.5) }}
        className="h-full"
      >
        <a
          data-testid="link-card"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onClick={handleClick}
          className={cn(
            "relative flex h-full min-h-36 flex-col border bg-surface p-4 no-underline outline-none transition-[border-color,box-shadow,opacity] duration-200",
            isDragging
              ? "border-phosphor opacity-70 shadow-[0_0_34px_-8px_rgba(52,255,165,0.4)]"
              : editMode
                ? "border-amber/40 hover:border-amber"
                : "border-line hover:border-phosphor-dim hover:shadow-[0_0_28px_-10px_rgba(52,255,165,0.3)]"
          )}
        >
          <CornerBrackets />
          <div className="flex items-start justify-between gap-3">
            <LinkIcon link={link} />
            <div className="flex flex-col items-end gap-2">
              <span className="font-mono text-[10px] leading-none text-faint">{pad2(index + 1)}</span>
              <StatusDot enabled={link.checkEnabled} status={status} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="truncate text-[15px] font-medium tracking-wide text-text">{link.name}</h3>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{hostFromUrl(link.url)}</div>
            {link.description && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{link.description}</p>
            )}
          </div>
          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="microlabel text-faint">{categoryLabel}</span>
            {editMode ? (
              <Pencil size={13} className="text-amber" />
            ) : (
              <ArrowUpRight
                size={14}
                className="text-faint transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-phosphor"
              />
            )}
          </div>
        </a>
      </motion.div>
    </div>
  );
}
