/**
 * Units of Measurement and Dimensional Conversion Utility
 * Strictly enforces physical unit compatibility (Mass, Volume, Discrete)
 * to prevent corrupting stock balances or combining incompatible units.
 */

export type UnitDimension = "mass" | "volume" | "discrete";

export const SUPPORTED_UNITS = [
  "kg",
  "g",
  "litres",
  "ml",
  "pieces",
  "packs",
  "portions",
] as const;

export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

export function isValidUnit(unit: string): boolean {
  if (!unit || typeof unit !== "string") return false;
  const norm = normalizeUnit(unit);
  return (SUPPORTED_UNITS as readonly string[]).includes(norm);
}

export function normalizeUnit(rawUnit: string): string {
  const clean = (rawUnit || "").trim().toLowerCase();
  switch (clean) {
    case "l":
    case "litre":
    case "liter":
    case "liters":
    case "litres":
      return "litres";
    case "millilitre":
    case "milliliter":
    case "ml":
      return "ml";
    case "kilogram":
    case "kilograms":
    case "kg":
      return "kg";
    case "gram":
    case "grams":
    case "g":
      return "g";
    case "piece":
    case "pc":
    case "pcs":
    case "pieces":
      return "pieces";
    case "pack":
    case "packs":
    case "packet":
    case "packets":
      return "packs";
    case "portion":
    case "portions":
      return "portions";
    default:
      return clean;
  }
}

export function getUnitDimension(unit: string): UnitDimension {
  const norm = normalizeUnit(unit);
  if (norm === "kg" || norm === "g") {
    return "mass";
  }
  if (norm === "litres" || norm === "ml") {
    return "volume";
  }
  return "discrete";
}

/**
 * Checks whether two units belong to the same physical dimension and can be converted.
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const normA = normalizeUnit(unitA);
  const normB = normalizeUnit(unitB);

  if (normA === normB) return true;

  const dimA = getUnitDimension(normA);
  const dimB = getUnitDimension(normB);

  if (dimA !== dimB) return false;

  // Discrete units must match identically (e.g. pieces cannot be converted to packs without a package multiplier)
  if (dimA === "discrete") {
    return normA === normB;
  }

  return true;
}

/**
 * Converts a quantity from one unit to another within the same dimension.
 * Throws an Error if units belong to different dimensions (e.g. kg to ml).
 */
export function convertUnitQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number {
  const qty = Number(quantity);
  if (isNaN(qty)) {
    throw new Error(`Invalid numeric quantity: ${quantity}`);
  }

  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo) {
    return Math.round(qty * 1000) / 1000;
  }

  if (!areUnitsCompatible(normFrom, normTo)) {
    throw new Error(
      `Incompatible unit conversion: Cannot convert ${fromUnit} (${getUnitDimension(
        fromUnit
      )}) to ${toUnit} (${getUnitDimension(toUnit)}).`
    );
  }

  // Mass conversions (base = kg)
  if (normFrom === "kg" && normTo === "g") {
    return Math.round(qty * 1000 * 1000) / 1000;
  }
  if (normFrom === "g" && normTo === "kg") {
    return Math.round((qty / 1000) * 1000) / 1000;
  }

  // Volume conversions (base = litres)
  if (normFrom === "litres" && normTo === "ml") {
    return Math.round(qty * 1000 * 1000) / 1000;
  }
  if (normFrom === "ml" && normTo === "litres") {
    return Math.round((qty / 1000) * 1000) / 1000;
  }

  return Math.round(qty * 1000) / 1000;
}
