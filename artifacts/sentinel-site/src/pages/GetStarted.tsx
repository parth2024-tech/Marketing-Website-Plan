import { useState } from "react";
import { Link } from "wouter";
import { Download, Zap, Terminal, ChevronDown, ArrowRight, Shield, Clock, RefreshCw, CheckCircle } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
      {children}
    </span>
  );
}

function TierCard({
  tier,
  icon: Icon,
  label,
  tagline,
  description,
  bullets,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  recommended,
  accentClass,
  borderClass,
}: {
  tier: string;
  icon: React.ElementType;
  label: string;
  tagline: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  recommended?: boolean;
  accentClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={`relative surface-card rounded-2xl p-8 flex flex-col gap-6 border transition-all duration-300 ${
        recommended ? "border-primary/50 shadow-[0_0_40px_-12px_var(--color-primary)]" : `${borderClass}`
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-8">
          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-primary text-background">
            RECOMMENDED
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${accentClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{tier}</p>
          <h3 className="text-xl font-bold text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground mt-1">{tagline}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

      <ul className="flex flex-col gap-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/80">
            <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {ctaHref ? (
          <a
            href={ctaHref}
            className={`inline-flex w-full items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 ${
              recommended
                ? "bg-primary text-background hover:bg-primary/90 glow-cyan"
                : "bg-card border border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <Download className="w-4 h-4" />
            {ctaLabel}
          </a>
        ) : (
          <button
            onClick={ctaOnClick}
            className={`inline-flex w-full items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 ${
              recommended
                ? "bg-primary text-background hover:bg-primary/90 glow-cyan"
                : "bg-card border border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function FlowStep({ step, label, sub }: { step: string; label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
        <span className="text-xs font-mono font-bold text-primary">{step}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground max-w-[120px] leading-relaxed">{sub}</p>
    </div>
  );
}

export default function GetStarted() {
  const [legacyOpen, setLegacyOpen] = useState(false);

  return (
    <div className="px-6 py-20">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <AnimateIn>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="mb-5">
              <Badge>GET STARTED</Badge>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6">
              Choose how Sentinel{" "}
              <span className="gradient-text">collects your data.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Pick the path that matches your comfort level. All three produce the same report — they only differ in how much friction you're willing to accept.
            </p>
          </div>
        </AnimateIn>

        {/* Tier 1 + 2 cards */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" staggerDelay={0.08}>
          <StaggerItem>
            <TierCard
              tier="TIER 1 · AGENT"
              icon={Shield}
              label="Sentinel Agent"
              tagline="Install once. Never think about it again."
              description="A lightweight background service that scans your hardware on a schedule and uploads reports automatically. Your report is waiting in your browser before you've even noticed it ran."
              bullets={[
                "One-click install — no terminal, no scripts",
                "First report appears in your browser automatically",
                "Repeats every 7 days via Windows Scheduled Task",
                "Weekly email: 'your new report is ready'",
                "Visible in system tray with Pause / Uninstall options",
              ]}
              ctaLabel="Download Sentinel Agent"
              ctaHref="#agent-download"
              recommended
              accentClass="bg-primary/10 border-primary/30 text-primary"
              borderClass="border-border/60"
            />
          </StaggerItem>

          <StaggerItem>
            <TierCard
              tier="TIER 2 · ONE-SHOT"
              icon={Zap}
              label="One-Shot Scan"
              tagline="Run once. Upload. Done."
              description="The same scanner, without the background service. Double-click the executable, wait 10 seconds, and your browser opens to your report. Nothing stays installed."
              bullets={[
                "Single double-click — no PowerShell, no paste",
                "Scans, uploads, and opens your report in ~10 seconds",
                "Deletes itself after running — nothing persists",
                "No UAC surprises beyond the initial prompt",
                "Re-download whenever you want a new scan",
              ]}
              ctaLabel="Download One-Shot Scan"
              ctaHref="#oneshot-download"
              accentClass="bg-accent/10 border-accent/30 text-accent"
              borderClass="border-border/40"
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Tier 1 flow diagram */}
        <AnimateIn delay={0.15}>
          <div className="surface-card rounded-2xl p-8 mb-8 border border-border/40">
            <p className="text-xs font-mono text-muted-foreground mb-6 text-center tracking-widest">TIER 1 · HOW THE AGENT FLOW WORKS</p>
            <div className="flex flex-wrap items-start justify-center gap-4">
              <FlowStep step="1" label="Download" sub="SentinelSetup.exe from this page" />
              <div className="hidden sm:flex items-center self-center mt-[-20px]">
                <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <FlowStep step="2" label="Install" sub="Standard Windows installer, asks for email" />
              <div className="hidden sm:flex items-center self-center mt-[-20px]">
                <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <FlowStep step="3" label="Pair" sub="Browser opens to pair your device to your account" />
              <div className="hidden sm:flex items-center self-center mt-[-20px]">
                <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <FlowStep step="4" label="First report" sub="Browser opens to your report automatically" />
              <div className="hidden sm:flex items-center self-center mt-[-20px]">
                <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <FlowStep step="5" label="Auto-repeat" sub="Scheduled task runs every 7 days, you get an email" />
            </div>
          </div>
        </AnimateIn>

        {/* Trust signals row */}
        <AnimateIn delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
            {[
              { icon: Shield,      label: "Code-signed binary",   sub: "SmartScreen-friendly, OV certificate" },
              { icon: Clock,       label: "~5–10 MB install size", sub: "No runtimes, no bundled JRE" },
              { icon: RefreshCw,   label: "Standard uninstaller",  sub: "Add/Remove Programs — one click to remove" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4 rounded-xl bg-muted/10 border border-border/30">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>

        {/* Legacy / Advanced disclosure */}
        <AnimateIn delay={0.25}>
          <div className="border border-border/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setLegacyOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Advanced / IT admin</span>
                  <span className="ml-3 text-xs font-mono text-muted-foreground/50">PowerShell paste-back</span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${legacyOpen ? "rotate-180" : ""}`}
              />
            </button>

            {legacyOpen && (
              <div className="px-6 pb-6 pt-2 border-t border-border/30 bg-muted/5">
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  For locked-down corporate machines or users who want to inspect the script before running. This is the original flow — it works, but every manual step is a drop-off point. We recommend it only if the executables above are blocked by your IT policy.
                </p>

                <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs mb-5 space-y-1">
                  <div className="text-muted-foreground/50"># PowerShell paste-back flow</div>
                  <div className="text-cyan-400">1. Download <span className="text-slate-300">SentinelScan.ps1</span></div>
                  <div className="text-cyan-400">2. Unblock-File <span className="text-slate-300">.\SentinelScan.ps1</span></div>
                  <div className="text-cyan-400">3. .\SentinelScan.ps1 <span className="text-slate-300"># copies base64 JSON to clipboard</span></div>
                  <div className="text-cyan-400">4. Paste blob <span className="text-slate-300">→ /health-test → submit</span></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="#ps-dell"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Dell script (.ps1)
                  </a>
                  <a
                    href="#ps-lenovo"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Lenovo script (.ps1)
                  </a>
                  <a
                    href="#ps-hp"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    HP script (.py)
                  </a>
                  <Link
                    href="/health-test"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Open paste-back form
                  </Link>
                </div>
              </div>
            )}
          </div>
        </AnimateIn>

        {/* Bottom CTA */}
        <AnimateIn delay={0.3}>
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">Not ready to install anything?</p>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4"
            >
              View a sample report first
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}
