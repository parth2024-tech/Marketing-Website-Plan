import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DownloadSlug = "oneshot" | "setup" | "agent";

type Props = {
  slug: DownloadSlug;
  label: string;
  recommended?: boolean;
};

export default function DownloadButton({ slug, label, recommended }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const url = `/api/downloads/latest/${slug}`;

    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("Location");
        if (location) {
          window.location.assign(location);
          return;
        }
      }

      if (res.ok && res.status === 200) {
        // Local file served by API — navigate to trigger browser download
        window.location.assign(url);
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        releasesUrl?: string;
      } | null;

      toast({
        variant: "destructive",
        title: "Download unavailable",
        description:
          body?.error ??
          "Installers are not published yet. Run the native build workflow or check GitHub Releases.",
      });

      if (body?.releasesUrl) {
        console.info("Releases page:", body.releasesUrl);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Could not reach download server",
        description:
          "Make sure the API server is running (port 5000 locally, or /api on production).",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex w-full items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-70 ${
        recommended
          ? "bg-primary text-background hover:bg-primary/90 glow-cyan"
          : "bg-card border border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {loading ? "Preparing download…" : label}
    </button>
  );
}
