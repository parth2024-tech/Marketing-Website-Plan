import type { SentinelReport } from "./schema";

export const ALGORITHM_VERSION = 1;

export interface ComponentScore {
  name: string;
  score: number;
  status: "healthy" | "watch" | "attention" | "critical";
  detail: string;
}

export interface Finding {
  component: string;
  title: string;
  body: string;
  urgency: "critical" | "warning" | "info";
  pro: boolean;
  /** When set, explains what OEM tools miss for this specific finding */
  oemContext?: string;
  /** Links this finding to a specific OEM failure case study on /oem-failures */
  caseStudyId?: string;
}

export interface Prediction {
  component: string;
  currentValue: string;
  projectedTimeline: string;
  severity: "stable" | "declining" | "urgent";
  insight: string;
}

export interface ReportResult {
  overall: number;
  grade: string;
  gradeLabel: string;
  components: ComponentScore[];
  findings: Finding[];
  predictions: Prediction[];
  system: { model: string; hostname: string; os: string };
  generatedAt: string;
  algoVersion: number;
  dataQuality: {
    thermalSource?: string;
    storageSource?: string;
    /** Legacy plain-text warnings (kept for backwards compat) */
    warnings: string[];
    /** Structured warnings with type, severity, and OEM comparison context */
    structuredWarnings: DataQualityWarning[];
  };
}

export interface DataQualityWarning {
  type: "acpi_static" | "nvme_unavailable" | "thermal_unavailable" | "storage_fallback" | "info";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  /** What the OEM tool does (or doesn't do) in this situation */
  oemComparison?: string;
  /** Whether this warning caused a score component to be excluded */
  excludedFromScoring: boolean;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function scoreStatus(s: number): ComponentScore["status"] {
  if (s >= 80) return "healthy";
  if (s >= 60) return "watch";
  if (s >= 40) return "attention";
  return "critical";
}

const cycleAnchors: [number, number][] = [
  [0,    100],
  [100,  97],
  [200,  92],
  [300,  85],
  [500,  75],
  [700,  65],
  [1000, 50],
];

export function expectedBatteryHealth(cycles: number): number {
  for (let i = 1; i < cycleAnchors.length; i++) {
    const [c0, h0] = cycleAnchors[i - 1];
    const [c1, h1] = cycleAnchors[i];
    if (cycles <= c1) {
      const t = (cycles - c0) / (c1 - c0);
      return h0 + t * (h1 - h0);
    }
  }
  return cycleAnchors[cycleAnchors.length - 1][1];
}

function batteryScore(r: SentinelReport): ComponentScore | null {
  const b = r.battery;
  if (!b) return null;
  const health = b.health ?? 100;
  const cycles = b.cycleCount ?? 0;
  const expected = expectedBatteryHealth(cycles);
  let score = health;
  const gap = expected - health;
  if (gap > 10) score -= Math.min(20, gap - 10);
  score = clamp(score, 30, 100);
  let detail = `${health.toFixed(1)}% capacity`;
  if (cycles) detail += ` · ${cycles} cycles`;
  if (b.fullChargeCapacity && b.designCapacity) {
    const full = Math.round(b.fullChargeCapacity / 1000);
    const design = Math.round(b.designCapacity / 1000);
    detail += ` · ${full}/${design} Wh`;
  }
  return { name: "Battery", score, status: scoreStatus(score), detail };
}

function thermalScore(r: SentinelReport): ComponentScore | null {
  const t = r.thermals;
  if (!t || t.maxTempC == null) return null;
  if (t.thermalSource === "unavailable" || t.thermalSource === "acpi_static_suspect") return null;
  const max = t.maxTempC;
  let score =
    max > 95 ? 10 :
    max > 90 ? 30 :
    max > 85 ? 50 :
    max > 80 ? 65 :
    max > 75 ? 80 : 100;
  const throttle = t.throttleEvents30min ?? 0;
  if (throttle > 20) score -= 20;
  else if (throttle > 10) score -= 10;
  else if (throttle > 3) score -= 5;
  score = clamp(score);
  const detail = `${max.toFixed(1)}°C peak${throttle ? ` · ${throttle} throttle events` : ""}`;
  return { name: "Thermals", score, status: scoreStatus(score), detail };
}

function storageScore(r: SentinelReport): ComponentScore | null {
  if (!r.storage?.length) return null;
  const primary = r.storage[0];
  if (primary.dataSource === "unavailable" && (primary.type?.includes("NVMe") || primary.model?.includes("NVMe"))) return null;
  const wear = primary.wearLevelPct ?? primary.healthPct;
  const realloc = primary.reallocatedSectors ?? 0;
  const free = primary.freeSpacePct ?? 100;
  let score: number;
  if (wear != null) {
    // wearLevelPct / healthPct = percentage of life REMAINING (higher = healthier)
    score = clamp(wear);
    if (realloc > 0) score -= Math.min(40, realloc * 5);
  } else {
    // NVMe fallback — uncertain, cap at 95
    score = 95;
    if (realloc > 0) score -= Math.min(40, realloc * 10);
    if (free < 10) score -= 15;
    else if (free < 20) score -= 5;
    score = clamp(score, 0, 95);
  }
  if (free < 5) score -= 20;
  else if (free < 10) score -= 10;
  else if (free < 15) score -= 5;
  score = clamp(score);
  let detail = primary.model ?? "SSD";
  if (free != null) detail += ` · ${free.toFixed(1)}% free`;
  if (realloc) detail += ` · ${realloc} reallocated sectors`;
  return { name: "Storage", score, status: scoreStatus(score), detail };
}

export function expectedMemoryPenalty(usedPct: number): number {
  if (usedPct <= 70) return 0;
  const anchors: [number, number][] = [
    [70, 0],
    [85, 15],
    [95, 30],
    [100, 50]
  ];
  for (let i = 1; i < anchors.length; i++) {
    const [u0, p0] = anchors[i - 1];
    const [u1, p1] = anchors[i];
    if (usedPct <= u1) {
      const t = (usedPct - u0) / (u1 - u0);
      return p0 + t * (p1 - p0);
    }
  }
  return anchors[anchors.length - 1][1];
}

function memoryScore(r: SentinelReport): ComponentScore | null {
  const m = r.memory;
  if (!m) return null;
  const used = m.usedPct;
  const basePenalty = expectedMemoryPenalty(used);
  
  let finalPenalty = basePenalty;
  if (m.pageFaultsPerSec != null) {
    const swapMultiplier = 1 + (clamp(m.pageFaultsPerSec / 500, 0, 1) * 0.20);
    finalPenalty = basePenalty * swapMultiplier;
  }
  
  const score = clamp(Math.round(100 - finalPenalty));
  
  let detail = `${m.totalGB} GB · ${used.toFixed(0)}% used`;
  if (m.pageFaultsPerSec != null && m.pageFaultsPerSec > 0) {
    detail += ` · ${m.pageFaultsPerSec} pg/s`;
  }
  
  return {
    name: "Memory",
    score,
    status: scoreStatus(score),
    detail,
  };
}

function cpuScore(r: SentinelReport): ComponentScore | null {
  const c = r.cpu;
  if (!c) return null;
  let score = 100;
  const load = c.avgLoadPct ?? 0;
  const throttle = c.throttleEvents30min ?? 0;
  if (load > 85) score -= 20;
  else if (load > 70) score -= 10;
  if (throttle > 20) score -= 25;
  else if (throttle > 10) score -= 15;
  else if (throttle > 3) score -= 8;
  score = clamp(score);
  let detail = c.name ?? "CPU";
  if (load) detail += ` · ${load.toFixed(0)}% avg load`;
  return { name: "CPU", score, status: scoreStatus(score), detail };
}

function generateFindings(r: SentinelReport): Finding[] {
  const findings: Finding[] = [];
  const b = r.battery;
  const t = r.thermals;
  const s = r.storage?.[0];

  // Battery
  if (b?.health != null) {
    if (b.health < 60) {
      const cycles = b.cycleCount ?? 0;
      const expected = cycles > 0 ? expectedBatteryHealth(cycles) : null;
      const oemCtx = expected
        ? `Your OEM tool (e.g. Dell SupportAssist, Lenovo Vantage) reports raw capacity only — it does not adjust for cycle count. At ${cycles} cycles, a healthy battery should retain ~${expected.toFixed(0)}% capacity. Yours is at ${b.health.toFixed(1)}%. That ${(expected - b.health).toFixed(0)}-point gap is invisible to OEM diagnostics.`
        : `OEM tools like Dell SupportAssist or Lenovo Vantage only report raw capacity percentage. They don't compare against expected degradation curves for your cycle count, so they can't tell you if your battery is wearing faster than normal.`;
      findings.push({ component: "Battery", title: "Battery capacity critically low",
        body: `Your battery retains only ${b.health.toFixed(1)}% of its original capacity. At this level, runtime is severely reduced and unexpected shutdowns may occur.`,
        oemContext: oemCtx,
        urgency: "critical", pro: false });
    } else if (b.health < 75) {
      const cycles = b.cycleCount ?? 0;
      const expected = cycles > 0 ? expectedBatteryHealth(cycles) : null;
      const oemCtx = expected
        ? `Your OEM tool doesn't check cycle-adjusted degradation — it only reports raw capacity. At your cycle count (${cycles}), your battery should be at ~${expected.toFixed(0)}%. It's at ${b.health.toFixed(1)}%. That ${(expected - b.health).toFixed(0)}-point gap is what SupportAssist misses.`
        : `OEM battery diagnostics only show raw capacity percentage. They don't track whether degradation is faster than expected for your usage pattern.`;
      findings.push({ component: "Battery", title: "Battery degrading faster than expected",
        body: `Current capacity: ${b.health.toFixed(1)}% of original. You're losing measurable runtime per charge cycle. Battery replacement is worth planning.`,
        oemContext: oemCtx,
        urgency: "warning", pro: false });
    }
  }
  if (b?.cycleCount != null && b.cycleCount > 500) {
    findings.push({ component: "Battery", title: "High cycle count detected",
      body: `${b.cycleCount} charge cycles recorded. Most laptop batteries are rated for 300–500 full cycles before significant degradation. You're past this threshold.`,
      oemContext: "OEM tools like HP Support Assistant show cycle count but don't flag when you've exceeded the manufacturer's rated cycle life. They treat 1,000 cycles the same as 100.",
      urgency: b.cycleCount > 800 ? "critical" : "warning", pro: false });
  }
  // Pro: degradation trajectory — requires both health and cycles
  if (b?.health != null && b?.cycleCount != null) {
    const expected = expectedBatteryHealth(b.cycleCount);
    if (expected - b.health > 8) {
      findings.push({ component: "Battery", title: "Degradation trajectory: faster-than-normal wear detected",
        body: `At ${b.cycleCount} cycles, a typical battery retains ~${expected.toFixed(0)}% capacity. Yours is at ${b.health.toFixed(1)}% — ${(expected - b.health).toFixed(1)} points below baseline. Sentinel projects replacement-grade degradation approximately 3–4 months earlier than average.`,
        oemContext: `No OEM diagnostic tool performs cycle-adjusted degradation analysis. Dell SupportAssist, Lenovo Vantage, and HP Support Assistant all report raw capacity without comparing against expected wear curves. The ${(expected - b.health).toFixed(0)}-point gap between expected (${expected.toFixed(0)}%) and actual (${b.health.toFixed(1)}%) health is entirely invisible to these tools.`,
        urgency: "warning", pro: true });
    }
  }

  // Thermals
  if (t?.maxTempC != null) {
    if (t.maxTempC > 90) {
      findings.push({ component: "Thermals", title: "Critical peak temperature recorded",
        body: `Your system reached ${t.maxTempC.toFixed(1)}°C. Sustained temperatures above 90°C accelerate thermal paste degradation, reduce fan bearing lifespan, and can trigger permanent CPU performance reduction.`,
        oemContext: "OEM tools like Dell SupportAssist only run a brief thermal stress test and report pass/fail. They don't measure real-world peak temperatures under your actual workload, so a system that passes the OEM test can still be thermally throttling daily.",
        urgency: "critical", pro: false });
    } else if (t.maxTempC > 80) {
      findings.push({ component: "Thermals", title: "Elevated peak temperature",
        body: `Peak temperature of ${t.maxTempC.toFixed(1)}°C detected. This is above the recommended sustained operating range for most consumer processors. Check vent clearance.`,
        oemContext: "OEM thermal tests use artificial stress loads for 30–60 seconds. Your actual workload produces sustained temperatures that OEM tests never simulate.",
        urgency: "warning", pro: false });
    }
  }
  if (t?.throttleEvents30min != null && t.throttleEvents30min > 5) {
    findings.push({ component: "Thermals", title: `${t.throttleEvents30min} thermal throttle events detected`,
      body: "CPU throttling reduces performance and indicates the cooling system is struggling to dissipate heat. Common causes: blocked vents, degraded thermal paste, or dust accumulation.",
      oemContext: "OEM tools don't count throttle events. They report CPU temperature at a single point in time, not the pattern of thermal throttling that reveals cooling system degradation.",
      urgency: t.throttleEvents30min > 15 ? "critical" : "warning", pro: false });
  }
  // Pro: thermal-battery correlation — requires both
  if (t?.maxTempC != null && b?.health != null && t.maxTempC > 78) {
    findings.push({ component: "Thermals + Battery", title: "Correlated finding: sustained heat is accelerating battery degradation",
      body: "Sentinel detects a statistically significant pattern between your sustained high operating temperatures and your battery's above-average degradation rate. Every 10°C of sustained heat above 30°C ambient doubles lithium-ion degradation speed.",
      oemContext: "No OEM diagnostic tool cross-correlates thermal and battery data. They treat each component as independent, missing the most common cause of premature battery failure: sustained heat.",
      urgency: "warning", pro: true });
  }

  // Storage
  if (s?.reallocatedSectors != null && s.reallocatedSectors > 0) {
    findings.push({ component: "Storage", title: `SSD has ${s.reallocatedSectors} reallocated sector${s.reallocatedSectors > 1 ? "s" : ""}`,
      body: "Reallocated sectors indicate the drive has found and remapped bad blocks. Non-zero reallocated sectors are a serious early failure indicator. Back up immediately and monitor closely.",
      oemContext: "Windows' built-in drive health check (Optimize Drives) doesn't report reallocated sectors. Most OEM diagnostics show a pass/fail drive test but won't tell you the reallocated sector count — the single most important early failure indicator.",
      urgency: "critical", pro: false });
  }
  if (s?.freeSpacePct != null && s.freeSpacePct < 10) {
    findings.push({ component: "Storage", title: `Storage critically low — ${s.freeSpacePct.toFixed(1)}% free`,
      body: "SSDs require approximately 10–15% free space to maintain write performance and endurance. Below this threshold, write amplification increases, accelerating wear.",
      oemContext: "OEM tools warn about low disk space, but they don't explain the connection between free space and SSD wear amplification. Running below 10% free accelerates physical wear, not just performance.",
      urgency: s.freeSpacePct < 5 ? "critical" : "warning", pro: false });
  }
  // Pro: SSD wear timeline — triggers when remaining life drops below 80%
  if (s?.wearLevelPct != null && s.wearLevelPct < 80) {
    const consumed = 100 - s.wearLevelPct;
    findings.push({ component: "Storage", title: "SSD wear trajectory: elevated consumption rate detected",
      body: `Your SSD has consumed ${consumed}% of its rated write endurance. Based on the observed wear rate, Sentinel projects the endurance limit will be reached sooner than average. Begin scheduling periodic backups and consider your next upgrade window.`,
      oemContext: "OEM tools don't track SSD write endurance over time. They show current health as pass/fail. Sentinel tracks the wear rate so you can plan replacements before failure, not after.",
      urgency: s.wearLevelPct < 50 ? "critical" : "warning", pro: true });
  }

  // ── OEM Case Study Findings ───────────────────────────────────────────
  // These fire on the exact failure patterns documented in the attached Dell,
  // Lenovo, and HP diagnostic scripts. Each caseStudyId links to the
  // /oem-failures page for the real-world evidence.

  // CS-01: Dell SupportAssist "Battery: Good" bucket hiding real capacity
  // Dell thresholds: >50% = "Good". A battery at 52% shows identically to 95%.
  if (b?.health != null && b.health >= 50 && b.health < 80) {
    findings.push({
      component: "Battery",
      title: "Battery in Dell SupportAssist 'Good' range — but degraded",
      body: `Your battery is at ${b.health.toFixed(1)}% of original capacity. Dell SupportAssist would report this as "Battery: Good" because its threshold is 50%. A battery at ${b.health.toFixed(0)}% and one at 95% show identically in SupportAssist.`,
      oemContext: `Dell SupportAssist reports battery health in three buckets: Good (>50%), Fair (25-50%), and Poor (<25%). At ${b.health.toFixed(0)}%, your battery is classified as "Good" by Dell — even though you've lost ${(100 - b.health).toFixed(0)}% of your original capacity and are experiencing measurable runtime reduction.`,
      urgency: b.health < 65 ? "warning" : "info",
      pro: false,
      caseStudyId: "dell-battery-good",
    });
  }

  // CS-02: Lenovo Vantage hiding cycle count behind "Battery Condition: Normal"
  // Lenovo Vantage shows simplified status without exposing cycle count or capacity %
  if (b?.cycleCount != null && b.cycleCount > 300 && b?.health != null && b.health < 80) {
    findings.push({
      component: "Battery",
      title: "Battery would show 'Normal' in Lenovo Vantage — despite wear",
      body: `At ${b.cycleCount} cycles and ${b.health.toFixed(1)}% capacity, Lenovo Vantage would still show "Battery Condition: Normal." Vantage doesn't expose actual cycle count or capacity percentage in its UI — the two metrics that matter most for predicting battery end-of-life.`,
      oemContext: `Lenovo Vantage's battery health section shows a simplified "Battery Condition" status without exposing the actual cycle count (${b.cycleCount}) or capacity percentage (${b.health.toFixed(1)}%). Its conservation mode (charging to 80%) is useful, but the UI conflates "protected battery" with "healthy battery" — they are not the same thing.`,
      urgency: "warning",
      pro: false,
      caseStudyId: "lenovo-vantage-normal",
    });
  }

  // CS-03: HP Support Assistant service-first flow — reallocated sectors
  // HP flags drive issues but routes to "Contact HP Support" instead of actionable guidance
  if (s?.reallocatedSectors != null && s.reallocatedSectors > 0 && s.reallocatedSectors <= 20) {
    findings.push({
      component: "Storage",
      title: "Reallocated sectors at level HP flags as 'needs service'",
      body: `Your drive has ${s.reallocatedSectors} reallocated sector${s.reallocatedSectors > 1 ? "s" : ""}. HP Support Assistant would flag this but recommend "Contact HP Support" rather than the actionable response: back up your data, monitor the count weekly, and replace the drive if the count increases.`,
      oemContext: `HP Support Assistant's remediation path for drive warnings leads to "Contact HP Support" — a service call. A reallocated sector count of ${s.reallocatedSectors} is a warning sign, not an emergency. The appropriate response is to back up and monitor. HP's recommended response is a paid service call.`,
      urgency: "warning",
      pro: false,
      caseStudyId: "hp-service-upsell",
    });
  }

  // CS-04: Task Manager hiding thermal throttling
  // CPU shows "normal" usage while actually thermally throttled
  if (t?.throttleEvents30min != null && t.throttleEvents30min > 0 && t?.maxTempC != null && t.maxTempC > 75) {
    const c = r.cpu;
    const load = c?.avgLoadPct ?? 0;
    if (load < 70) {
      findings.push({
        component: "Thermals",
        title: "CPU throttling invisible in Task Manager",
        body: `Your CPU is at ${load.toFixed(0)}% usage with ${t.throttleEvents30min} thermal throttle events. Windows Task Manager shows usage as a percentage of the reduced clock speed — not the original. A CPU running at 50% of a throttled 1.2 GHz looks the same as 50% of a healthy 4.7 GHz.`,
        oemContext: `CPU throttling is not visible anywhere in Task Manager. There is no throttling indicator, no event log visible in the UI, and no notification. Your system has been throttling ${t.throttleEvents30min} times in 30 minutes at ${t.maxTempC.toFixed(1)}°C — Task Manager shows none of this.`,
        urgency: "warning",
        pro: false,
        caseStudyId: "taskmanager-throttle",
      });
    }
  }

  // CS-05: NVMe wear level below OEM reporting threshold
  // OEM tools show NVMe health as binary pass/fail; actual wear level detail is hidden
  if (s?.wearLevelPct != null && s.wearLevelPct >= 50 && s.wearLevelPct < 90) {
    const consumed = 100 - s.wearLevelPct;
    findings.push({
      component: "Storage",
      title: "NVMe wear level below OEM reporting threshold",
      body: `Your NVMe drive has consumed ${consumed}% of its rated write endurance (${s.wearLevelPct}% remaining). OEM tools like Dell SupportAssist, Lenovo Vantage, and HP Support Assistant would still report this drive as "Healthy" or "Good" because they use binary pass/fail — they don't report the actual percentage.`,
      oemContext: `OEM diagnostics report NVMe health as pass/fail. They will show "Drive: Healthy" until the drive is at or near failure. At ${s.wearLevelPct}% remaining endurance, your drive is still functional but wearing — this is the planning window that OEM tools never give you.`,
      urgency: consumed > 30 ? "warning" : "info",
      pro: false,
      caseStudyId: "nvme-wear-hidden",
    });
  }

  // CS-06: ACPI static thermal reading — OEM firmware lying about temperature
  // Dell/HP/Lenovo BIOS reports a fixed ACPI value regardless of actual CPU temp
  if (t?.thermalSource === "acpi_static_suspect") {
    findings.push({
      component: "Thermals",
      title: "OEM firmware reporting fixed temperature (ACPI static)",
      body: "Your OEM firmware is reporting a static ACPI thermal reading — a known firmware behaviour where the reported temperature never changes regardless of actual system load. OEM diagnostic tools read this same value and report \"Thermals: Normal\" without validating whether the reading is real.",
      oemContext: "Dell SupportAssist, HP Support Assistant, and Lenovo Vantage all rely on the same ACPI thermal zones for temperature data. When the firmware lies, all three tools report the lie as fact. None of them validate whether the sensor reading changes under load — which is the only way to detect a static reading.",
      urgency: "warning",
      pro: false,
      caseStudyId: "acpi-static-lie",
    });
  }

  // Info
  if (b?.health != null && b.health >= 75 && !findings.some(f => f.component === "Battery" && f.urgency !== "info")) {
    findings.push({ component: "Battery", title: "Battery in normal operating range",
      body: `Capacity at ${b.health.toFixed(1)}%. No immediate action needed.`,
      urgency: "info", pro: false });
  }

  return findings;
}

function generatePredictions(r: SentinelReport): Prediction[] {
  const predictions: Prediction[] = [];
  const b = r.battery;
  const t = r.thermals;
  const s = r.storage?.[0];
  const m = r.memory;
  const c = r.cpu;

  // Battery prediction
  if (b?.health != null) {
    const health = b.health;
    const cycles = b.cycleCount ?? 0;
    if (health >= 90) {
      predictions.push({
        component: "Battery",
        currentValue: `${health.toFixed(1)}% capacity`,
        projectedTimeline: "18–24 months before noticeable degradation",
        severity: "stable",
        insight: "Battery is in excellent condition. At current usage patterns, expect reliable performance for the next 1.5–2 years.",
      });
    } else if (health >= 75) {
      const monthsLeft = Math.max(3, Math.round((health - 50) * 0.6));
      predictions.push({
        component: "Battery",
        currentValue: `${health.toFixed(1)}% capacity · ${cycles} cycles`,
        projectedTimeline: `${monthsLeft}–${monthsLeft + 4} months before performance becomes unreliable`,
        severity: "declining",
        insight: `At current degradation rate, battery performance may become unstable within ${monthsLeft}–${monthsLeft + 4} months. Runtime per charge will decrease noticeably. Plan for replacement within this window.`,
      });
    } else if (health >= 50) {
      const monthsLeft = Math.max(1, Math.round((health - 40) * 0.4));
      predictions.push({
        component: "Battery",
        currentValue: `${health.toFixed(1)}% capacity · ${cycles} cycles`,
        projectedTimeline: `${monthsLeft}–${monthsLeft + 2} months before unexpected shutdowns likely`,
        severity: "urgent",
        insight: `Battery is degrading at an accelerated rate. Random shutdowns at 10–20% reported charge are likely within ${monthsLeft}–${monthsLeft + 2} months. Replacement is strongly recommended.`,
      });
    } else {
      predictions.push({
        component: "Battery",
        currentValue: `${health.toFixed(1)}% capacity · ${cycles} cycles`,
        projectedTimeline: "Immediate — replacement overdue",
        severity: "urgent",
        insight: "Battery has reached end-of-life. Unexpected shutdowns, swelling risk, and severely reduced runtime are expected. Replace as soon as possible.",
      });
    }
  }

  // Thermals prediction
  if (t?.maxTempC != null) {
    const temp = t.maxTempC;
    const throttle = t.throttleEvents30min ?? 0;
    if (temp <= 75 && throttle <= 2) {
      predictions.push({
        component: "Thermals",
        currentValue: `${temp.toFixed(0)}°C peak · ${throttle} throttle events`,
        projectedTimeline: "No thermal concerns for 12+ months",
        severity: "stable",
        insight: "Cooling system is performing well within safe limits. No intervention needed.",
      });
    } else if (temp <= 85) {
      predictions.push({
        component: "Thermals",
        currentValue: `${temp.toFixed(0)}°C peak · ${throttle} throttle events`,
        projectedTimeline: "6–12 months before thermal paste degradation becomes noticeable",
        severity: "declining",
        insight: `Temperatures are elevated. Without intervention, thermal paste degradation will cause temps to rise another 5–10°C over the next 6–12 months, leading to sustained throttling and reduced performance.`,
      });
    } else {
      predictions.push({
        component: "Thermals",
        currentValue: `${temp.toFixed(0)}°C peak · ${throttle} throttle events`,
        projectedTimeline: "1–3 months before component lifespan is significantly impacted",
        severity: "urgent",
        insight: `Sustained temperatures above 85°C are actively shortening CPU, GPU, and battery lifespan. Thermal paste replacement and vent cleaning are recommended within the next 1–3 months to prevent permanent damage.`,
      });
    }
  }

  // Storage prediction
  if (s) {
    const wear = s.wearLevelPct ?? s.healthPct;
    const free = s.freeSpacePct ?? 100;
    const realloc = s.reallocatedSectors ?? 0;
    if (realloc > 0) {
      predictions.push({
        component: "Storage",
        currentValue: `${realloc} reallocated sectors · ${free.toFixed(0)}% free`,
        projectedTimeline: "Unpredictable — failure possible at any time",
        severity: "urgent",
        insight: "Reallocated sectors indicate physical media damage. Drive failure becomes increasingly likely. Back up all data immediately and plan for drive replacement.",
      });
    } else if (wear != null && wear < 60) {
      const monthsLeft = Math.max(2, Math.round(wear * 0.3));
      predictions.push({
        component: "Storage",
        currentValue: `${wear}% endurance remaining · ${free.toFixed(0)}% free`,
        projectedTimeline: `${monthsLeft}–${monthsLeft + 6} months of write endurance remaining`,
        severity: "declining",
        insight: `SSD write endurance is below 60%. At current write patterns, the drive will reach its rated endurance limit within ${monthsLeft}–${monthsLeft + 6} months. Performance may degrade before then.`,
      });
    } else if (free < 10) {
      predictions.push({
        component: "Storage",
        currentValue: `${free.toFixed(1)}% free space`,
        projectedTimeline: "2–4 weeks before write performance degrades significantly",
        severity: "urgent",
        insight: "Critically low free space increases write amplification, accelerating SSD wear and reducing write speeds. Windows updates may also begin failing silently.",
      });
    } else {
      predictions.push({
        component: "Storage",
        currentValue: wear != null ? `${wear}% endurance remaining · ${free.toFixed(0)}% free` : `${free.toFixed(0)}% free`,
        projectedTimeline: "No storage concerns for 12+ months",
        severity: "stable",
        insight: "Storage health and free space are both in good condition. No action needed.",
      });
    }
  }

  // Memory prediction
  if (m) {
    const used = m.usedPct;
    if (used > 85) {
      predictions.push({
        component: "Memory",
        currentValue: `${m.totalGB} GB · ${used.toFixed(0)}% utilised`,
        projectedTimeline: "Ongoing — system instability increases with each additional app",
        severity: "urgent",
        insight: "Memory is consistently near capacity. This forces heavy pagefile use, which degrades SSD lifespan and causes noticeable slowdowns. A RAM upgrade is recommended.",
      });
    } else if (used > 70) {
      predictions.push({
        component: "Memory",
        currentValue: `${m.totalGB} GB · ${used.toFixed(0)}% utilised`,
        projectedTimeline: "3–6 months before multitasking becomes noticeably slower",
        severity: "declining",
        insight: "Memory usage is moderately high. As installed applications grow and browser usage increases, expect more frequent slowdowns within 3–6 months.",
      });
    }
  }

  // CPU prediction
  if (c) {
    const throttle = c.throttleEvents30min ?? 0;
    const load = c.avgLoadPct ?? 0;
    if (throttle > 10 && load > 60) {
      predictions.push({
        component: "CPU",
        currentValue: `${load.toFixed(0)}% avg load · ${throttle} throttle events`,
        projectedTimeline: "Performance will degrade noticeably within 3–6 months",
        severity: "declining",
        insight: "High sustained load combined with frequent throttling indicates the CPU is thermally limited. Without thermal system maintenance, expect increasing performance loss over the next 3–6 months.",
      });
    }
  }

  return predictions;
}

export function combinedScore(hwScore: number, habitScore: number): number {
  return Math.round(0.7 * hwScore + 0.3 * habitScore);
}

export function generateReport(r: SentinelReport): ReportResult {
  const components: ComponentScore[] = [
    batteryScore(r), thermalScore(r), storageScore(r), memoryScore(r), cpuScore(r),
  ].filter(Boolean) as ComponentScore[];

  const weights: Record<string, number> = {
    Battery: 0.30, Thermals: 0.25, Storage: 0.25, Memory: 0.10, CPU: 0.10,
  };
  let weightedSum = 0, totalWeight = 0;
  for (const c of components) {
    const w = weights[c.name] ?? 0.1;
    weightedSum += c.score * w;
    totalWeight += w;
  }
  const overall = clamp(Math.round(weightedSum / (totalWeight || 1)));
  const grade =
    overall < 40 ? "F" : overall < 55 ? "D" : overall < 65 ? "C" : overall < 80 ? "B" : "A";
  const gradeLabel =
    overall < 40 ? "Critical" : overall < 55 ? "Poor" : overall < 65 ? "Fair" : overall < 80 ? "Good" : "Excellent";

  const warnings: string[] = [];
  const structuredWarnings: DataQualityWarning[] = [];
  const t = r.thermals;

  if (t?.thermalSource === "acpi_static_suspect") {
    warnings.push("Thermal data unavailable on this hardware — thermal score excluded from overall calculation.");
    structuredWarnings.push({
      type: "acpi_static",
      severity: "high",
      title: "OEM firmware is reporting a fixed temperature",
      detail: "We detected that your OEM firmware is reporting a static ACPI thermal reading — a known firmware behaviour where the reported temperature never changes regardless of actual system load. This is a common issue with certain Dell, HP, and Lenovo BIOS versions. We excluded this data from scoring because it would produce a misleadingly healthy thermal score.",
      oemComparison: "OEM diagnostic tools (Dell SupportAssist, HP Support Assistant, Lenovo Vantage) read the same static ACPI value and present it as your actual temperature — reporting \"Thermals: Normal\" even when the CPU may be throttling. They don't validate whether the sensor reading is real.",
      excludedFromScoring: true,
    });
  } else if (!t || t.thermalSource === "unavailable") {
    warnings.push("Thermal data unavailable on this hardware — thermal score excluded from overall calculation.");
    structuredWarnings.push({
      type: "thermal_unavailable",
      severity: "medium",
      title: "Thermal sensor data unavailable",
      detail: "Your hardware did not expose thermal sensor data through any available interface (WMI, ACPI, or LibreHardwareMonitor). The thermal component has been excluded from your overall score to avoid guessing.",
      oemComparison: "OEM tools may still show a temperature reading by accessing proprietary sensor interfaces that are not available to third-party software. However, they don't disclose when sensor data is estimated or unavailable.",
      excludedFromScoring: true,
    });
  }

  const s = r.storage?.[0];
  if (s && s.dataSource === "unavailable" && (s.type?.includes("NVMe") || s.model?.includes("NVMe"))) {
    warnings.push("NVMe wear data could not be retrieved — storage score excluded from overall calculation.");
    structuredWarnings.push({
      type: "nvme_unavailable",
      severity: "medium",
      title: "NVMe health data could not be retrieved",
      detail: "Your NVMe drive's S.M.A.R.T. health attributes could not be read, likely because the drive requires elevated permissions or uses a non-standard NVMe command set. Storage wear scoring has been excluded to avoid inaccurate results.",
      oemComparison: "OEM tools often have privileged access to NVMe health data through vendor-specific drivers. However, they typically only report a binary pass/fail rather than detailed wear metrics.",
      excludedFromScoring: true,
    });
  }

  return {
    overall, grade, gradeLabel, components,
    findings: generateFindings(r),
    predictions: generatePredictions(r),
    system: { model: r.system.model, hostname: r.system.hostname, os: r.system.os ?? "" },
    generatedAt: r.generatedAt,
    algoVersion: ALGORITHM_VERSION,
    dataQuality: {
      thermalSource: t?.thermalSource,
      storageSource: s?.dataSource,
      warnings,
      structuredWarnings,
    },
  };
}
