import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { getData, putData } from "../lib/api";
import { slugify } from "../lib/utils";
import type { DashboardData, LinkItem, LinkStatus } from "../types";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type ModalState =
  | { mode: "create"; category?: string }
  | { mode: "edit"; id: string }
  | null;

interface DashboardStore {
  data: DashboardData | null;
  loadError: string | null;
  statuses: Record<string, LinkStatus>;
  sweepAt: string | null;
  saving: SaveState;
  filterCategory: string | null;
  query: string;
  editMode: boolean;
  modal: ModalState;
  /** Guards the anchor click that browsers fire right after a drag ends. */
  lastDragEndAt: number;

  load: () => Promise<void>;
  setStatuses: (statuses: Record<string, LinkStatus>, sweepAt: string | null) => void;
  setFilterCategory: (id: string | null) => void;
  setQuery: (q: string) => void;
  toggleEditMode: () => void;
  openModal: (m: Exclude<ModalState, null>) => void;
  closeModal: () => void;
  markDragEnd: () => void;
  upsertLink: (link: LinkItem, newCategoryLabel?: string) => void;
  deleteLink: (id: string) => void;
  reorderLink: (activeId: string, overId: string) => void;
  reorderCategory: (activeId: string, overId: string) => void;
  retrySave: () => void;
}

let lastSynced: DashboardData | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let savedTimer: ReturnType<typeof setTimeout> | null = null;
let flushChain: Promise<void> = Promise.resolve();

/** Categories exist only through links — drop the ones nothing references. */
function pruneCategories(d: DashboardData): DashboardData {
  const used = new Set(d.links.map((l) => l.category));
  return { ...d, categories: d.categories.filter((c) => used.has(c.id)) };
}

export const useDashboard = create<DashboardStore>()((set, get) => {
  const flushNow = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const snapshot = get().data;
    if (!snapshot) return;
    set({ saving: "saving" });
    flushChain = flushChain.then(async () => {
      try {
        await putData(snapshot);
        lastSynced = snapshot;
        set({ saving: "saved" });
        if (savedTimer) clearTimeout(savedTimer);
        savedTimer = setTimeout(() => {
          if (get().saving === "saved") set({ saving: "idle" });
        }, 2500);
      } catch {
        // optimistic update failed -> roll back to the last acknowledged state
        set({ data: lastSynced, saving: "error" });
      }
    });
  };

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushNow, 600);
  };

  const mutate = (fn: (d: DashboardData) => DashboardData) => {
    const d = get().data;
    if (!d) return;
    const next = pruneCategories(fn(d));
    const filter = get().filterCategory;
    set({
      data: next,
      filterCategory: filter && next.categories.some((c) => c.id === filter) ? filter : null,
    });
    scheduleFlush();
  };

  return {
    data: null,
    loadError: null,
    statuses: {},
    sweepAt: null,
    saving: "idle",
    filterCategory: null,
    query: "",
    editMode: false,
    modal: null,
    lastDragEndAt: 0,

    load: async () => {
      set({ loadError: null });
      try {
        const d = await getData();
        lastSynced = d;
        set({ data: d });
      } catch (e) {
        set({ loadError: e instanceof Error ? e.message : String(e) });
      }
    },

    setStatuses: (statuses, sweepAt) => set({ statuses, sweepAt }),
    setFilterCategory: (id) => set({ filterCategory: id }),
    setQuery: (q) => set({ query: q }),
    toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),
    openModal: (m) => set({ modal: m }),
    closeModal: () => set({ modal: null }),
    markDragEnd: () => set({ lastDragEndAt: Date.now() }),

    upsertLink: (link, newCategoryLabel) => {
      mutate((d) => {
        let categories = d.categories;
        let categoryId = link.category;
        if (newCategoryLabel && newCategoryLabel.trim()) {
          const id = slugify(newCategoryLabel);
          if (!categories.some((c) => c.id === id)) {
            categories = [...categories, { id, label: newCategoryLabel.trim() }];
          }
          categoryId = id;
        }
        const next: LinkItem = { ...link, category: categoryId };
        const exists = d.links.some((l) => l.id === next.id);
        const links = exists
          ? d.links.map((l) => (l.id === next.id ? next : l))
          : [...d.links, next];
        return { ...d, categories, links };
      });
      set({ modal: null });
    },

    deleteLink: (id) => {
      mutate((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }));
      set({ modal: null });
    },

    reorderLink: (activeId, overId) => {
      mutate((d) => {
        const from = d.links.findIndex((l) => l.id === activeId);
        const to = d.links.findIndex((l) => l.id === overId);
        if (from < 0 || to < 0 || from === to) return d;
        // reordering is only defined within one category section
        if (d.links[from].category !== d.links[to].category) return d;
        return { ...d, links: arrayMove(d.links, from, to) };
      });
    },

    reorderCategory: (activeId, overId) => {
      mutate((d) => {
        const from = d.categories.findIndex((c) => c.id === activeId);
        const to = d.categories.findIndex((c) => c.id === overId);
        if (from < 0 || to < 0 || from === to) return d;
        return { ...d, categories: arrayMove(d.categories, from, to) };
      });
    },

    retrySave: () => flushNow(),
  };
});
