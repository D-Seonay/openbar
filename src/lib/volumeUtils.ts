import type { Bottle } from "./types";

/**
 * Convert string size (e.g., "1.5L", "70cl", "50cl", "750ml") to Liters
 */
export function parseSizeToLiters(size: string): number {
  if (!size) return 0.7; // Default 70cl
  const clean = size.toLowerCase().replace(/,/g, ".").replace(/\s+/g, "").trim();
  
  if (clean.endsWith("cl")) {
    const val = parseFloat(clean.replace("cl", ""));
    return isNaN(val) ? 0.7 : val / 100;
  }
  if (clean.endsWith("ml")) {
    const val = parseFloat(clean.replace("ml", ""));
    return isNaN(val) ? 0.7 : val / 1000;
  }
  if (clean.endsWith("l")) {
    const val = parseFloat(clean.replace("l", ""));
    return isNaN(val) ? 1 : val;
  }

  // Pure numeric string
  const val = parseFloat(clean);
  if (isNaN(val)) return 0.7;
  // If > 10, assume cl (e.g. 70 => 0.7L), otherwise assume L (e.g. 1.5 => 1.5L)
  return val > 10 ? val / 100 : val;
}

/**
 * Calculates the total volume in Liters across all stock formats for a bottle
 */
export function calculateBottleTotalLiters(bottle: Bottle): number {
  if (bottle.volumes && bottle.volumes.length > 0) {
    const total = bottle.volumes.reduce((acc, vol) => {
      const liters = parseSizeToLiters(vol.size);
      return acc + liters * (vol.quantity || 0);
    }, 0);
    return Math.round(total * 100) / 100;
  }
  // Fallback if no specific format list exists
  return Math.round(bottle.quantity * 0.7 * 100) / 100;
}

/**
 * Returns the total count of physical bottles
 */
export function calculateTotalBottlesCount(bottle: Bottle): number {
  if (bottle.volumes && bottle.volumes.length > 0) {
    return bottle.volumes.reduce((sum, v) => sum + (v.quantity || 0), 0);
  }
  return bottle.quantity;
}

/**
 * Formats a number of Liters nicely in French locale (e.g. 2 -> "2,0 L", 1.5 -> "1,5 L")
 */
export function formatLiters(liters: number): string {
  if (isNaN(liters) || liters <= 0) return "0 L";
  // If whole number, format as X L or X,0 L
  const formatted = liters.toLocaleString("fr-FR", {
    minimumFractionDigits: liters % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
  return `${formatted} L`;
}
