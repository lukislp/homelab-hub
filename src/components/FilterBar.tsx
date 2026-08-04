import { Pencil, Plus, X } from "lucide-react";
import { useDashboard } from "../store/dashboard";
import { cn, pad2 } from "../lib/utils";

export default function FilterBar() {
  const data = useDashboard((s) => s.data);
  const filterCategory = useDashboard((s) => s.filterCategory);
  const setFilterCategory = useDashboard((s) => s.setFilterCategory);
  const query = useDashboard((s) => s.query);
  const setQuery = useDashboard((s) => s.setQuery);
  const editMode = useDashboard((s) => s.editMode);
  const toggleEditMode = useDashboard((s) => s.toggleEditMode);
  const openModal = useDashboard((s) => s.openModal);

  if (!data) return null;

  const counts = new Map<string, number>();
  for (const l of data.links) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);

  const chip = (active: boolean) =>
    cn(
      "microlabel cursor-pointer whitespace-nowrap border px-2.5 py-2 transition-colors",
      active
        ? "border-phosphor bg-phosphor text-void"
        : "border-line text-muted hover:border-line-bright hover:text-text"
    );

  return (
    <div className="sticky top-0 z-30 -mx-5 border-b border-line bg-void/85 px-5 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex flex-wrap items-center gap-2 py-3">
        {/* mobile: controls first (full width), chips scroll on their own row below */}
        <div className="order-2 flex w-full items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:order-1 sm:w-auto sm:flex-1 sm:pr-2">
          <button className={chip(filterCategory === null)} onClick={() => setFilterCategory(null)}>
            ALL{" "}
            <span className={filterCategory === null ? "text-void/60" : "text-faint"}>
              {pad2(data.links.length)}
            </span>
          </button>
          {data.categories.map((c) => (
            <button
              key={c.id}
              className={chip(filterCategory === c.id)}
              onClick={() => setFilterCategory(filterCategory === c.id ? null : c.id)}
            >
              {c.label}{" "}
              <span className={filterCategory === c.id ? "text-void/60" : "text-faint"}>
                {pad2(counts.get(c.id) ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="order-1 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
          <div className="flex flex-1 items-center gap-1.5 border border-line px-2.5 transition-colors focus-within:border-phosphor-dim sm:flex-none">
            <span className="font-mono text-xs text-phosphor">&gt;</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="filter_"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent py-2 font-mono text-xs text-text outline-none placeholder:text-faint sm:w-36"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="cursor-pointer text-faint transition-colors hover:text-text"
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            data-testid="add-button"
            onClick={() => openModal({ mode: "create", category: filterCategory ?? undefined })}
            className="microlabel flex cursor-pointer items-center gap-1.5 border border-phosphor bg-phosphor px-3 py-2 text-void transition-colors hover:bg-transparent hover:text-phosphor"
          >
            <Plus size={12} strokeWidth={2.5} />
            ADD
          </button>

          <button
            onClick={toggleEditMode}
            aria-pressed={editMode}
            className={cn(
              "microlabel flex cursor-pointer items-center gap-1.5 border px-3 py-2 transition-colors",
              editMode
                ? "border-amber text-amber"
                : "border-line text-muted hover:border-line-bright hover:text-text"
            )}
          >
            <Pencil size={11} />
            EDIT
          </button>
        </div>
      </div>
    </div>
  );
}
