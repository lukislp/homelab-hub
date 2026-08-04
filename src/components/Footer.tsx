export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line py-5">
      <div className="microlabel flex flex-wrap items-center justify-between gap-2 text-faint">
        <span>
          HOMELAB-HUB <span className="text-phosphor-dim">v0.1.0</span>
        </span>
        <span className="hidden sm:inline">DATA /data/links.json</span>
        <span>100% SELF-HOSTED · NO CLOUD</span>
      </div>
    </footer>
  );
}
