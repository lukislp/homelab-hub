import { useDashboard } from "../store/dashboard";

export default function EmptyState({ kind }: { kind: "empty" | "nomatch" }) {
  const openModal = useDashboard((s) => s.openModal);
  const setQuery = useDashboard((s) => s.setQuery);
  const setFilterCategory = useDashboard((s) => s.setFilterCategory);

  return (
    <div className="mt-10 border border-dashed border-line px-6 py-16 text-center">
      {kind === "empty" ? (
        <>
          <div className="microlabel text-muted">NO SERVICES REGISTERED</div>
          <button
            onClick={() => openModal({ mode: "create" })}
            className="microlabel mt-4 cursor-pointer border border-phosphor-dim px-3 py-2 text-phosphor transition-colors hover:bg-phosphor hover:text-void"
          >
            + REGISTER FIRST SERVICE
          </button>
        </>
      ) : (
        <>
          <div className="microlabel text-muted">NO MATCH FOR QUERY</div>
          <button
            onClick={() => {
              setQuery("");
              setFilterCategory(null);
            }}
            className="microlabel mt-4 cursor-pointer border border-line px-3 py-2 text-muted transition-colors hover:border-phosphor hover:text-phosphor"
          >
            CLEAR FILTERS
          </button>
        </>
      )}
    </div>
  );
}
