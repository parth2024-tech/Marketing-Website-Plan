import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Terminal, Copy, Download, CheckCheck, Cpu, Activity, ChevronDown, ChevronUp, ArrowRight, AlertCircle, Loader2, FileJson, Check } from "lucide-react";
import { parseReport, type SentinelReport } from "@/lib/report/schema";
import { generateReport, type ReportResult } from "@/lib/report/engine";
import { HABIT_QUESTIONS, type HabitAnswers } from "@/lib/report/habit";

type Brand = "dell" | "lenovo" | "hp";

interface BrandConfig {
  id: Brand;
  label: string;
  color: string;
  accent: string;
  lang: string;
  ext: string;
  filename: string;
  runner: string;
  runnerNote: string;
  scriptFile: string;
  description: string;
  steps: string[];
}

const brands: BrandConfig[] = [
  {
    id: "dell",
    label: "Dell",
    color: "text-cyan-400",
    accent: "border-cyan-400/60 bg-cyan-400/5",
    lang: "powershell",
    ext: "ps1",
    filename: "sentinel-dell-diagnostic.ps1",
    runner: "PowerShell",
    runnerNote: "Run as Administrator",
    scriptFile: "dell.ps1",
    description:
      "Comprehensive Dell hardware diagnostic — battery health, thermal sensors via Dell DCIM, SSD SMART data, memory pressure, and Dell-specific WMI namespaces including Alienware AWCC and Dell Command | Monitor integration.",
    steps: [
      "Open PowerShell as Administrator",
      'Run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass',
      "Download and run the script below",
      "Results appear in the console — full report saved to your Desktop",
    ],
  },
  {
    id: "lenovo",
    label: "Lenovo",
    color: "text-violet-400",
    accent: "border-violet-400/60 bg-violet-400/5",
    lang: "powershell",
    ext: "ps1",
    filename: "sentinel-lenovo-diagnostic.ps1",
    runner: "PowerShell",
    runnerNote: "Run as Administrator",
    scriptFile: "lenovo.ps1",
    description:
      "Deep Lenovo system diagnostic — ThinkPad battery cycle counts, Lenovo Vantage service checks, thermal zone monitoring, SSD endurance, network adapter health, and Lenovo-specific WMI classes for hardware telemetry.",
    steps: [
      "Open PowerShell as Administrator",
      'Run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass',
      "Download and run the script below",
      "Results appear in the console — full report saved to your Desktop",
    ],
  },
  {
    id: "hp",
    label: "HP",
    color: "text-blue-400",
    accent: "border-blue-400/60 bg-blue-400/5",
    lang: "python",
    ext: "py",
    filename: "sentinel-hp-diagnostic.py",
    runner: "Python 3.8+",
    runnerNote: "Windows only",
    scriptFile: "hp.py",
    description:
      "HP-specific Python diagnostic — HP Support Assistant detection, battery health via BatteryReport, HP OMEN/ENVY thermal management, WMI-based storage SMART queries, correlation engine that cross-references CPU/RAM/GPU/thermal metrics, and a habit-coaching report generator.",
    steps: [
      "Ensure Python 3.8+ is installed (python.org)",
      "Open Command Prompt or PowerShell as Administrator",
      "Download the script below",
      'Run: python sentinel-hp-diagnostic.py',
    ],
  },
];

export default function HealthTest() {
  const [activeBrand, setActiveBrand] = useState<Brand>("dell");
  const [scripts, setScripts] = useState<Record<Brand, string>>({
    dell: "",
    lenovo: "",
    hp: "",
  });
  const [loading, setLoading] = useState<Record<Brand, boolean>>({
    dell: false,
    lenovo: false,
    hp: false,
  });
  const [copied, setCopied] = useState(false);

  // Paste-back parser state
  const [pasteValue, setPasteValue] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ReportResult | null>(null);
  const [parsedData, setParsedData] = useState<SentinelReport | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const pasteRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  // Habit audit state
  const [habitAnswers, setHabitAnswers] = useState<HabitAnswers>({});
  const habitAnsweredCount = Object.keys(habitAnswers).length;
  const habitComplete = habitAnsweredCount === HABIT_QUESTIONS.length;

  const brand = brands.find((b) => b.id === activeBrand)!;
  const scriptContent = scripts[activeBrand];

  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    brands.forEach(({ id, scriptFile }) => {
      if (scripts[id]) return;
      setLoading((prev) => ({ ...prev, [id]: true }));
      fetch(`${base}scripts/${scriptFile}`)
        .then((r) => r.text())
        .then((text) => {
          setScripts((prev) => ({ ...prev, [id]: text }));
        })
        .catch(() => {
          setScripts((prev) => ({
            ...prev,
            [id]: `# Failed to load script. Please download the file directly.`,
          }));
        })
        .finally(() => {
          setLoading((prev) => ({ ...prev, [id]: false }));
        });
    });
  }, []);

  const handleCopy = () => {
    if (!scriptContent) return;
    navigator.clipboard.writeText(scriptContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    if (!scriptContent) return;
    const blob = new Blob([scriptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = brand.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = scriptContent ? scriptContent.split("\n").length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6">
            <Activity className="w-3.5 h-3.5" />
            Free Diagnostic Scripts
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Laptop Health Test
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Run a comprehensive hardware diagnostic on your Windows laptop right
            now — no software to install. Scripts are open-source and run
            locally on your machine.
          </p>
        </div>
      </section>

      {/* Brand tabs */}
      <section className="px-6 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 p-1 rounded-xl border border-border/60 bg-card/50 w-fit">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBrand(b.id)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeBrand === b.id
                    ? `${b.color} bg-card border border-border shadow-sm`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Brand description */}
          <div className={`rounded-xl border p-5 ${brand.accent}`}>
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className={`w-4 h-4 ${brand.color}`} />
                  <span className={`text-sm font-semibold ${brand.color}`}>
                    {brand.label} Diagnostic
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {brand.runner} · {brand.runnerNote}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {brand.description}
                </p>
              </div>
            </div>
          </div>

          {/* How to run */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              How to run
            </h3>
            <ol className="space-y-2">
              {brand.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full border border-primary/40 text-primary text-xs flex items-center justify-center font-mono font-bold">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">
                    {step.includes(":") ? (
                      <>
                        {step.split(":")[0]}:{" "}
                        <code className="text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">
                          {step.split(":").slice(1).join(":").trim()}
                        </code>
                      </>
                    ) : (
                      step
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Code viewer */}
          <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden shadow-xl">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-[#161b22]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {brand.filename}
                </span>
                {!loading[activeBrand] && lineCount > 0 && (
                  <span className="text-xs text-muted-foreground/60 font-mono">
                    {lineCount.toLocaleString()} lines
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!scriptContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!scriptContent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .{brand.ext}
                </button>
              </div>
            </div>

            {/* Script content */}
            <div className="relative h-[520px] overflow-auto">
              {loading[activeBrand] ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Loading script…
                </div>
              ) : scriptContent ? (
                <table className="w-full text-xs font-mono border-collapse">
                  <tbody>
                    {scriptContent.split("\n").map((line, i) => (
                      <tr
                        key={i}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="select-none text-right pr-4 pl-4 py-0.5 text-muted-foreground/40 w-12 border-r border-border/20 sticky left-0 bg-[#0d1117]">
                          {i + 1}
                        </td>
                        <td className="pl-4 pr-4 py-0.5 whitespace-pre text-slate-300 leading-5">
                          <ScriptLine
                            line={line}
                            lang={brand.lang as "powershell" | "python"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Script unavailable
                </div>
              )}
            </div>
          </div>

          {/* Sample output */}
          <SampleOutputPanel brand={activeBrand} />

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
            These scripts run entirely on your machine. No data is sent
            anywhere. The output is saved locally to your Desktop as a text
            file. Review the full source code above before running.
          </p>
        </div>
      </section>

      {/* ── Paste-back parser ──────────────────────────────────────── */}
      <section ref={pasteRef} className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-primary/30 bg-primary/3 overflow-hidden">

            {/* Header */}
            <div className="px-7 py-5 border-b border-primary/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <FileJson className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Step 3 — Parse your output</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Run the <span className="font-mono text-primary">sentinel-collect.ps1</span> script above, then paste the JSON output here. Get a real Sentinel-style report instantly — no install required.
                </p>
              </div>
              <a
                href={`${import.meta.env.BASE_URL}scripts/sentinel-collect.ps1`}
                download="sentinel-collect.ps1"
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-all"
              >
                <Download className="w-3 h-3" /> Download collector script
              </a>
            </div>

            {/* Paste area */}
            <div className="p-6 space-y-4">
              <textarea
                value={pasteValue}
                onChange={(e) => { setPasteValue(e.target.value); setParseError(null); setParsedResult(null); }}
                placeholder={'Paste JSON output here — starts with {"sentinelSchema":1,...}'}
                rows={6}
                className="w-full rounded-xl border border-border/50 bg-[#0a0e1a] text-slate-300 placeholder:text-muted-foreground/30 font-mono text-xs px-4 py-3 resize-none focus:outline-none focus:border-primary/60 transition-colors leading-relaxed"
              />

              {parseError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-400/25 bg-red-400/5 px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400/90 leading-relaxed">{parseError}</p>
                </div>
              )}

              {/* Step 1: Analyze button — validates locally and reveals habit audit */}
              {!parsedData && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (!pasteValue.trim()) { setParseError("Paste your script output first."); return; }
                      setIsParsing(true);
                      setParseError(null);
                      setParsedResult(null);
                      const { data, error } = parseReport(pasteValue);
                      if (error || !data) { setParseError(error ?? "Unknown error."); setIsParsing(false); return; }
                      setParsedData(data);
                      setHabitAnswers({});
                      setIsParsing(false);
                    }}
                    disabled={isParsing || !pasteValue.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed glow-cyan transition-all"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {isParsing ? "Parsing…" : "Analyse hardware →"}
                  </button>
                  {pasteValue && (
                    <button
                      onClick={() => { setPasteValue(""); setParseError(null); setParsedResult(null); setParsedData(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Parsed confirmation */}
              {parsedData && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <Check className="w-3.5 h-3.5" />
                  Hardware data parsed — answer a few questions to complete your report.
                  <button
                    onClick={() => { setParsedData(null); setHabitAnswers({}); }}
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* What you'll get */}
              {!parsedData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { label: "Overall health score",  detail: "Weighted across battery, thermals, storage, memory, CPU" },
                    { label: "Component breakdown",   detail: "Per-metric scores with status labels and raw readings" },
                    { label: "Plain-English findings",detail: "Prioritised by urgency with specific action steps" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
                      <div className="text-xs font-semibold text-primary mb-0.5">{item.label}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{item.detail}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 2: Habit audit ─────────────────────────────────────────── */}
      {parsedData && (
        <section className="px-6 pb-24">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl border border-accent/30 bg-accent/3 overflow-hidden">
              <div className="px-7 py-5 border-b border-accent/20 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">Step 4 — Habit audit</h2>
                    <span className="text-xs font-mono text-accent border border-accent/30 bg-accent/10 px-1.5 py-0.5 rounded">
                      {habitAnsweredCount}/{HABIT_QUESTIONS.length} answered
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your usage patterns account for 30% of your final score. Takes 30 seconds.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {HABIT_QUESTIONS.map((q) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-foreground mb-2">{q.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => {
                        const selected = habitAnswers[q.id] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setHabitAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              selected
                                ? "border-accent/60 bg-accent/15 text-accent"
                                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                            }`}
                          >
                            {selected && <span className="mr-1">✓</span>}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Generate button */}
                <div className="pt-2 flex items-center gap-4">
                  <button
                    onClick={() => {
                      if (!parsedData) return;
                      setIsParsing(true);
                      const tempId = Math.random().toString(36).slice(2, 10);
                      try { localStorage.setItem(`sentinel_report_${tempId}`, JSON.stringify(parsedData)); } catch {}
                      const answers = habitComplete ? habitAnswers : undefined;
                      fetch("/api/reports", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rawJson: parsedData, ...(answers ? { habitAnswers: answers } : {}) }),
                      })
                        .then(async (res) => {
                          if (res.ok) {
                            const { id, claimToken } = await res.json() as { id: string; claimToken: string };
                            try {
                              localStorage.setItem(`sentinel_report_${id}`, JSON.stringify(parsedData));
                              if (claimToken) localStorage.setItem(`sentinel_claim_${id}`, claimToken);
                            } catch {}
                            setIsParsing(false);
                            navigate(`/r/${id}`);
                          } else {
                            setIsParsing(false);
                            navigate(`/r/${tempId}`);
                          }
                        })
                        .catch(() => { setIsParsing(false); navigate(`/r/${tempId}`); });
                    }}
                    disabled={isParsing}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed glow-cyan transition-all"
                  >
                    {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {isParsing ? "Generating…" : habitComplete ? "Generate full report →" : "Skip & generate report →"}
                  </button>
                  {!habitComplete && (
                    <span className="text-xs text-muted-foreground/60">
                      {HABIT_QUESTIONS.length - habitAnsweredCount} question{HABIT_QUESTIONS.length - habitAnsweredCount !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sample output data ──────────────────────────────────────────────────────

type LineType = "header" | "ok" | "warn" | "crit" | "info" | "dim" | "score" | "bar" | "plain";
interface OutputLine { type: LineType; text: string; }

const SAMPLE_OUTPUTS: Record<Brand, OutputLine[]> = {
  dell: [
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "header", text: "  SENTINEL — DELL LAPTOP COMPREHENSIVE DIAGNOSTIC" },
    { type: "dim",    text: "  Wednesday, May 07, 2026 — 02:14 PM" },
    { type: "dim",    text: "  Device: Dell XPS 15 9520  |  Windows 11 Pro 22H2" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 1. SYSTEM IDENTITY & BIOS ─────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Manufacturer             : Dell Inc." },
    { type: "ok",     text: "  [OK]   Model                    : XPS 15 9520" },
    { type: "ok",     text: "  [OK]   Serial Number            : 7XK2P93" },
    { type: "ok",     text: "  [OK]   BIOS Version             : 1.18.0" },
    { type: "warn",   text: "  [WARN] BIOS Age                 : 14 months — update recommended" },
    { type: "ok",     text: "  [OK]   Windows Build            : 22621.3447" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 2. BATTERY HEALTH ──────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Design Capacity          : 86,000 mWh" },
    { type: "warn",   text: "  [WARN] Full Charge Capacity     : 67,240 mWh  (78.2% — degraded)" },
    { type: "warn",   text: "  [WARN] Cycle Count              : 412 cycles" },
    { type: "ok",     text: "  [OK]   Battery Status           : Charging" },
    { type: "warn",   text: "  [WARN] >> Battery at 78% — plan for replacement within 6–12 months." },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 3. STORAGE (SSD/NVMe) ──────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Model                    : Samsung MZVL21T0HCLR (1 TB NVMe)" },
    { type: "ok",     text: "  [OK]   Total Capacity           : 953.9 GB" },
    { type: "warn",   text: "  [WARN] Free Space               : 87.4 GB  (9.2% — critically low)" },
    { type: "ok",     text: "  [OK]   SMART Status             : PASSED" },
    { type: "ok",     text: "  [OK]   Wear Level               : 12% endurance used" },
    { type: "ok",     text: "  [OK]   Power-On Hours           : 3,241 hrs" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 4. CPU HEALTH & THERMALS ────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Processor                : Intel Core i7-12700H (20 threads)" },
    { type: "ok",     text: "  [OK]   Base Clock               : 2.3 GHz  |  Max Boost: 4.7 GHz" },
    { type: "warn",   text: "  [WARN] CPU Temperature (idle)   : 71°C — elevated at rest" },
    { type: "crit",   text: "  [CRIT] Thermal Throttle Events  : 14 in last session — performance impacted" },
    { type: "warn",   text: "  [WARN] >> High idle temperature suggests blocked vents or degraded thermal paste." },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 5. MEMORY (RAM) ─────────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Installed                : 32 GB DDR5-4800" },
    { type: "ok",     text: "  [OK]   Available                : 18.3 GB" },
    { type: "ok",     text: "  [OK]   Memory Usage             : 43%" },
    { type: "ok",     text: "  [OK]   Page Faults/sec          : 0.4  (healthy)" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 6. GPU ──────────────────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Discrete GPU             : NVIDIA GeForce RTX 3050 Ti  (4 GB GDDR6)" },
    { type: "ok",     text: "  [OK]   GPU Driver               : 546.33  (current)" },
    { type: "ok",     text: "  [OK]   GPU Temperature          : 48°C" },
    { type: "ok",     text: "  [OK]   TDR Crash Events         : 0 in last 30 days" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 15. CROSS-METRIC CORRELATION ANALYSIS ───────────────────────────" },
    { type: "crit",   text: "  >> THERMAL_PASTE_AGE: CPU throttling on 36-month-old system = thermal paste likely degraded" },
    { type: "warn",   text: "  >> SSD_PRESSURE: Low disk space (9%) risks pagefile exhaustion + update failures" },
    { type: "warn",   text: "  >> BATTERY_HEAT_DEGRADATION: Battery at 78% + sustained high thermals = accelerated wear" },
    { type: "plain",  text: "" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "crit",   text: "  Scan complete: 62 checks — 2 critical   5 warnings   55 healthy" },
    { type: "dim",    text: "  Full report saved: Desktop\\Dell_Diagnostic_Report_20260507_141422.txt" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
  ],

  lenovo: [
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "header", text: "  SENTINEL — LENOVO LAPTOP COMPREHENSIVE DIAGNOSTIC" },
    { type: "dim",    text: "  Wednesday, May 07, 2026 — 02:14 PM" },
    { type: "dim",    text: "  Device: Lenovo ThinkPad X1 Carbon Gen 11  |  Windows 11 Pro" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 1. SYSTEM IDENTITY & BIOS ─────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Manufacturer             : LENOVO" },
    { type: "ok",     text: "  [OK]   Model                    : ThinkPad X1 Carbon Gen 11" },
    { type: "ok",     text: "  [OK]   Serial Number            : PF3K92A1" },
    { type: "ok",     text: "  [OK]   BIOS Version             : N3HET62W (1.42)" },
    { type: "ok",     text: "  [OK]   BIOS Age                 : 4 months — current" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 2. BATTERY HEALTH (ThinkPad-specific) ──────────────────────────" },
    { type: "ok",     text: "  [OK]   Design Capacity          : 57,000 mWh" },
    { type: "ok",     text: "  [OK]   Full Charge Capacity     : 54,720 mWh  (96.0% — excellent)" },
    { type: "ok",     text: "  [OK]   Cycle Count              : 87 cycles  (low)" },
    { type: "ok",     text: "  [OK]   Lenovo Battery Guard     : Active — charging capped at 80%" },
    { type: "ok",     text: "  [OK]   Discharge Rate           : -8.4 W  (light use)" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 3. STORAGE ─────────────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Model                    : WD SN850X 512 GB NVMe" },
    { type: "ok",     text: "  [OK]   Free Space               : 214.7 GB  (43.8%)" },
    { type: "ok",     text: "  [OK]   SMART Status             : PASSED" },
    { type: "ok",     text: "  [OK]   Wear Level               : 3% endurance used" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 4. CPU & THERMALS ───────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Processor                : Intel Core i7-1365U (10 threads)" },
    { type: "ok",     text: "  [OK]   CPU Temperature (idle)   : 44°C — excellent" },
    { type: "ok",     text: "  [OK]   Thermal Throttle Events  : 0 in last session" },
    { type: "info",   text: "  [INFO] Lenovo Thermal Mode      : Balanced" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 5. MEMORY ───────────────────────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Installed                : 16 GB LPDDR5-6400 (soldered)" },
    { type: "ok",     text: "  [OK]   Available                : 9.1 GB" },
    { type: "warn",   text: "  [WARN] Memory Usage             : 69% — moderately high" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 7. STARTUP & BOOT PERFORMANCE ──────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Boot Duration            : 11.3 seconds" },
    { type: "ok",     text: "  [OK]   BIOS POST Time           : 3.1 seconds" },
    { type: "ok",     text: "  [OK]   Startup Programs         : 8  (healthy)" },
    { type: "ok",     text: "  [OK]   Unexpected Shutdowns     : 0 in last 30 days" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 8. LENOVO-SPECIFIC SERVICES ────────────────────────────────────" },
    { type: "ok",     text: "  [OK]   Lenovo Vantage Service   : Running" },
    { type: "ok",     text: "  [OK]   Lenovo System Interface  : Running" },
    { type: "ok",     text: "  [OK]   Lenovo PM Service        : Running" },
    { type: "ok",     text: "  [OK]   Intel ME Firmware        : Healthy" },
    { type: "plain",  text: "" },
    { type: "header", text: "  ── 15. CORRELATION ANALYSIS ────────────────────────────────────────" },
    { type: "ok",     text: "  [OK] No significant cross-metric correlation issues detected." },
    { type: "plain",  text: "" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
    { type: "ok",     text: "  Scan complete: 58 checks — 0 critical   1 warning   57 healthy" },
    { type: "dim",    text: "  Full report saved: Desktop\\Lenovo_Diagnostic_Report_20260507_141422.txt" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════════" },
  ],

  hp: [
    { type: "header", text: "══════════════════════════════════════════════════════════════════" },
    { type: "header", text: "  HP LAPTOP WEEKLY HEALTH REPORT" },
    { type: "dim",    text: "  Wednesday, May 07, 2026 — 02:14 PM" },
    { type: "dim",    text: "  Device: HP ENVY x360 15-ew0xxx" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════" },
    { type: "plain",  text: "" },
    { type: "header", text: "  OVERALL HEALTH SCORE:  74/100  (C — Fair)" },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  ── COMPONENT BREAKDOWN ──────────────────────────────────────────" },
    { type: "ok",     text: "  ✓ Battery     [████████████████░░░░] 82/100" },
    { type: "warn",   text: "  ⚠ Storage     [████████████░░░░░░░░] 61/100" },
    { type: "ok",     text: "  ✓ Processor   [████████████████████] 95/100" },
    { type: "ok",     text: "  ✓ Memory      [██████████████░░░░░░] 74/100" },
    { type: "ok",     text: "  ✓ Graphics    [████████████████░░░░] 80/100" },
    { type: "warn",   text: "  ⚠ Cooling     [██████████░░░░░░░░░░] 55/100" },
    { type: "ok",     text: "  ✓ Startup     [████████████████████] 90/100" },
    { type: "ok",     text: "  ✓ Network     [██████████████████░░] 88/100" },
    { type: "warn",   text: "  ⚠ Drivers     [██████████████░░░░░░] 70/100" },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  ── ⚠ URGENT — ACTION REQUIRED ──────────────────────────────────" },
    { type: "plain",  text: "" },
    { type: "crit",   text: "  [STORAGE] SSD Free Space: 47 GB Remaining (Only 9%)" },
    { type: "plain",  text: "  → Your SSD is nearly full at 91% capacity. Windows needs 10–15% free" },
    { type: "plain",  text: "    space to run updates, create restore points, and avoid drive errors." },
    { type: "plain",  text: "  → What to do: Run Disk Cleanup (search in Start menu), then move large" },
    { type: "plain",  text: "    files to an external drive or cloud storage." },
    { type: "plain",  text: "  → If ignored: Updates will begin to fail silently, and the SSD will" },
    { type: "plain",  text: "    degrade faster without space to wear-level properly." },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  ── ⚡ WORTH YOUR ATTENTION ──────────────────────────────────────" },
    { type: "plain",  text: "" },
    { type: "warn",   text: "  [THERMALS] CPU Temperature at Idle: 78°C" },
    { type: "plain",  text: "  → Your processor runs unusually hot even when the laptop is idle." },
    { type: "plain",  text: "  → Tip: Check for blocked vents. A $15 laptop stand can drop temps 10°C." },
    { type: "plain",  text: "" },
    { type: "warn",   text: "  [DRIVERS] HP Support Assistant Not Found" },
    { type: "plain",  text: "  → HP Support Assistant isn't installed. This keeps drivers & firmware" },
    { type: "plain",  text: "    updated automatically — important for thermal and battery management." },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  ── 🔍 PATTERNS DETECTED ─────────────────────────────────────────" },
    { type: "plain",  text: "" },
    { type: "info",   text: "  🔍 Pattern: High CPU temperature + full disk together suggest your laptop" },
    { type: "info",   text: "     is working harder than it should just to stay stable. Vents are likely" },
    { type: "info",   text: "     blocked with dust — cleaning them could fix both problems at once." },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  ── 💡 YOUR USAGE HABITS ────────────────────────────────────────" },
    { type: "plain",  text: "" },
    { type: "info",   text: "  💡 Cooling Habit: Your laptop runs hot during typical use. Check where" },
    { type: "info",   text: "     you use it — soft surfaces block the bottom vents. A laptop stand" },
    { type: "info",   text: "     or cooling pad can drop temperatures by 10–15°C." },
    { type: "plain",  text: "" },
    { type: "info",   text: "  💡 Storage Habit: Your drive is often near-full. Run Disk Cleanup" },
    { type: "info",   text: "     weekly. Windows needs 10–15% free to run properly." },
    { type: "plain",  text: "" },
    { type: "dim",    text: "  All clear items not listed to keep this brief." },
    { type: "dim",    text: "  Next recommended scan: May 14, 2026" },
    { type: "header", text: "══════════════════════════════════════════════════════════════════" },
  ],
};

// ─── Sample output panel (collapsible wrapper) ───────────────────────────────

function SampleOutputPanel({ brand }: { brand: Brand }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            See sample output
          </span>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            What you'll see after running the script
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border/60">
          <SampleOutput brand={brand} />
        </div>
      )}
    </div>
  );
}

// ─── Sample output renderer ───────────────────────────────────────────────────

function SampleOutput({ brand }: { brand: Brand }) {
  const lines = SAMPLE_OUTPUTS[brand];

  const colorMap: Record<LineType, string> = {
    header: "text-cyan-400/80",
    ok:     "text-green-400",
    warn:   "text-yellow-400",
    crit:   "text-red-400 font-semibold",
    info:   "text-blue-300",
    dim:    "text-slate-500",
    score:  "text-cyan-300 font-bold",
    bar:    "text-slate-300",
    plain:  "text-slate-300",
  };

  return (
    <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden shadow-xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-[#161b22]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          PowerShell — Sample Output Preview
        </span>
      </div>
      {/* Lines */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto p-4 space-y-px font-mono text-xs leading-5">
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre ${colorMap[line.type]}`}>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

// Minimal syntax highlighting without a library
function ScriptLine({
  line,
  lang,
}: {
  line: string;
  lang: "powershell" | "python";
}) {
  // Comments
  if (lang === "powershell" && line.trimStart().startsWith("#")) {
    return <span className="text-slate-500">{line}</span>;
  }
  if (lang === "python" && line.trimStart().startsWith("#")) {
    return <span className="text-slate-500">{line}</span>;
  }

  // Section headers (all-caps comment lines in PS)
  if (
    lang === "powershell" &&
    line.includes("===") &&
    line.includes("SECTION")
  ) {
    return <span className="text-primary/60">{line}</span>;
  }

  // String literals
  if (line.includes('"') || line.includes("'")) {
    return <HighlightStrings line={line} lang={lang} />;
  }

  // Keywords
  return <HighlightKeywords line={line} lang={lang} />;
}

const PS_KEYWORDS =
  /(function|if|else|elseif|foreach|for|while|return|param|begin|process|end|try|catch|finally|switch|break|continue|Write-Host|Write-Item|Write-Section|Get-WmiObject|Get-CimInstance|Get-WinEvent|Get-NetAdapter|Get-Process|Get-Service|Test-Path|Select-Object|Where-Object|ForEach-Object|Measure-Object|Sort-Object|Format-Table|Out-File|New-Object|Invoke-Command|Set-ExecutionPolicy|powercfg|wmic)/g;

const PY_KEYWORDS =
  /\b(def|class|if|elif|else|for|while|return|import|from|try|except|finally|with|as|in|not|and|or|is|None|True|False|pass|break|continue|raise|yield|lambda|global|nonlocal|del|assert)\b/g;

function HighlightKeywords({
  line,
  lang,
}: {
  line: string;
  lang: "powershell" | "python";
}) {
  const pattern = lang === "powershell" ? PS_KEYWORDS : PY_KEYWORDS;
  // split() with a capture group interleaves [text, match, text, match, ...]
  const parts = line.split(pattern);
  const result: React.ReactNode[] = [];

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      result.push(
        <span key={i} className="text-violet-400 font-medium">
          {part}
        </span>
      );
    } else {
      result.push(<span key={i}>{part}</span>);
    }
  });

  return <>{result}</>;
}

function HighlightStrings({
  line,
  lang,
}: {
  line: string;
  lang: "powershell" | "python";
}) {
  const strPattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const parts = line.split(strPattern);
  return (
    <>
      {parts.map((part, i) => {
        if (
          (part.startsWith('"') && part.endsWith('"')) ||
          (part.startsWith("'") && part.endsWith("'"))
        ) {
          return (
            <span key={i} className="text-green-400/90">
              {part}
            </span>
          );
        }
        return <HighlightKeywords key={i} line={part} lang={lang} />;
      })}
    </>
  );
}
