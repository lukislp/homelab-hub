import { useEffect } from "react";
import { useDashboard } from "./store/dashboard";
import { useStatusPolling } from "./hooks/useStatusPolling";
import BackgroundFX from "./components/BackgroundFX";
import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import LinkGrid from "./components/LinkGrid";
import Footer from "./components/Footer";
import LinkFormModal from "./components/LinkFormModal";

export default function App() {
  const load = useDashboard((s) => s.load);
  const data = useDashboard((s) => s.data);
  const loadError = useDashboard((s) => s.loadError);

  useEffect(() => {
    void load();
  }, [load]);
  useStatusPolling();

  return (
    <div className="relative min-h-dvh">
      <BackgroundFX />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <Header />
        {data ? (
          <>
            <FilterBar />
            <main className="flex-1">
              <LinkGrid />
            </main>
          </>
        ) : (
          <main className="flex flex-1 items-center justify-center">
            {loadError ? (
              <div className="microlabel flex items-center gap-3 text-alert">
                <span>DATA LINK FAILED — {loadError}</span>
                <button
                  onClick={() => void load()}
                  className="cursor-pointer border border-line px-2.5 py-1.5 text-muted transition-colors hover:border-phosphor hover:text-phosphor"
                >
                  RETRY
                </button>
              </div>
            ) : (
              <div className="microlabel blink-soft text-muted">ESTABLISHING DATA LINK…</div>
            )}
          </main>
        )}
        <Footer />
      </div>
      <LinkFormModal />
    </div>
  );
}
