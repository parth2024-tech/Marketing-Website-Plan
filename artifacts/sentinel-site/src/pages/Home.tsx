import { Link } from "wouter";
import { Download, ArrowRight, Cpu, Battery, HardDrive, Thermometer, Wifi, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import WaitlistForm, { WaitlistCount } from "@/components/WaitlistForm";
import HealthFeed from "@/components/HealthFeed";

const metrics = [
  { label: "CPU Usage", value: "< 1%", color: "text-primary" },
  { label: "Data Sent", value: "Zero Cloud", color: "text-primary" },
  { label: "Warning Time", value: "Weeks Early", color: "text-accent" },
  { label: "Windows", value: "10 & 11", color: "text-muted-foreground" },
];

const differentiators = [
  {
    icon: TrendingUp,
    title: "Predictive, not reactive",
    description: "Sentinel spots degradation patterns weeks before hardware fails — giving you time to act, not just react.",
    color: "text-primary",
  },
  {
    icon: CheckCircle,
    title: "Plain English only",
    description: "No cryptic codes or tech jargon. Every alert is a clear sentence a non-engineer can understand and act on.",
    color: "text-accent",
  },
  {
    icon: AlertTriangle,
    title: "Runs completely offline",
    description: "All analysis happens on your machine. Nothing is sent to any server. Your hardware data stays yours.",
    color: "text-primary",
  },
];

const featureHighlights = [
  { icon: Battery, label: "Battery health prediction", color: "text-primary" },
  { icon: HardDrive, label: "SSD wear detection", color: "text-accent" },
  { icon: Thermometer, label: "Thermal pattern analysis", color: "text-primary" },
  { icon: Cpu, label: "CPU anomaly detection", color: "text-accent" },
  { icon: Wifi, label: "Network stability tracking", color: "text-primary" },
];

// Animated diagnostic visual
function DiagnosticVisual() {
  return (
    <div className="relative w-80 h-80 mx-auto">
      {/* Rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-72 h-72 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "0s" }} />
        <div className="absolute w-72 h-72 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
        <div className="absolute w-72 h-72 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "1.6s" }} />
      </div>

      {/* Static rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 rounded-full border border-border/30" />
        <div className="absolute w-44 h-44 rounded-full border border-border/20" />
        <div className="absolute w-24 h-24 rounded-full border border-primary/30 animate-spin-slow" />
      </div>

      {/* Scan line overlay */}
      <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-scan-line"
          style={{ top: "20%" }}
        />
      </div>

      {/* Center core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-16 h-16 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center glow-cyan">
          <div className="w-6 h-6 rounded-full bg-primary animate-glow-pulse" />
        </div>
      </div>

      {/* Floating metric chips */}
      <div
        className="absolute top-4 right-8 px-2.5 py-1.5 rounded-md bg-card border border-primary/30 font-mono text-xs text-primary animate-float-chip"
        style={{ animationDelay: "0s" }}
        data-testid="chip-cpu"
      >
        CPU <span className="text-foreground ml-1">23%</span>
      </div>
      <div
        className="absolute bottom-12 left-2 px-2.5 py-1.5 rounded-md bg-card border border-accent/30 font-mono text-xs text-accent animate-float-chip"
        style={{ animationDelay: "1s" }}
        data-testid="chip-temp"
      >
        TEMP <span className="text-foreground ml-1">67°C</span>
      </div>
      <div
        className="absolute top-16 left-0 px-2.5 py-1.5 rounded-md bg-card border border-primary/30 font-mono text-xs text-primary animate-float-chip"
        style={{ animationDelay: "0.5s" }}
        data-testid="chip-battery"
      >
        BATT <span className="text-foreground ml-1">94%</span>
      </div>
      <div
        className="absolute bottom-8 right-4 px-2.5 py-1.5 rounded-md bg-card border border-primary/30 font-mono text-xs text-primary animate-float-chip"
        style={{ animationDelay: "1.5s" }}
        data-testid="chip-ssd"
      >
        SSD <span className="text-foreground ml-1">98%</span>
      </div>

      {/* Status dot */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/80 border border-border/60 font-mono text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
        <span className="text-muted-foreground">NOMINAL</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden px-6">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-20">
          {/* Copy */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-medium border border-primary/30 text-primary bg-primary/10">
                EARLY ACCESS
              </span>
              <span className="text-xs text-muted-foreground font-mono animate-blink">|</span>
              <span className="text-xs text-muted-foreground font-mono">Windows 10 &amp; 11</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]" data-testid="heading-hero">
              Knows your laptop is sick{" "}
              <span className="gradient-text">weeks before you do.</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              Sentinel watches your hardware 24/7 and surfaces problems in plain English — before a failure ruins your day, your data, or your deadline.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <a
                href="#"
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
                data-testid="button-download"
              >
                <Download className="w-4 h-4" />
                Download for Windows
              </a>
              <Link
                href="/waitlist"
                className="flex items-center gap-2 px-6 py-3.5 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all duration-200"
                data-testid="button-waitlist-hero"
              >
                Join the Waitlist
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Visual */}
          <div className="flex items-center justify-center">
            <DiagnosticVisual />
          </div>
        </div>
      </section>

      {/* Metric strip */}
      <section className="border-y border-border/60 bg-card/40 px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-1 text-center" data-testid={`metric-${m.label.toLowerCase().replace(/\s/g, "-")}`}>
              <span className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Differentiators */}
      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">A different kind of system monitor</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Most tools show you what's happening right now. Sentinel shows you what's coming.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {differentiators.map((d) => (
              <div
                key={d.title}
                className="surface-card rounded-xl p-8 flex flex-col gap-5 hover:border-primary/40 transition-colors group"
                data-testid={`card-differentiator-${d.title.replace(/\s/g, "-").toLowerCase()}`}
              >
                <div className={`w-10 h-10 rounded-lg bg-current/10 flex items-center justify-center ${d.color}`}>
                  <d.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{d.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="px-6 py-16 bg-card/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight">Monitors everything that matters</h2>
            <p className="mt-3 text-muted-foreground text-sm">12 hardware subsystems. One silent guardian.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {featureHighlights.map((f) => (
              <div
                key={f.label}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm font-medium transition-all hover:border-primary/40 ${f.color}`}
                data-testid={`chip-feature-${f.label.replace(/\s/g, "-").toLowerCase()}`}
              >
                <f.icon className="w-4 h-4" />
                <span className="text-foreground">{f.label}</span>
              </div>
            ))}
            <Link
              href="/what-it-monitors"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/40 text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
            >
              View all 12 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Live health feed */}
      <HealthFeed />

      {/* Waitlist section */}
      <section className="px-6 py-28" id="waitlist">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-cyan">
              <div className="w-3 h-3 rounded-full bg-primary animate-glow-pulse" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Be first to know.</h2>
            <p className="text-muted-foreground leading-relaxed">
              Sentinel is in private development. Join the waitlist and we'll notify you the moment early access opens.
            </p>
          </div>
          <div className="w-full max-w-md">
            <WaitlistForm />
            <div className="mt-3 flex justify-center">
              <WaitlistCount />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">No spam. No marketing. Just a launch notification.</p>
        </div>
      </section>
    </div>
  );
}
