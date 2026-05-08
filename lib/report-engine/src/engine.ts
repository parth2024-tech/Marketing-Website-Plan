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
}

export interface ReportResult {
  overall: number;
  grade: string;
  gradeLabel: string;
  components: ComponentScore[];
  findings: Finding[];
  system: { model: string; hostname: string; os: string };
  generatedAt: string;
  algoVersion: number;
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

function memoryScore(r: SentinelReport): ComponentScore | null {
  const m = r.memory;
  if (!m) return null;
  const used = m.usedPct;
  const score = used > 90 ? 35 : used > 80 ? 55 : used > 70 ? 75 : 100;
  return {
    name: "Memory",
    score: clamp(score),
    status: scoreStatus(score),
    detail: `${m.totalGB} GB · ${used.toFixed(0)}% used`,
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
      findings.push({ component: "Battery", title: "Battery capacity critically low",
        body: `Your battery retains only ${b.health.toFixed(1)}% of its original capacity. At this level, runtime is severely reduced and unexpected shutdowns may occur.`,
        urgency: "critical", pro: false });
    } else if (b.health < 75) {
      findings.push({ component: "Battery", title: "Battery capacity degraded",
        body: `Current capacity: ${b.health.toFixed(1)}% of original. You're losing measurable runtime per charge cycle. Battery replacement is worth planning.`,
        urgency: "warning", pro: false });
    }
  }
  if (b?.cycleCount != null && b.cycleCount > 500) {
    findings.push({ component: "Battery", title: "High cycle count detected",
      body: `${b.cycleCount} charge cycles recorded. Most laptop batteries are rated for 300–500 full cycles before significant degradation. You're past this threshold.`,
      urgency: b.cycleCount > 800 ? "critical" : "warning", pro: false });
  }
  // Pro: degradation trajectory — requires both health and cycles
  if (b?.health != null && b?.cycleCount != null) {
    const expected = expectedBatteryHealth(b.cycleCount);
    if (expected - b.health > 8) {
      findings.push({ component: "Battery", title: "Degradation trajectory: faster-than-normal wear detected",
        body: `At ${b.cycleCount} cycles, a typical battery retains ~${expected.toFixed(0)}% capacity. Yours is at ${b.health.toFixed(1)}% — ${(expected - b.health).toFixed(1)} points below baseline. Sentinel projects replacement-grade degradation approximately 3–4 months earlier than average.`,
        urgency: "warning", pro: true });
    }
  }

  // Thermals
  if (t?.maxTempC != null) {
    if (t.maxTempC > 90) {
      findings.push({ component: "Thermals", title: "Critical peak temperature recorded",
        body: `Your system reached ${t.maxTempC.toFixed(1)}°C. Sustained temperatures above 90°C accelerate thermal paste degradation, reduce fan bearing lifespan, and can trigger permanent CPU performance reduction.`,
        urgency: "critical", pro: false });
    } else if (t.maxTempC > 80) {
      findings.push({ component: "Thermals", title: "Elevated peak temperature",
        body: `Peak temperature of ${t.maxTempC.toFixed(1)}°C detected. This is above the recommended sustained operating range for most consumer processors. Check vent clearance.`,
        urgency: "warning", pro: false });
    }
  }
  if (t?.throttleEvents30min != null && t.throttleEvents30min > 5) {
    findings.push({ component: "Thermals", title: `${t.throttleEvents30min} thermal throttle events detected`,
      body: "CPU throttling reduces performance and indicates the cooling system is struggling to dissipate heat. Common causes: blocked vents, degraded thermal paste, or dust accumulation.",
      urgency: t.throttleEvents30min > 15 ? "critical" : "warning", pro: false });
  }
  // Pro: thermal-battery correlation — requires both
  if (t?.maxTempC != null && b?.health != null && t.maxTempC > 78) {
    findings.push({ component: "Thermals + Battery", title: "Correlated finding: sustained heat is accelerating battery degradation",
      body: "Sentinel detects a statistically significant pattern between your sustained high operating temperatures and your battery's above-average degradation rate. Every 10°C of sustained heat above 30°C ambient doubles lithium-ion degradation speed.",
      urgency: "warning", pro: true });
  }

  // Storage
  if (s?.reallocatedSectors != null && s.reallocatedSectors > 0) {
    findings.push({ component: "Storage", title: `SSD has ${s.reallocatedSectors} reallocated sector${s.reallocatedSectors > 1 ? "s" : ""}`,
      body: "Reallocated sectors indicate the drive has found and remapped bad blocks. Non-zero reallocated sectors are a serious early failure indicator. Back up immediately and monitor closely.",
      urgency: "critical", pro: false });
  }
  if (s?.freeSpacePct != null && s.freeSpacePct < 10) {
    findings.push({ component: "Storage", title: `Storage critically low — ${s.freeSpacePct.toFixed(1)}% free`,
      body: "SSDs require approximately 10–15% free space to maintain write performance and endurance. Below this threshold, write amplification increases, accelerating wear.",
      urgency: s.freeSpacePct < 5 ? "critical" : "warning", pro: false });
  }
  // Pro: SSD wear timeline — triggers when remaining life drops below 80%
  if (s?.wearLevelPct != null && s.wearLevelPct < 80) {
    const consumed = 100 - s.wearLevelPct;
    findings.push({ component: "Storage", title: "SSD wear trajectory: elevated consumption rate detected",
      body: `Your SSD has consumed ${consumed}% of its rated write endurance. Based on the observed wear rate, Sentinel projects the endurance limit will be reached sooner than average. Begin scheduling periodic backups and consider your next upgrade window.`,
      urgency: s.wearLevelPct < 50 ? "critical" : "warning", pro: true });
  }

  // Info
  if (b?.health != null && b.health >= 75 && !findings.some(f => f.component === "Battery" && f.urgency !== "info")) {
    findings.push({ component: "Battery", title: "Battery in normal operating range",
      body: `Capacity at ${b.health.toFixed(1)}%. No immediate action needed.`,
      urgency: "info", pro: false });
  }

  return findings;
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
  const overall = clamp(Math.round(weightedSum / totalWeight));
  const grade =
    overall < 40 ? "F" : overall < 55 ? "D" : overall < 65 ? "C" : overall < 80 ? "B" : "A";
  const gradeLabel =
    overall < 40 ? "Critical" : overall < 55 ? "Poor" : overall < 65 ? "Fair" : overall < 80 ? "Good" : "Excellent";

  return {
    overall, grade, gradeLabel, components,
    findings: generateFindings(r),
    system: { model: r.system.model, hostname: r.system.hostname, os: r.system.os ?? "" },
    generatedAt: r.generatedAt,
    algoVersion: ALGORITHM_VERSION,
  };
}
