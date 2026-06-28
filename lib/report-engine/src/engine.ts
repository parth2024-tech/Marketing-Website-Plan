import type { SentinelReport } from "./schema";

export const ALGORITHM_VERSION = 2;

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
  /** The raw validated telemetry payload — used by the UI to render data-driven charts */
  rawReport: SentinelReport;
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

  // If health is unknown (no capacity data at all), exclude from scoring.
  // Don't default to 85 — that would silently inflate the overall score.
  if (b.health == null) {
    // Still possible to compute a partial score from cycles alone (rare case)
    if (b.cycleCount == null) return null;
    // Very high cycle count with no health data = at minimum a warning-grade score
    if (b.cycleCount > 800) return { name: "Battery", score: 55, status: "watch", detail: `${b.cycleCount} cycles · health data unavailable` };
    if (b.cycleCount > 600) return { name: "Battery", score: 65, status: "watch", detail: `${b.cycleCount} cycles · health data unavailable` };
    return null; // not enough data for a reliable score
  }

  const health = b.health;
  const cycles = b.cycleCount ?? 0;
  const expected = expectedBatteryHealth(cycles);
  let score = health;

  // Penalise faster-than-expected degradation relative to the population curve
  const gap = expected - health;
  if (gap > 5) score -= Math.min(25, (gap - 5) * 1.5);

  // Discharge rate penalty:
  // BatteryStatus.DischargeRate from WMI can be positive or negative depending
  // on the driver. Negative = discharging. Positive = charging. Normalise to
  // always use the magnitude for drain calculations.
  const drainMw = b.dischargeRateMw != null ? -Math.abs(b.dischargeRateMw) : null;
  if (drainMw != null && drainMw < -8000) {
    score -= 8; // >8W drain at idle/light load = abnormal, suggests cell swelling
  } else if (drainMw != null && drainMw < -5000) {
    score -= 4; // >5W drain = elevated
  }

  // Cycle count penalty — even a healthy-looking battery at very high cycles
  // is statistically closer to sudden failure
  if (cycles > 900) score -= 12;
  else if (cycles > 700) score -= 7;
  else if (cycles > 500) score -= 3;

  // Cap: no battery ever scores 100. Floor: dead battery still has some score for being present
  score = clamp(score, 20, 97);

  let detail = `${health.toFixed(1)}% capacity`;
  if (cycles) detail += ` · ${cycles} cycles`;
  if (b.fullChargeCapacity && b.designCapacity) {
    // Convert mWh to Wh for display
    const fullWh = (b.fullChargeCapacity / 1000).toFixed(1);
    const designWh = (b.designCapacity / 1000).toFixed(1);
    detail += ` · ${fullWh}/${designWh} Wh`;
  }
  if (drainMw != null && drainMw < 0) {
    detail += ` · ${(Math.abs(drainMw) / 1000).toFixed(1)}W draw`;
  }
  return { name: "Battery", score, status: scoreStatus(score), detail };
}

function thermalScore(r: SentinelReport): ComponentScore | null {
  const t = r.thermals;
  if (!t || t.maxTempC == null) return null;
  if (t.thermalSource === "unavailable" || t.thermalSource === "acpi_static_suspect") return null;
  const max = t.maxTempC;

  // Strict temperature thresholds — based on real-world throttle data:
  // Intel/AMD consumer chips throttle at 100°C, sustained 85°C+ causes measurable degradation
  let score =
    max > 98 ? 5 :
    max > 93 ? 20 :
    max > 88 ? 40 :
    max > 83 ? 60 :
    max > 78 ? 75 :
    max > 72 ? 88 : 97;

  const throttle = t.throttleEvents30min ?? 0;
  // Throttle penalties are compounded on top of the temperature-based score
  if (throttle > 30) score -= 35;
  else if (throttle > 20) score -= 25;
  else if (throttle > 10) score -= 15;
  else if (throttle > 5) score -= 9;
  else if (throttle > 2) score -= 5;
  else if (throttle > 0) score -= 2;

  score = clamp(score);

  // Human-readable source label for the UI
  const sourceLabel: Record<string, string> = {
    performance_counter: "Win32 Performance Counter",
    acpi_wmi: "ACPI/WMI",
    ohm: "OpenHardwareMonitor",
    lhm: "LibreHardwareMonitor",
  };
  const source = sourceLabel[t.thermalSource ?? ""] ?? t.thermalSource ?? "unknown";

  const detail = `${max.toFixed(1)}°C peak · source: ${source}${throttle ? ` · ${throttle} throttle events/30min` : ""}`;
  return { name: "Thermals", score, status: scoreStatus(score), detail };
}

function storageScore(r: SentinelReport): ComponentScore | null {
  if (!r.storage?.length) return null;
  const primary = r.storage[0];

  // If the drive is explicitly unavailable (couldn't read health), exclude it
  // entirely rather than giving a fake healthy score
  if (primary.dataSource === "unavailable") return null;

  const wear = primary.wearLevelPct ?? primary.healthPct;
  const realloc = primary.reallocatedSectors ?? 0;
  // !! Do NOT default freeSpacePct to 100 — that would make full drives look empty.
  // If the partition letter lookup failed, we simply have no free-space data.
  const free = primary.freeSpacePct; // may be null
  const poh = primary.powerOnHours ?? 0;

  let score: number;
  if (wear != null) {
    // wear = percentage of endurance REMAINING (100 = brand new, 0 = end of life)
    score = clamp(wear);

    // Penalise reallocated sectors heavily — serious early failure signal
    if (realloc > 0) score -= Math.min(50, realloc * 8);

    // Power-on hours penalty — drives with very high hours are statistically riskier
    if (poh > 50000) score -= 15;
    else if (poh > 30000) score -= 8;
    else if (poh > 20000) score -= 4;
  } else {
    // We can't verify wear — don't be generous.
    // Cap at 78 (watch range) to signal uncertainty honestly.
    score = 78;
    if (realloc > 0) score -= Math.min(50, realloc * 10);
    score = clamp(score, 0, 78);
  }

  // Free space penalties — SSDs need headroom for garbage collection
  // Only apply when we actually have the data (null = partition letter not found)
  if (free != null) {
    if (free < 5) score -= 25;
    else if (free < 10) score -= 15;
    else if (free < 15) score -= 7;
    else if (free < 20) score -= 3;
  }

  score = clamp(score);
  let detail = primary.model ?? "Drive";
  if (wear != null) detail += ` · ${wear}% endurance`;
  if (free != null) detail += ` · ${free.toFixed(1)}% free`;
  else detail += ` · free space unknown`;
  if (poh > 0) detail += ` · ${poh.toLocaleString()}h runtime`;
  if (realloc) detail += ` · ${realloc} bad sectors`;
  return { name: "Storage", score, status: scoreStatus(score), detail };
}

export function expectedMemoryPenalty(usedPct: number): number {
  // Penalty starts at 55% used — that's a realistic "normal" idle for Windows 11
  // Previously started at 70% which let 60–69% pass as perfect, which is wrong.
  if (usedPct <= 55) return 0;
  const anchors: [number, number][] = [
    [55, 0],
    [70, 8],
    [80, 18],
    [90, 32],
    [100, 55]
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
  if (m.pageFaultsPerSec != null && m.pageFaultsPerSec > 0) {
    // High page faults = active pagefile use = SSD wear + latency spikes
    // Apply a multiplier based on the severity of page fault rate
    const pfMultiplier = 1 + Math.min(0.6, m.pageFaultsPerSec / 250);
    finalPenalty = basePenalty * pfMultiplier;
    // Also add direct penalty tiers for extreme page fault rates
    if (m.pageFaultsPerSec > 1000) finalPenalty += 25;
    else if (m.pageFaultsPerSec > 500) finalPenalty += 15;
    else if (m.pageFaultsPerSec > 200) finalPenalty += 8;
    else if (m.pageFaultsPerSec > 50) finalPenalty += 3;
  }

  let score = clamp(Math.round(100 - finalPenalty));

  // Capacity hard caps — physical RAM size creates a ceiling on how well
  // memory can ever perform regardless of current usage percentage
  if (m.totalGB <= 4) score = Math.min(score, 50);       // 4 GB = can't run modern Windows without pagefile
  else if (m.totalGB <= 6) score = Math.min(score, 68);  // 6 GB = borderline for Win11
  else if (m.totalGB <= 8 && used > 75) score = Math.min(score, 75); // 8 GB at high usage
  else if (m.totalGB <= 8 && used > 85) score = Math.min(score, 65); // 8 GB critically full

  let detail = `${m.totalGB} GB RAM · ${used.toFixed(1)}% used`;
  if (m.pageFaultsPerSec != null && m.pageFaultsPerSec > 10) {
    detail += ` · ${m.pageFaultsPerSec.toLocaleString()} page faults/s`;
  }

  return { name: "Memory", score, status: scoreStatus(score), detail };
}

function cpuScore(r: SentinelReport): ComponentScore | null {
  const c = r.cpu;
  if (!c) return null;
  let score = 97; // Start at 97, not 100 — no CPU is ever perfect
  const load = c.avgLoadPct ?? 0;
  const throttle = c.throttleEvents30min ?? 0;

  // Load penalties — start penalising earlier (50% is a real signal)
  if (load > 90) score -= 30;
  else if (load > 80) score -= 20;
  else if (load > 70) score -= 13;
  else if (load > 60) score -= 7;
  else if (load > 50) score -= 3;

  // Throttle penalties — these are real hardware events from Windows Event Log
  if (throttle > 30) score -= 35;
  else if (throttle > 20) score -= 25;
  else if (throttle > 10) score -= 18;
  else if (throttle > 5) score -= 10;
  else if (throttle > 2) score -= 5;
  else if (throttle > 0) score -= 2;

  score = clamp(score);
  let detail = c.name ?? "CPU";
  if (load) detail += ` · ${load.toFixed(1)}% avg load`;
  if (throttle > 0) detail += ` · ${throttle} throttle events/30min`;
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

  // Low total RAM finding
  const m = r.memory;
  if (m && m.totalGB <= 4) {
    findings.push({
      component: "Memory",
      title: "4 GB RAM — insufficient for modern workloads",
      body: `Your system has only ${m.totalGB} GB of RAM. Windows 11 alone can consume 3–4 GB at idle. With just ${m.totalGB} GB, every additional app causes heavy pagefile use, significantly slowing your system and accelerating SSD wear.`,
      oemContext: "OEM diagnostics do not flag low total RAM — they only test whether installed RAM is functional. A 4 GB system will pass every OEM memory test while delivering a noticeably degraded experience.",
      urgency: "warning",
      pro: false,
    });
  } else if (m && m.totalGB <= 6 && m.usedPct > 70) {
    findings.push({
      component: "Memory",
      title: `${m.totalGB} GB RAM under pressure`,
      body: `With ${m.totalGB} GB RAM and ${m.usedPct.toFixed(0)}% utilisation, your system is frequently near its memory limit. Adding browser tabs or background apps will push it into pagefile territory.`,
      oemContext: "OEM tools test RAM for hardware defects, not capacity sufficiency. They will pass a 6 GB system with 80% utilisation as 'Memory: OK'.",
      urgency: "info",
      pro: false,
    });
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

  // Startup program impact
  // NOTE: requires r.startupList to be populated by the collector.
  // The C# collector sends this via Win32_StartupCommand + registry enumeration.
  const startupCount = (r.startupList ?? []).length;
  if (startupCount > 15) {
    findings.push({
      component: "CPU",
      title: `${startupCount} startup programs — impacting boot time`,
      body: `Your system has ${startupCount} programs set to launch at startup. This increases boot time, raises idle CPU usage, and reduces available RAM from the first moment you log in. Review and disable non-essential startup items in Task Manager.`,
      oemContext: "OEM diagnostic tools do not audit startup programs. Task Manager's Startup tab shows them, but no OEM tool aggregates startup impact on system health scoring.",
      urgency: startupCount > 25 ? "warning" : "info",
      pro: false,
    });
  } else if (startupCount > 8) {
    findings.push({
      component: "CPU",
      title: `${startupCount} startup programs — moderate boot impact`,
      body: `${startupCount} programs launch at startup. Consider reviewing which are essential to reduce boot time and idle resource use.`,
      oemContext: "Startup program auditing is absent from all major OEM diagnostic tools.",
      urgency: "info",
      pro: false,
    });
  }

  // Security posture
  // NOTE: requires r.security to be populated by the collector.
  // The C# collector gathers this via SecurityCenter2 WMI class.
  const sec = r.security;
  if (sec) {
    if (sec.antivirusEnabled === false || sec.realTimeProtection === false) {
      findings.push({
        component: "Security",
        title: sec.antivirusEnabled === false ? "Antivirus disabled" : "Real-time protection is off",
        body: `Sentinel detected that ${
          sec.antivirusEnabled === false
            ? "antivirus software is not active on this system"
            : "real-time protection is currently disabled"
        }. Without active protection, malware can run unchecked and cause data loss, file corruption, and hardware damage through sustained CPU abuse.`,
        oemContext: "OEM diagnostic tools do not audit security posture. Dell SupportAssist, Lenovo Vantage, and HP Support Assistant check for driver and BIOS updates — not whether your system is actively protected.",
        urgency: "critical",
        pro: false,
      });
    } else if (
      sec.firewallProfilesActive &&
      !sec.firewallProfilesActive.toLowerCase().includes("private") &&
      !sec.firewallProfilesActive.toLowerCase().includes("domain")
    ) {
      findings.push({
        component: "Security",
        title: "Firewall is on Public profile",
        body: `Your active firewall profile is set to Public, which restricts some network features. If this machine is on a trusted home or office network, switch to the Private profile for better connectivity.`,
        oemContext: "OEM tools do not audit Windows Firewall profile configuration.",
        urgency: "info",
        pro: false,
      });
    }
    // Outdated AV signatures
    if (sec.antivirusSignatureDate) {
      try {
        const sigDate = new Date(sec.antivirusSignatureDate);
        const daysSinceSig = (Date.now() - sigDate.getTime()) / (1000 * 86400);
        if (daysSinceSig > 7) {
          findings.push({
            component: "Security",
            title: `Antivirus signatures ${Math.round(daysSinceSig)} days old`,
            body: `Your antivirus definitions haven't been updated in ${Math.round(daysSinceSig)} days. Outdated signatures mean new malware threats won't be detected. Enable automatic updates or update manually now.`,
            oemContext: "OEM tools check for software updates but do not specifically flag stale antivirus signature databases.",
            urgency: daysSinceSig > 30 ? "warning" : "info",
            pro: false,
          });
        }
      } catch { /* ignore date parse errors */ }
    }
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
      const gap = expectedBatteryHealth(cycles) - health;
      const baseMonths = Math.max(3, Math.round((health - 50) * 0.6));
      const adjustedMonths = gap > 10 ? Math.max(2, baseMonths - Math.round(gap * 0.3)) : baseMonths;
      predictions.push({
        component: "Battery",
        currentValue: `${health.toFixed(1)}% capacity · ${cycles} cycles`,
        projectedTimeline: `${adjustedMonths}–${adjustedMonths + 4} months before performance becomes unreliable`,
        severity: "declining",
        insight: `At current degradation rate${
          gap > 10 ? ` (${gap.toFixed(0)}pts below expected for ${cycles} cycles)` : ""
        }, battery performance may become unstable within ${adjustedMonths}–${adjustedMonths + 4} months. Runtime per charge will decrease noticeably. Plan for replacement within this window.`,
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
    // Use actual freeSpacePct — don't default to 100 (hides critically full drives)
    const free = s.freeSpacePct;
    const realloc = s.reallocatedSectors ?? 0;
    if (realloc > 0) {
      predictions.push({
        component: "Storage",
        currentValue: `${realloc} reallocated sector${realloc > 1 ? "s" : ""}${free != null ? ` · ${free.toFixed(0)}% free` : ""}`,
        projectedTimeline: "Unpredictable — failure possible at any time",
        severity: "urgent",
        insight: "Reallocated sectors indicate physical media damage. Drive failure is unpredictable from this point. Back up all data immediately and replace the drive.",
      });
    } else if (wear != null && wear < 60) {
      const monthsLeft = Math.max(2, Math.round(wear * 0.3));
      predictions.push({
        component: "Storage",
        currentValue: `${wear}% endurance remaining${free != null ? ` · ${free.toFixed(0)}% free` : ""}`,
        projectedTimeline: `${monthsLeft}–${monthsLeft + 6} months of write endurance remaining`,
        severity: "declining",
        insight: `SSD write endurance is below 60%. At current write patterns, the drive will reach its rated endurance limit within ${monthsLeft}–${monthsLeft + 6} months. Performance may degrade before then.`,
      });
    } else if (free != null && free < 10) {
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
        currentValue: wear != null
          ? `${wear}% endurance remaining${free != null ? ` · ${free.toFixed(0)}% free` : " · free space unknown"}`
          : free != null ? `${free.toFixed(0)}% free` : "Data limited",
        projectedTimeline: "No storage concerns for 12+ months",
        severity: "stable",
        insight: "Storage health and free space are in good condition. No action needed.",
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
  let overall = clamp(Math.round(weightedSum / (totalWeight || 1)));

  // ── Uptime penalty ─────────────────────────────────────────────────────
  // Long uptime = background process accumulation, deferred restarts, memory pressure
  const uptimeSec = r.startup?.lastBootSec ?? 0;
  const uptimeDays = uptimeSec / 86400;
  if (uptimeDays > 30) overall = clamp(overall - 6);
  else if (uptimeDays > 14) overall = clamp(overall - 3);
  else if (uptimeDays > 7) overall = clamp(overall - 1);

  // ── Incomplete data cap ────────────────────────────────────────────────
  // When components are excluded due to missing hardware data, the weighted
  // average is calculated only on the remaining good-looking components,
  // which artificially inflates the overall score. Cap it honestly.
  const scoredCount = components.length;
  if (scoredCount < 3) overall = Math.min(overall, 70);
  else if (scoredCount < 4) overall = Math.min(overall, 82);
  else if (scoredCount < 5) overall = Math.min(overall, 90);

  const grade =
    overall < 30 ? "F" : overall < 50 ? "D" : overall < 70 ? "C" : overall < 85 ? "B" : "A";
  const gradeLabel =
    overall < 30 ? "Critical" : overall < 50 ? "Poor" : overall < 70 ? "Fair" : overall < 85 ? "Good" : "Excellent";

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
  // Flag any drive where health data couldn't be read
  if (s && s.dataSource === "unavailable") {
    warnings.push("Drive health data could not be retrieved — storage score excluded from overall calculation.");
    structuredWarnings.push({
      type: "nvme_unavailable",
      severity: "medium",
      title: "Drive health data could not be retrieved",
      detail: "Your drive's S.M.A.R.T. health attributes could not be read, likely because the drive requires elevated permissions or uses a non-standard command set. Storage wear scoring has been excluded to avoid inaccurate results.",
      oemComparison: "OEM tools often have privileged access to drive health data through vendor-specific drivers. However, they typically only report a binary pass/fail rather than detailed wear metrics.",
      excludedFromScoring: true,
    });
  }

  // Warn about long uptime
  if (uptimeDays > 7) {
    structuredWarnings.push({
      type: "info",
      severity: uptimeDays > 14 ? "medium" : "low",
      title: `System uptime: ${Math.round(uptimeDays)} days without reboot`,
      detail: `Your system has been running for ${Math.round(uptimeDays)} days without a restart. Long uptimes allow background processes to accumulate, memory to fragment, and deferred Windows updates to stack up. A restart is recommended to restore peak performance and apply pending security patches.`,
      oemComparison: "OEM diagnostic tools do not measure or report system uptime as a health factor.",
      excludedFromScoring: false,
    });
  }

  return {
    overall, grade, gradeLabel, components,
    findings: generateFindings(r),
    predictions: generatePredictions(r),
    system: { model: r.system.model, hostname: r.system.hostname, os: r.system.os ?? "" },
    generatedAt: r.generatedAt,
    algoVersion: ALGORITHM_VERSION,
    rawReport: r,
    dataQuality: {
      thermalSource: t?.thermalSource ?? undefined,
      storageSource: s?.dataSource ?? undefined,
      warnings,
      structuredWarnings,
    },
  };
}
