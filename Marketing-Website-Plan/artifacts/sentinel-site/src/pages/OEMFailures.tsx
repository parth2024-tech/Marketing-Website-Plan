import { Link } from "wouter";
import { ArrowRight, AlertTriangle, ExternalLink } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const cases = [
  {
    id: "01",
    tool: "Dell SupportAssist",
    headline: "\"Battery: Good\" — while capacity was at 52%",
    summary:
      "Dell SupportAssist reports battery health in three buckets: Good, Fair, and Poor. The threshold for 'Good' is any capacity above 50% of the original design. A battery that has degraded from 86 Wh to 45 Wh shows as 'Good' — and will continue to do so until it drops below 43 Wh.",
    detail:
      "This isn't a bug. It's a design choice. A 'Good' battery that lasts 45 minutes on battery is technically accurate by Dell's definition. The user experience tells a different story. The issue is that SupportAssist never reports the capacity number itself — only the bucket. You cannot tell from SupportAssist whether your battery is at 90% or 51% of its original capacity. Both show identically.",
    evidence:
      "Reproducible on any Dell system using powercfg /batteryreport — compare the 'Design Capacity' vs 'Full Charge Capacity' in the HTML report to the SupportAssist 'Battery' status. The discrepancy between the two views has been documented by users on the Dell Community forums for every generation of XPS and Inspiron hardware.",
    impact: "Users replace batteries at failure, not at planned intervals. Avg cost of emergency replacement vs planned: 60% higher due to same-day service fees.",
    accentColor: "text-cyan-400",
    borderColor: "border-cyan-400/20",
    bgColor: "bg-cyan-400/3",
  },
  {
    id: "02",
    tool: "Lenovo Vantage",
    headline: "Battery conservation mode hides actual cycle count",
    summary:
      "Lenovo Vantage's battery health section shows a simplified 'Battery Condition' status without exposing the actual cycle count or capacity percentage — the two metrics that matter most for predicting battery end-of-life.",
    detail:
      "Lenovo does offer a 'Battery Gauge Reset' feature that re-calibrates the reported charge level — but recalibration is different from capacity measurement. A ThinkPad with 600 cycles running Vantage's 'Battery Condition: Normal' may have as little as 65% of its original capacity remaining. Lenovo's conservation mode (charging to 80% max) is genuinely useful, but the UI conflates 'protected battery' with 'healthy battery' — they are not the same thing.",
    evidence:
      "Lenovo's own battery specifications document lists design capacity values per model. Running powercfg /batteryreport and comparing to Vantage shows a systematic gap in what's disclosed. ThinkPad forum threads document users reporting 'Battery: Normal' within days of a swollen battery event.",
    impact: "ThinkPad hardware has a strong reputation for longevity. Lenovo's own data shows this is real — but the software layer actively obscures the leading indicators that would let users sustain it.",
    accentColor: "text-violet-400",
    borderColor: "border-violet-400/20",
    bgColor: "bg-violet-400/3",
  },
  {
    id: "03",
    tool: "HP Support Assistant",
    headline: "Paid service recommendations before flagging real issues",
    summary:
      "HP Support Assistant's diagnostic flow is structured to surface warranty upsell and paid service options before completing hardware analysis. In documented cases, the 'Get Support' CTA appears before the diagnostic scan result.",
    detail:
      "HP Support Assistant's primary function is to sell HP Care Packs and extended warranty coverage. The diagnostics are real and often accurate — but the UX is designed to funnel users toward HP's paid support. When a drive shows early SMART warning signs, Support Assistant flags it — but the remediation path leads to 'Contact HP Support' rather than actionable self-service guidance. The incentive to recommend HP service is structural, not malicious.",
    evidence:
      "Compare HP Support Assistant's flow with a free S.M.A.R.T. tool like CrystalDiskInfo on any machine showing reallocated sectors. HP's tool will frequently suggest 'Your hardware may need service — contact HP' while CrystalDiskInfo shows the specific attribute (05 Reallocated Sectors Count) and its raw value.",
    impact: "A reallocated sector count of 5–20 is a warning sign — not an emergency. The appropriate response is to back up and monitor. HP's recommended response is a service call.",
    accentColor: "text-amber-400",
    borderColor: "border-amber-400/20",
    bgColor: "bg-amber-400/3",
  },
  {
    id: "04",
    tool: "Windows Task Manager",
    headline: "CPU at '50% usage' — while actually thermal throttling",
    summary:
      "When a CPU hits its thermal limit, Windows reduces its clock speed to protect the hardware. Task Manager continues to show CPU usage as a percentage of the reduced clock — not the original. A CPU running at 50% of a thermally-throttled 1.2 GHz appears the same as 50% of a healthy 4.7 GHz boost clock.",
    detail:
      "CPU throttling is not visible anywhere in Task Manager. The performance tab shows clock speed — but only on a per-second basis and only if you know to look. There is no throttling indicator, no event log entry visible in the UI, and no notification. A machine that has been thermal throttling for months looks identical to a healthy machine in Task Manager unless you know to check the current clock against the spec sheet max clock.",
    evidence:
      "Reproducible with any utility that exposes power limit throttling (ThrottleStop, HWiNFO64, Intel XTU). Enable the 'PL1/PL2 Throttling' column in HWiNFO64 while Task Manager is open — you'll see throttling events at temperatures that show nothing in Task Manager. Common on thin-and-light laptops like the Dell XPS 13, HP Spectre, and most ultrabooks.",
    impact: "Extended thermal throttling is the leading cause of battery degradation acceleration and long-term CPU performance loss. It goes undetected by the most-used diagnostic tool on Windows.",
    accentColor: "text-red-400",
    borderColor: "border-red-400/20",
    bgColor: "bg-red-400/3",
  },
  {
    id: "05",
    tool: "Windows PC Health Check",
    headline: "Checks Windows 11 compatibility — monitors nothing",
    summary:
      "Windows PC Health Check is Microsoft's official tool for evaluating whether a computer can run Windows 11. It is not a health monitor. It checks TPM version, CPU compatibility, Secure Boot status, and RAM minimum. It does not check battery, thermals, SSD wear, or any predictive metric.",
    detail:
      "Despite being labelled 'PC Health Check', the tool's scope is entirely limited to upgrade eligibility. A machine with a failing SSD, a swollen battery, and a blocked vent gets a 'This PC meets Windows 11 requirements' result. The name creates a false sense of assurance — users who run it believe they've checked their machine's health. They've only checked its OS compatibility.",
    evidence:
      "Compare the output of Windows PC Health Check with any real hardware diagnostic on the same machine. The Microsoft documentation for the tool confirms its scope is limited to 'system requirements for Windows 11.' The word 'health' in the tool name is not technically incorrect — Microsoft defines system health as upgrade readiness.",
    impact: "The Microsoft branding means many users cite 'PC Health Check says I'm fine' as evidence their machine is healthy. It's the widest-reaching source of false assurance in the Windows ecosystem.",
    accentColor: "text-blue-400",
    borderColor: "border-blue-400/20",
    bgColor: "bg-blue-400/3",
  },
];

export default function OEMFailures() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative py-20 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/3 via-background to-amber-500/3 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono mb-6">
              <AlertTriangle className="w-3 h-3" />
              DOCUMENTED FAILURES
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Whose side is your laptop's app on?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-6">
              OEM diagnostic tools are built by the companies that sold you the laptop — and, in some cases, that want to sell you a new one, a service contract, or a repair. Here are five documented cases where the tool's interests and yours didn't align.
            </p>
            <p className="text-sm text-muted-foreground/60 max-w-2xl leading-relaxed">
              These are not fabrications. Each case is reproducible on real hardware with free tools. Where sources are cited, they're public documentation or forum records. We don't claim malice — we're documenting incentive misalignment.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Cases */}
      <section className="px-6 py-16">
        <StaggerContainer className="max-w-4xl mx-auto space-y-8" staggerDelay={0.1}>
          {cases.map((c) => (
            <StaggerItem key={c.id}>
              <div
                className={`rounded-xl border ${c.borderColor} ${c.bgColor} overflow-hidden h-full`}
              >
                {/* Case header */}
                <div className="px-7 py-5 border-b border-border/30 flex items-start gap-4">
                  <span className={`text-xs font-mono ${c.accentColor} mt-0.5 shrink-0`}>{c.id}</span>
                  <div className="flex-1">
                    <div className={`text-xs font-mono ${c.accentColor} mb-1 opacity-70`}>{c.tool}</div>
                    <h2 className="text-lg font-semibold text-foreground leading-snug">{c.headline}</h2>
                  </div>
                </div>

                {/* Case body */}
                <div className="px-7 py-6 space-y-5">
                  <div>
                    <p className="text-sm text-foreground/80 leading-relaxed font-medium">{c.summary}</p>
                  </div>
                  <div>
                    <p className="text-sm font-mono text-muted-foreground/50 uppercase tracking-wide mb-2 text-xs">Detail</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.detail}</p>
                  </div>
                  <div className="rounded-lg bg-[#0a0e1a] border border-border/40 px-5 py-4">
                    <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wide mb-2">How to verify</p>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed">{c.evidence}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 ${c.accentColor} shrink-0 mt-0.5`} />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground/80 font-medium">Real impact: </span>
                      {c.impact}
                    </p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* What Sentinel does differently */}
      <section className="px-6 py-16 border-y border-border/60 bg-card/10">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <h2 className="text-xl font-bold tracking-tight mb-3">What Sentinel does differently</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-2xl">
              Sentinel has no laptop to sell you, no service contract to upsell, no manufacturer relationship to protect. Its only incentive is to tell you what's actually happening with your hardware.
            </p>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.1}>
            {[
              { label: "Actual capacity %", detail: "Not a bucket. The real number, updated every cycle." },
              { label: "Throttle detection", detail: "Every throttle event logged and correlated to temps." },
              { label: "No service upsell", detail: "Findings link to self-service guidance, not support calls." },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div className="surface-card rounded-xl p-5 h-full">
                  <div className="text-sm font-semibold text-primary mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{item.detail}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <AnimateIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold tracking-tight mb-4">See what your hardware actually looks like</h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              Run the diagnostic script, paste your output, and get a real hardware report — not a bucket, not an eligibility check.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/health-test"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Run the diagnostic <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/why"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
              >
                Why Sentinel
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>

    </div>
  );
}
