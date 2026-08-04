import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useDashboard } from "../store/dashboard";
import { pad2, cn } from "../lib/utils";
import LinkCard from "./LinkCard";
import EmptyState from "./EmptyState";

interface SortableSectionProps {
  id: string;
  label: string;
  /** 1-based position of this category among the currently visible sections - re-derived from
   * `sections`' live order on every render, so it updates immediately after a category drag
   * instead of showing a stale/unrelated number (previously this badge showed the link COUNT,
   * which doesn't track position at all). */
  position: number;
  dragDisabled: boolean;
  children: ReactNode;
}

/** Wraps one category section so its header carries a drag handle for reordering whole
 * categories - separate from LinkCard's own useSortable for the links inside it. The two
 * never fight over the same drag gesture: only the grip icon carries {...listeners}, the rest
 * of the header (and the whole links grid below, passed as children) stays outside this
 * element's own drag surface. */
function SortableSection({ id, label, position, dragDisabled, children }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: dragDisabled,
    data: { type: "category" },
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/section mt-9 first:mt-7", isDragging && "z-50 opacity-70")}
    >
      <div className="mb-3 flex items-baseline gap-3">
        {dragDisabled ? (
          <h2 className="microlabel text-phosphor-dim">
            <span className="text-faint">//&nbsp;</span>
            {label}
          </h2>
        ) : (
          <div
            {...attributes}
            {...listeners}
            aria-label="Kategorie verschieben"
            className="-ml-1 flex cursor-grab touch-none items-baseline gap-1.5 active:cursor-grabbing"
          >
            <GripVertical
              size={13}
              className="translate-y-[1px] text-faint opacity-0 transition-opacity group-hover/section:opacity-100"
            />
            <h2 className="microlabel text-phosphor-dim transition-colors group-hover/section:text-phosphor">
              <span className="text-faint">//&nbsp;</span>
              {label}
            </h2>
          </div>
        )}
        <span className="microlabel text-faint">{pad2(position)}</span>
        <div className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  );
}

export default function LinkGrid() {
  const data = useDashboard((s) => s.data);
  const statuses = useDashboard((s) => s.statuses);
  const filterCategory = useDashboard((s) => s.filterCategory);
  const query = useDashboard((s) => s.query);
  const editMode = useDashboard((s) => s.editMode);
  const openModal = useDashboard((s) => s.openModal);
  const reorderLink = useDashboard((s) => s.reorderLink);
  const reorderCategory = useDashboard((s) => s.reorderCategory);
  const markDragEnd = useDashboard((s) => s.markDragEnd);

  // distance: 8 keeps plain clicks working — the anchor only drags after 8px of travel
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!data) return null;

  const q = query.trim().toLowerCase();
  const dragDisabled = q.length > 0; // reordering a text-filtered subset is ambiguous

  const matches = (name: string, url: string, description: string | undefined, label: string) =>
    !q ||
    name.toLowerCase().includes(q) ||
    url.toLowerCase().includes(q) ||
    (description ?? "").toLowerCase().includes(q) ||
    label.toLowerCase().includes(q);

  const sections = data.categories
    .filter((c) => !filterCategory || c.id === filterCategory)
    .map((c) => ({
      ...c,
      links: data.links.filter((l) => l.category === c.id && matches(l.name, l.url, l.description, c.label)),
    }))
    .filter((s) => s.links.length > 0);

  const onDragEnd = (event: DragEndEvent) => {
    markDragEnd();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (active.data.current?.type === "category") {
      reorderCategory(String(active.id), String(over.id));
    } else {
      reorderLink(String(active.id), String(over.id));
    }
  };

  if (data.links.length === 0) return <EmptyState kind="empty" />;
  if (sections.length === 0) return <EmptyState kind="nomatch" />;

  let cursor = 0;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {sections.map((section, sectionIndex) => {
          const start = cursor;
          cursor += section.links.length;
          return (
            <SortableSection
              key={section.id}
              id={section.id}
              label={section.label}
              position={sectionIndex + 1}
              dragDisabled={dragDisabled}
            >
              <SortableContext items={section.links.map((l) => l.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.links.map((link, i) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      index={start + i}
                      status={statuses[link.id]}
                      categoryLabel={section.label}
                      dragDisabled={dragDisabled}
                    />
                  ))}
                  {editMode && (
                    <button
                      onClick={() => openModal({ mode: "create", category: section.id })}
                      className="microlabel grid min-h-36 cursor-pointer place-items-center border border-dashed border-line text-faint transition-colors hover:border-phosphor-dim hover:text-phosphor"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus size={12} />
                        ADD TO {section.label.toUpperCase()}
                      </span>
                    </button>
                  )}
                </div>
              </SortableContext>
            </SortableSection>
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
