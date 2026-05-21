import { describe, it, expect } from 'vitest';
import { expectedBatteryHealth, generateReport, combinedScore, ALGORITHM_VERSION } from './engine';
import type { SentinelReport } from './schema';

describe('Scoring Engine Algorithms', () => {
  
  describe('expectedBatteryHealth (Degradation Curve)', () => {
    it('should return 100 at 0 cycles', () => {
      expect(expectedBatteryHealth(0)).toBe(100);
    });

    it('should interpolate correctly between anchors', () => {
      // Anchor 0 is [0, 100], Anchor 1 is [100, 97]
      // 50 cycles should be 98.5
      expect(expectedBatteryHealth(50)).toBe(98.5);
    });

    it('should return exact anchor values', () => {
      expect(expectedBatteryHealth(300)).toBe(85);
      expect(expectedBatteryHealth(700)).toBe(65);
    });

    it('should cap at the maximum degraded baseline for cycles > 1000', () => {
      expect(expectedBatteryHealth(1200)).toBe(50); // Anchor 1000 is 50
      expect(expectedBatteryHealth(5000)).toBe(50);
    });
  });

  describe('combinedScore', () => {
    it('should weight hardware at 70% and habits at 30%', () => {
      expect(combinedScore(100, 100)).toBe(100);
      expect(combinedScore(80, 50)).toBe(71); // (80 * 0.7) + (50 * 0.3) = 56 + 15 = 71
      expect(combinedScore(0, 100)).toBe(30);
    });
  });

  describe('generateReport Component Scoring & Findings', () => {
    // Base healthy report template
    const createBaseReport = (): SentinelReport => ({
      sentinelSchema: 1,
      system: { manufacturer: 'TestCorp', model: 'TestBook Pro', hostname: 'test-pc', os: 'Windows 11' },
      generatedAt: new Date().toISOString(),
      battery: { health: 100, cycleCount: 10, fullChargeCapacity: 50000, designCapacity: 50000 },
      thermals: { maxTempC: 45, throttleEvents30min: 0, thermalSource: 'wmi' },
      storage: [{ model: 'Test SSD', healthPct: 100, wearLevelPct: 100, freeSpacePct: 50, reallocatedSectors: 0, type: 'NVMe', dataSource: 'wmi' }],
      memory: { totalGB: 16, usedPct: 40 },
      cpu: { name: 'Test CPU', avgLoadPct: 15, throttleEvents30min: 0 }
    });

    it('should generate an A-grade report with a perfect score for a healthy system', () => {
      const report = createBaseReport();
      const result = generateReport(report);
      
      expect(result.overall).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.gradeLabel).toBe('Excellent');
      expect(result.algoVersion).toBe(ALGORITHM_VERSION);
      
      // Ensure all 5 components were scored
      expect(result.components).toHaveLength(5);
      result.components.forEach(c => {
        expect(c.score).toBe(100);
        expect(c.status).toBe('healthy');
      });
    });

    it('should penalise thermal score for extreme temperatures and throttling', () => {
      const report = createBaseReport();
      report.thermals = { maxTempC: 96, throttleEvents30min: 25, thermalSource: 'wmi' }; // Base score 10, penalty 20 -> cap 0
      
      const result = generateReport(report);
      const thermalComponent = result.components.find(c => c.name === 'Thermals');
      
      expect(thermalComponent).toBeDefined();
      expect(thermalComponent!.score).toBe(0);
      expect(thermalComponent!.status).toBe('critical');

      // Should trigger a critical finding for temps > 90
      const criticalTempFinding = result.findings.find(f => f.title === 'Critical peak temperature recorded');
      expect(criticalTempFinding).toBeDefined();
      expect(criticalTempFinding!.urgency).toBe('critical');
    });

    it('should penalise battery score severely for wear beyond expected curves', () => {
      const report = createBaseReport();
      // At 100 cycles, expected is 97. Actual is 50.
      // Gap is 47. Penalty is Math.min(20, 47 - 10) = 20.
      // Score = 50 - 20 = 30.
      report.battery = { health: 50, cycleCount: 100 };
      
      const result = generateReport(report);
      const batteryComponent = result.components.find(c => c.name === 'Battery');
      
      expect(batteryComponent).toBeDefined();
      expect(batteryComponent!.score).toBe(30);
      
      const wearFinding = result.findings.find(f => f.title === 'Battery capacity critically low');
      expect(wearFinding).toBeDefined();
    });

    it('should flag ACPI static thermal suspect data and exclude it from scoring', () => {
      const report = createBaseReport();
      report.thermals = { maxTempC: 55, throttleEvents30min: 0, thermalSource: 'acpi_static_suspect' };
      
      const result = generateReport(report);
      
      // The thermal component should be stripped from the results
      const thermalComponent = result.components.find(c => c.name === 'Thermals');
      expect(thermalComponent).toBeUndefined();
      
      // Data quality warning should be populated
      expect(result.dataQuality.structuredWarnings).toHaveLength(1);
      expect(result.dataQuality.structuredWarnings[0].type).toBe('acpi_static');
    });

    it('should penalise storage score for reallocated sectors and low free space', () => {
      const report = createBaseReport();
      report.storage = [{ 
        model: 'Failing SSD', 
        healthPct: 90, 
        wearLevelPct: 90, // Base 90
        freeSpacePct: 4,  // < 5% penalty = 20
        reallocatedSectors: 5, // penalty = Math.min(40, 5*5 = 25)
        type: 'NVMe', 
        dataSource: 'wmi' 
      }];
      
      // Expected score: 90 - 20 - 25 = 45
      const result = generateReport(report);
      const storageComponent = result.components.find(c => c.name === 'Storage');
      
      expect(storageComponent).toBeDefined();
      expect(storageComponent!.score).toBe(45);
      
      const sectorFinding = result.findings.find(f => f.title.includes('reallocated sector'));
      expect(sectorFinding).toBeDefined();
      expect(sectorFinding!.urgency).toBe('critical');
    });

    it('should trigger B2B Pro correlation findings when thermal + battery issues coincide', () => {
      const report = createBaseReport();
      // Combine high heat with degraded battery
      report.thermals = { maxTempC: 85, throttleEvents30min: 0, thermalSource: 'wmi' };
      report.battery = { health: 70, cycleCount: 300 };
      
      const result = generateReport(report);
      
      const correlationFinding = result.findings.find(f => f.title.includes('Correlated finding: sustained heat is accelerating battery degradation'));
      expect(correlationFinding).toBeDefined();
      expect(correlationFinding!.pro).toBe(true);
    });

  });
});
