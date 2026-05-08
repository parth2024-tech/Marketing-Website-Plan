import { z } from "zod";

export const StorageDeviceSchema = z.object({
  model: z.string().optional(),
  type: z.string().optional(),
  healthPct: z.number().optional(),
  reallocatedSectors: z.number().optional(),
  wearLevelPct: z.number().optional(),
  freeSpacePct: z.number().optional(),
  totalGB: z.number().optional(),
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
    os: z.string().optional(),
    osVersion: z.string().optional(),
    biosVersion: z.string().optional(),
  }),
  battery: z
    .object({
      designCapacity: z.number().optional(),
      fullChargeCapacity: z.number().optional(),
      cycleCount: z.number().optional(),
      health: z.number().optional(),
      status: z.union([z.string(), z.number()]).optional(),
      dischargeRateMw: z.number().optional(),
    })
    .optional(),
  thermals: z
    .object({
      maxTempC: z.number().optional(),
      zones: z.array(ThermalZoneSchema).optional(),
      zoneCount: z.number().optional(),
      throttleEvents30min: z.number().optional(),
    })
    .optional(),
  storage: z.array(StorageDeviceSchema).optional(),
  memory: z
    .object({
      totalGB: z.number(),
      usedPct: z.number(),
      pageFaultsPerSec: z.number().optional(),
    })
    .optional(),
  cpu: z
    .object({
      name: z.string().optional(),
      cores: z.number().optional(),
      threads: z.number().optional(),
      avgLoadPct: z.number().optional(),
      throttleEvents30min: z.number().optional(),
      maxClockMhz: z.number().optional(),
    })
    .optional(),
  startup: z
    .object({
      lastBootTime: z.string().optional(),
      lastBootSec: z.number().optional(),
    })
    .optional(),
});

export type SentinelReport = z.infer<typeof SentinelReportSchema>;
export type StorageDevice = z.infer<typeof StorageDeviceSchema>;

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
