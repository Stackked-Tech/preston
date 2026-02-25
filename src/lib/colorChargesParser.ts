/**
 * Color Charges CSV Parser
 *
 * Parses the Phorest "Color Stylist List Report" CSV export.
 * Extracts the Price column (which maps to Column P in NetSuite payroll)
 * and matches stylist names to configured staff members.
 *
 * CSV format:
 *   Stylist, Cost, Price, Mark up
 *   "Ashleigh Dotson", "$68.70", "$88.32", "$19.63"
 *   ...
 *   "total", "$1,305.06", "$1,671.31", "$366.24"
 */

import Papa from "papaparse";
import type { BranchConfig } from "./payrollConfig";

interface ColorRow {
  Stylist?: string;
  Price?: string;
  [key: string]: string | undefined;
}

export interface ColorChargesResult {
  /** Map of Phorest staff name → color charge amount (positive value) */
  charges: Record<string, number>;
  /** Names in the CSV that couldn't be matched to any configured staff */
  unmatchedNames: string[];
  /** Warnings for the user */
  warnings: string[];
}

/**
 * Normalize a name for fuzzy matching: lowercase, collapse whitespace,
 * strip non-alpha characters except spaces.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a currency string like "$1,305.06" → 1305.06
 */
function parseCurrency(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[$,]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Parse a color charges CSV and match names to configured staff.
 *
 * Matching strategy (in order):
 * 1. Exact Phorest name match (normalized whitespace)
 * 2. First name + last name fuzzy match against staffConfig entries
 */
export function parseColorChargesCSV(
  csvText: string,
  branch: BranchConfig
): ColorChargesResult {
  const charges: Record<string, number> = {};
  const unmatchedNames: string[] = [];
  const warnings: string[] = [];

  const parsed = Papa.parse<ColorRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    warnings.push(
      `Color charges CSV parse warnings: ${parsed.errors.length} issues`
    );
  }

  // Handle BOM in header — papaparse may include it in the first header key
  const firstKey = parsed.meta.fields?.[0] || "";
  const stylistKey = firstKey.replace(/^\uFEFF/, "");
  const hasBom = firstKey !== stylistKey;

  const { staffConfig } = branch;

  // Build a lookup of normalized name → phorest name for matching
  const normalizedLookup = new Map<string, string>();
  for (const phorestName of Object.keys(staffConfig)) {
    normalizedLookup.set(normalizeName(phorestName), phorestName);
  }

  // Build first-name + last-initial lookup for fuzzy matching
  const firstNameLookup = new Map<string, string[]>();
  for (const phorestName of Object.keys(staffConfig)) {
    const firstName = normalizeName(phorestName.split(" ")[0]);
    if (!firstNameLookup.has(firstName)) {
      firstNameLookup.set(firstName, []);
    }
    firstNameLookup.get(firstName)!.push(phorestName);
  }

  for (const row of parsed.data) {
    // Get stylist name — handle BOM key
    const rawName = (hasBom ? row[firstKey] : row["Stylist"] || row[stylistKey])?.trim();
    if (!rawName || rawName.toLowerCase() === "total") continue;

    const price = parseCurrency(row["Price"]);
    if (price === 0) continue;

    const normalized = normalizeName(rawName);

    // 1. Direct match (normalized)
    const directMatch = normalizedLookup.get(normalized);
    if (directMatch) {
      charges[directMatch] = (charges[directMatch] || 0) + price;
      continue;
    }

    // 2. First-name match with last-name fuzzy
    const csvParts = normalized.split(" ");
    const csvFirst = csvParts[0];
    const csvLast = csvParts.slice(1).join(" ");
    const candidates = firstNameLookup.get(csvFirst);

    if (candidates && candidates.length > 0) {
      let matched = false;
      for (const candidate of candidates) {
        const candLast = normalizeName(
          candidate.split(" ").slice(1).join(" ")
        );
        // Check if last names share a common word
        const csvLastWords = csvLast.split(" ");
        const candLastWords = candLast.split(" ");
        const hasCommonWord = csvLastWords.some((w) =>
          candLastWords.some((cw) => w === cw && w.length > 1)
        );
        if (hasCommonWord) {
          charges[candidate] = (charges[candidate] || 0) + price;
          matched = true;
          break;
        }
      }

      // If only one candidate with that first name, accept it
      if (!matched && candidates.length === 1) {
        charges[candidates[0]] = (charges[candidates[0]] || 0) + price;
        warnings.push(
          `Color charges: matched "${rawName}" → "${candidates[0]}" by first name only`
        );
        matched = true;
      }

      if (!matched) {
        unmatchedNames.push(rawName);
        warnings.push(
          `Color charges: could not match "${rawName}" to any staff member`
        );
      }
    } else {
      unmatchedNames.push(rawName);
      warnings.push(
        `Color charges: could not match "${rawName}" to any staff member`
      );
    }
  }

  return { charges, unmatchedNames, warnings };
}
