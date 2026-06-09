import { z } from "zod";

// .nullish() = accepts number | null | undefined
// This is critical: PowerShell and WMI return JSON null (not undefined) for
// unavailable hardware metrics. Zod's plain .optional() only accepts undefined
// and will throw a 422 for any null value. Using .nullish() everywhere a
// hardware field might be missing is the permanent fix.

export const StorageDeviceSchema = z.object({
  model: z.string().nullish(),
  type: z.string().nullish(),
  healthPct: z.number().nullish(),
  reallocatedSectors: z.number().nullish(),
  wearLevelPct: z.number().nullish(),
  freeSpacePct: z.number().nullish(),
  totalGB: z.number().nullish(),
  powerOnHours: z.number().nullish(),
  dataSource: z.string().nullish(),
});

export const ThermalZoneSchema = z.object({
  name: z.string(),
  tempC: z.number(),
});

export const SentinelReportSchema = z.object({
  sentinelSchema: z.literal(1),
  generatedAt: z.string(),
  system: z.object({
    hostname: z.string(),
    model: z.string(),
    manufacturer: z.string(),
    os: z.string().nullish(),
    osVersion: z.string().nullish(),
    biosVersion: z.string().nullish(),
  }),
  battery: z
    .object({
      designCapacity: z.number().nullish(),
      fullChargeCapacity: z.number().nullish(),
      cycleCount: z.number().nullish(),
      health: z.number().nullish(),
      status: z.union([z.string(), z.number()]).nullish(),
      dischargeRateMw: z.number().nullish(),
    })
    .nullish(),
  thermals: z
    .object({
      maxTempC: z.number().nullish(),
      zones: z.array(ThermalZoneSchema).nullish(),
      zoneCount: z.number().nullish(),
      throttleEvents30min: z.number().nullish(),
      thermalSource: z.string().nullish(),
      thermalSamples: z.number().nullish(),
    })
    .nullish(),
  storage: z.array(StorageDeviceSchema).nullish(),
  memory: z
    .object({
      totalGB: z.number(),
      usedPct: z.number(),
      pageFaultsPerSec: z.number().nullish(),
    })
    .nullish(),
  cpu: z
    .object({
      name: z.string().nullish(),
      cores: z.number().nullish(),
      threads: z.number().nullish(),
      avgLoadPct: z.number().nullish(),
      throttleEvents30min: z.number().nullish(),
      maxClockMhz: z.number().nullish(),
    })
    .nullish(),
  startup: z
    .object({
      lastBootTime: z.string().nullish(),
      lastBootSec: z.number().nullish(),
    })
    .nullish(),
});

/**
 * SentinelReport type representing the full validated diagnostic JSON payload.
 */
export type SentinelReport = z.infer<typeof SentinelReportSchema>;

/**
 * StorageDevice type representing a single storage drive unit telemetry model.
 */
export type StorageDevice = z.infer<typeof StorageDeviceSchema>;

/**
 * Parses and validates raw JSON telemetry data submitted by a client diagnostic script.
 * 
 * Verifies structural conformity against SentinelReportSchema (ver. 1) and generates
 * helpful, pinpointed validation errors indicating structural path failures.
 * 
 * @param raw Raw telemetry payload string.
 * @returns An object containing the typed SentinelReport data or a descriptive validation error.
 */
export function parseReport(raw: string): { data: SentinelReport | null; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return {
      data: null,
      error: "Couldn't parse JSON — make sure you copied the full output from the script.",
    };
  }
  const result = SentinelReportSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join(".");
    return {
      data: null,
      error: `Schema error at "${path}": ${firstIssue.message}. Your script output may be outdated — download the latest script from this page.`,
    };
  }
  return { data: result.data, error: null };
}
