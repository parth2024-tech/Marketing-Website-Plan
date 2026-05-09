import { Link } from "wouter";
import { Brain, Fingerprint, BookOpen, MessageSquare, FileText, Lightbulb, GitBranch, TrendingUp, ArrowRight } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const features = [
  {
    icon: TrendingUp,
    title: "Predictive diagnosis",
    badge: "CORE",
    badgeColor: "text-primary border-primary/30 bg-primary/10",
    description: "Detects degradation trends in hardware metrics before they cross critical thresholds. Sentinel flags a problem weeks before it would appear in a traditional monitor.",
  },
  {
    icon: Fingerprint,
    title: "Learns your machine",
    badge: "ADAPTIVE",
    badgeColor: "text-accent border-accent/30 bg-accent/10",
    description: "Every laptop behaves differently based on usage patterns, environment, and age. Sentinel builds a personalized baseline over the first few days — then alerts only when your machine deviates from its own normal.",
  },
  {
    icon: BookOpen,
    title: "Habit coaching",
    badge: "SMART",
    badgeColor: "text-primary border-primary/30 bg-primary/10",
    description: "Identifies usage behaviors that accelerate wear — like always running at 100% charge or blocking vents during heavy workloads — and suggests simple changes to extend hardware life.",
  },
  {
    icon: MessageSquare,
    title: "Plain English alerts",
    badge: "CLEAR",
    badgeColor: "text-accent border-accent/30 bg-accent/10",
    description: "No error codes. No technical jargon. Every notification is a sentence written for a human: 'Your SSD is showing early signs of wear. Consider backing up soon.'",
  },
  {
    icon: FileText,
    title: "Weekly health report",
    badge: "WEEKLY",
    badgeColor: "text-primary border-primary/30 bg-primary/10",
    description: "A brief, readable summary delivered every week. Covers the health trend across all 12 monitored subsystems, any anomalies detected, and actions recommended.",
  },
  {
    icon: Lightbulb,
    title: "Personalized tips",
    badge: "TAILORED",
    badgeColor: "text-accent border-accent/30 bg-accent/10",
    description: "Advice generated specifically for your machine and usage — not generic tech tips. If your battery is degrading faster than it should for your laptop's age, Sentinel explains why and what to do.",
  },
  {
    icon: GitBranch,
    title: "Correlation detection",
    badge: "INTELLIGENT",
    badgeColor: "text-primary border-primary/30 bg-primary/10",
    description: "Finds non-obvious connections between metrics. High thermals correlating with driver crashes. Startup slowdowns correlating with SSD write amplification. Patterns humans miss.",
  },
  {
    icon: Brain,
    title: "Gets smarter over time",
    badge: "LEARNING",
    badgeColor: "text-accent border-accent/30 bg-accent/10",
    description: "The longer Sentinel runs, the better it knows your machine. Its models improve with every data point, making predictions more accurate as your laptop ages.",
  },
];

export default function Features() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <AnimateIn>
          <div className="max-w-2xl mb-20">
            <div className="mb-4">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                CAPABILITIES
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6" data-testid="heading-features">
              Eight capabilities.{" "}
              <span className="gradient-text">One quiet guardian.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Sentinel does things no other Windows diagnostic tool does — because it's built around prediction, not observation.
            </p>
          </div>
        </AnimateIn>

        {/* Feature grid — staggered */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6" staggerDelay={0.07}>
          {features.map((f, i) => (
            <StaggerItem key={f.title}>
              <div
                className="surface-card rounded-xl p-8 flex flex-col gap-5 hover:border-primary/40 transition-all duration-300 group h-full"
                data-testid={`card-feature-${i}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:border-primary/40 transition-colors">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${f.badgeColor}`}>
                    {f.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* CTA */}
        <AnimateIn delay={0.1}>
          <div className="mt-20 text-center">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
              data-testid="button-features-waitlist"
            >
              Get early access
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}
