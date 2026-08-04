import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useDashboard } from "../store/dashboard";
import type { ModalState } from "../store/dashboard";
import { ICONS, ICON_NAMES } from "../lib/icons";
import { cn, isValidHttpUrl, normalizeUrl, uid } from "../lib/utils";
import type { IconConfig } from "../types";

const inputCls =
  "w-full border border-line bg-void/60 px-3 py-2 font-mono text-sm text-text outline-none transition-colors placeholder:text-faint focus:border-phosphor-dim";

const NEW_CATEGORY = "__new__";

const ICON_MODE_LABEL: Record<IconConfig["type"], string> = {
  favicon: "FAVICON",
  lucide: "ICON SET",
  monogram: "MONOGRAM",
};

export default function LinkFormModal() {
  const modal = useDashboard((s) => s.modal);
  return (
    <AnimatePresence>
      {modal && <ModalInner key={modal.mode === "edit" ? modal.id : "create"} modal={modal} />}
    </AnimatePresence>
  );
}

// `modal` MUST come in as a prop (frozen snapshot): during the AnimatePresence
// exit animation the store value is already null — reading it here would crash.
function ModalInner({ modal }: { modal: Exclude<ModalState, null> }) {
  const data = useDashboard((s) => s.data);
  const closeModal = useDashboard((s) => s.closeModal);
  const upsertLink = useDashboard((s) => s.upsertLink);
  const deleteLink = useDashboard((s) => s.deleteLink);

  const editing = modal.mode === "edit" ? data?.links.find((l) => l.id === modal.id) : undefined;
  const presetCategory = modal.mode === "create" ? modal.category : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(
    editing?.category ?? presetCategory ?? data?.categories[0]?.id ?? NEW_CATEGORY
  );
  const [newCategory, setNewCategory] = useState("");
  const [iconMode, setIconMode] = useState<IconConfig["type"]>(editing?.icon.type ?? "lucide");
  const [iconName, setIconName] = useState(
    editing?.icon.type === "lucide" ? editing.icon.name : "server"
  );
  const [checkEnabled, setCheckEnabled] = useState(editing?.checkEnabled ?? true);
  const [statusUrl, setStatusUrl] = useState(editing?.statusUrl ?? "");
  const [showAdvanced, setShowAdvanced] = useState(Boolean(editing?.statusUrl));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const normalizedUrl = normalizeUrl(url);
  const urlOk = url.trim().length > 0 && isValidHttpUrl(normalizedUrl);
  const categoryOk = category !== NEW_CATEGORY || newCategory.trim().length > 0;
  const canSubmit = name.trim().length > 0 && urlOk && categoryOk;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const icon: IconConfig =
      iconMode === "lucide" ? { type: "lucide", name: iconName } : { type: iconMode };
    const trimmedStatusUrl = statusUrl.trim() ? normalizeUrl(statusUrl) : "";
    upsertLink(
      {
        id: editing?.id ?? uid(),
        name: name.trim(),
        url: normalizedUrl,
        description: description.trim() || undefined,
        category: category === NEW_CATEGORY ? "" : category,
        icon,
        checkEnabled,
        statusUrl: trimmedStatusUrl && isValidHttpUrl(trimmedStatusUrl) ? trimmedStatusUrl : undefined,
      },
      category === NEW_CATEGORY ? newCategory : undefined
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/85 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <motion.div
        data-testid="modal"
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg border border-line-bright bg-surface"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="microlabel text-phosphor">
            ▚ {editing ? "MODIFY SERVICE" : "REGISTER SERVICE"}
          </span>
          <button
            onClick={closeModal}
            className="microlabel flex cursor-pointer items-center gap-1 text-muted transition-colors hover:text-text"
          >
            <X size={12} /> ESC
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="microlabel text-muted">NAME</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grafana"
                className={cn(inputCls, "mt-1.5")}
              />
            </label>

            <label className="block">
              <span className="microlabel text-muted">URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://grafana.home.lab:3000"
                spellCheck={false}
                className={cn(inputCls, "mt-1.5")}
              />
              {url.trim().length > 0 && !urlOk && (
                <span className="microlabel mt-1.5 block text-alert">MUST BE HTTP(S)</span>
              )}
            </label>

            <label className="block">
              <span className="microlabel text-muted">DESCRIPTION</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional"
                className={cn(inputCls, "mt-1.5")}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="microlabel text-muted">CATEGORY</span>
                <span className="relative mt-1.5 block">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={cn(inputCls, "cursor-pointer appearance-none pr-8")}
                  >
                    {data?.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>+ new category…</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                    ▾
                  </span>
                </span>
              </label>
              {category === NEW_CATEGORY && (
                <label className="block">
                  <span className="microlabel text-muted">NEW CATEGORY</span>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Backups"
                    className={cn(inputCls, "mt-1.5")}
                  />
                </label>
              )}
            </div>

            <div>
              <span className="microlabel text-muted">ICON</span>
              <div className="mt-1.5 flex gap-1">
                {(Object.keys(ICON_MODE_LABEL) as IconConfig["type"][]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIconMode(mode)}
                    className={cn(
                      "microlabel flex-1 cursor-pointer border px-2 py-2 transition-colors",
                      iconMode === mode
                        ? "border-phosphor bg-phosphor/10 text-phosphor"
                        : "border-line text-muted hover:border-line-bright hover:text-text"
                    )}
                  >
                    {ICON_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
              {iconMode === "lucide" && (
                <div className="mt-2 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto border border-line bg-void/40 p-2">
                  {ICON_NAMES.map((n) => {
                    const Icon = ICONS[n];
                    return (
                      <button
                        key={n}
                        type="button"
                        title={n}
                        onClick={() => setIconName(n)}
                        className={cn(
                          "grid size-9 cursor-pointer place-items-center border transition-colors",
                          iconName === n
                            ? "border-phosphor bg-phosphor/10 text-phosphor"
                            : "border-transparent text-muted hover:border-line-bright hover:text-text"
                        )}
                      >
                        <Icon size={15} strokeWidth={1.6} />
                      </button>
                    );
                  })}
                </div>
              )}
              {iconMode === "favicon" && (
                <p className="microlabel mt-2 text-faint">
                  FETCHES /FAVICON.ICO VIA BACKEND PROXY — FALLS BACK TO MONOGRAM
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setCheckEnabled(!checkEnabled)}
                className="microlabel flex cursor-pointer items-center gap-2 text-muted transition-colors hover:text-text"
              >
                <span
                  className={cn(
                    "grid size-3.5 place-items-center border transition-colors",
                    checkEnabled ? "border-phosphor" : "border-line"
                  )}
                >
                  {checkEnabled && <span className="size-1.5 bg-phosphor" />}
                </span>
                STATUS PROBE {checkEnabled ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="microlabel cursor-pointer text-faint transition-colors hover:text-muted"
              >
                ADVANCED {showAdvanced ? "−" : "+"}
              </button>
            </div>

            {showAdvanced && (
              <label className="block">
                <span className="microlabel text-muted">STATUS URL (PROBE OVERRIDE)</span>
                <input
                  value={statusUrl}
                  onChange={(e) => setStatusUrl(e.target.value)}
                  placeholder="optional — e.g. http://10.0.0.5:3000"
                  spellCheck={false}
                  className={cn(inputCls, "mt-1.5")}
                />
                <span className="microlabel mt-1.5 block text-faint">
                  PROBED FROM INSIDE THE CLUSTER — USE WHEN THE CLICK URL IS NOT REACHABLE THERE
                </span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            {editing ? (
              confirmDelete ? (
                <span className="microlabel flex items-center gap-2 text-alert">
                  SURE?
                  <button
                    type="button"
                    onClick={() => deleteLink(editing.id)}
                    className="cursor-pointer border border-alert bg-alert px-2 py-1 text-void transition-colors hover:bg-transparent hover:text-alert"
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="cursor-pointer border border-line px-2 py-1 text-muted transition-colors hover:text-text"
                  >
                    NO
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="microlabel cursor-pointer text-alert/80 transition-colors hover:text-alert"
                >
                  DELETE
                </button>
              )
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="microlabel cursor-pointer border border-line px-3 py-2 text-muted transition-colors hover:text-text"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="microlabel cursor-pointer border border-phosphor bg-phosphor px-3 py-2 text-void transition-colors hover:bg-transparent hover:text-phosphor disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editing ? "APPLY" : "REGISTER"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
