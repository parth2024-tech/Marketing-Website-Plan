import { describe, it, expect } from 'vitest';
import { expectedBatteryHealth } from './engine';

describe('engine', () => {
  describe('expectedBatteryHealth', () => {
    it('should return 100 at 0 cycles', () => {
      expect(expectedBatteryHealth(0)).toBe(100);
    });

    it('should interpolate correctly between anchors', () => {
      // Anchor 0 is [0, 100], Anchor 1 is [100, 97]
      // 50 cycles should be 98.5
      expect(expectedBatteryHealth(50)).toBe(98.5);
    });
  });
});
