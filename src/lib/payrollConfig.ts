/**
 * Payout Suite — Branch & Staff Configuration
 *
 * Each branch has its own staff roster, NetSuite IDs, and fee structure.
 * Staff pulled from Phorest API — only service providers included
 * (Level 1-6, Stylist, Esthetician, Nail Tech, Massage Therapist, etc.).
 *
 * NOTE: Branches other than Mount Holly have placeholder values (0) for
 * internalId and fees. Update these with actual NetSuite values before use.
 */

export interface StaffMember {
  targetFirst: string;
  targetLast: string;
  internalId: number;
  stationLease: number;
  financialServices: number;
  phorestFee: number;
  refreshment: number;
  associatePay?: number | null;
  supervisor?: string | null;
}

export interface BranchConfig {
  branchId: string;
  name: string;
  abbreviation: string;
  subsidiaryId: number;
  account: number;
  staffConfig: Record<string, StaffMember>;
  staffOrder: string[];
  employeePurchaseNameMap: Record<string, string>;
}

export interface PayPeriodConfig {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  week1End: string;
  payDate: string;
  postingPeriod: string;
  payPeriodLabel: string;
  subsidiaryId: number;
  account: number;
}

// New guest qualifying client sources
export const NEW_GUEST_SOURCES = new Set([
  "Call In ---New Guest",
  "Online Booking ---New Guest",
  "Walk In --New Guest",
]);

/**
 * Compute pay date: the Thursday following the period end.
 */
export function computePayDate(periodEnd: string): string {
  const d = new Date(periodEnd + "T12:00:00");
  // Advance to next Thursday (day 4)
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 4);
  return d.toISOString().split("T")[0];
}

/**
 * Compute all derived pay period values from start/end dates.
 */
export function computePayPeriodConfig(
  periodStart: string,
  periodEnd: string,
  subsidiaryId: number,
  account: number
): PayPeriodConfig {
  // Week 1 ends on the first Saturday on or after start date
  const start = new Date(periodStart + "T12:00:00");
  const d = new Date(start);
  while (d.getDay() !== 6) {
    // 6 = Saturday
    d.setDate(d.getDate() + 1);
  }
  const week1End = d.toISOString().split("T")[0];

  // Posting period = 1st of the month
  const postingPeriod = periodStart.slice(0, 7) + "-01";

  // Pay period label
  const startDate = new Date(periodStart + "T12:00:00");
  const endDate = new Date(periodEnd + "T12:00:00");
  const labelStart = startDate.getDate() <= 15 ? 1 : 16;
  const payPeriodLabel = `${startDate.getMonth() + 1}/${labelStart}-${endDate.getDate()}/${endDate.getFullYear()}`;

  const payDate = computePayDate(periodEnd);

  return {
    periodStart,
    periodEnd,
    week1End,
    payDate,
    postingPeriod,
    payPeriodLabel,
    subsidiaryId,
    account,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCH CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const MOUNT_HOLLY_STAFF: Record<string, StaffMember> = {
  "Danielle Baker": {
    targetFirst: "Danielle",
    targetLast: "Seeger Baker",
    internalId: 1736,
    stationLease: -390,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Gabby Brewer": {
    targetFirst: "Gabby",
    targetLast: "Brewer",
    internalId: 3072,
    stationLease: 0,
    financialServices: 0,
    phorestFee: 0,
    refreshment: 0,
  },
  "Emma Davis": {
    targetFirst: "Emma",
    targetLast: "Baldwin-Davis",
    internalId: 1738,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Addison Brown": {
    targetFirst: "Addison",
    targetLast: "Brown",
    internalId: 3071,
    stationLease: 0,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
    associatePay: null,
    supervisor: "Seth King",
  },
  "Grace Deason": {
    targetFirst: "Grace",
    targetLast: "Deason",
    internalId: 1743,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Molly Diaz": {
    targetFirst: "Molly",
    targetLast: "Diaz",
    internalId: 1758,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Ashleigh Dotson": {
    targetFirst: "Ashleigh",
    targetLast: "Dotson",
    internalId: 1726,
    stationLease: -390,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Kristen Forehand": {
    targetFirst: "Kristen",
    targetLast: "Forehand",
    internalId: 1752,
    stationLease: -238,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Aubrey Hawkins": {
    targetFirst: "Aubrey",
    targetLast: "Hawkins",
    internalId: 2667,
    stationLease: -25,
    financialServices: -50,
    phorestFee: -5,
    refreshment: -5,
  },
  "Jess Herzog": {
    targetFirst: "Jess",
    targetLast: "Herzog",
    internalId: 2296,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Kaylie Houghtaling": {
    targetFirst: "Kaylie",
    targetLast: "Houghtaling",
    internalId: 1751,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Seth King": {
    targetFirst: "Seth ",
    targetLast: "King",
    internalId: 1771,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Grace Lesser": {
    targetFirst: "Grace",
    targetLast: "Lesser",
    internalId: 3074,
    stationLease: 0,
    financialServices: 0,
    phorestFee: 0,
    refreshment: 0,
    associatePay: null,
    supervisor: null,
  },
  "Cassi Mcclure": {
    targetFirst: "Cassi",
    targetLast: "McClure",
    internalId: 1731,
    stationLease: -390,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Brooke Parker": {
    targetFirst: "Brooke",
    targetLast: "Parker",
    internalId: 2671,
    stationLease: -320,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Keleigh Ratliff": {
    targetFirst: "Keleigh",
    targetLast: "Ratliff",
    internalId: 1635,
    stationLease: 0,
    financialServices: 0,
    phorestFee: 0,
    refreshment: 0,
  },
  "Torey Rome": {
    targetFirst: "Torey",
    targetLast: "Rome",
    internalId: 1775,
    stationLease: -390,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Maddie Schultz": {
    targetFirst: "Maddie",
    targetLast: "Schultz",
    internalId: 3073,
    stationLease: 0,
    financialServices: 0,
    phorestFee: 0,
    refreshment: 0,
    associatePay: null,
    supervisor: null,
  },
  "Sierra Sharpe": {
    targetFirst: "Sierra",
    targetLast: "Sharpe",
    internalId: 3077,
    stationLease: 0,
    financialServices: -50,
    phorestFee: -5,
    refreshment: -5,
    associatePay: null,
    supervisor: "Kristen Forehand",
  },
  "Dana Siepert": {
    targetFirst: "Dana",
    targetLast: "Siepert",
    internalId: 2295,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Lauren Simonds": {
    targetFirst: "Lauren",
    targetLast: "Simonds",
    internalId: 1754,
    stationLease: -336,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Aubrey White": {
    targetFirst: "Aubrey",
    targetLast: "White",
    internalId: 2670,
    stationLease: -320,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
  "Olivia Wilson": {
    targetFirst: "Olivia",
    targetLast: "Cornette Wilson",
    internalId: 1765,
    stationLease: -390,
    financialServices: -100,
    phorestFee: -10,
    refreshment: -10,
  },
};

const MOUNT_HOLLY_ORDER = [
  "Danielle Baker",
  "Gabby Brewer",
  "Emma Davis",
  "Addison Brown",
  "Grace Deason",
  "Molly Diaz",
  "Ashleigh Dotson",
  "Kristen Forehand",
  "Aubrey Hawkins",
  "Jess Herzog",
  "Kaylie Houghtaling",
  "Seth King",
  "Grace Lesser",
  "Cassi Mcclure",
  "Brooke Parker",
  "Keleigh Ratliff",
  "Torey Rome",
  "Maddie Schultz",
  "Sierra Sharpe",
  "Dana Siepert",
  "Lauren Simonds",
  "Aubrey White",
  "Olivia Wilson",
];

// ═══════════════════════════════════════════════════════════════════════════════
// McADENVILLE STAFF
// NOTE: internalId and fees are placeholders — update with NetSuite values
// ═══════════════════════════════════════════════════════════════════════════════

const MCADENVILLE_STAFF: Record<string, StaffMember> = {
  "April McElwaine": { targetFirst: "April", targetLast: "McElwaine", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Ashley Mull": { targetFirst: "Ashley", targetLast: "Mull", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Brianna Cope": { targetFirst: "Brianna", targetLast: "Cope", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Chloey Bailey": { targetFirst: "Chloey", targetLast: "Bailey", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Ciara Petty": { targetFirst: "Ciara", targetLast: "Petty", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Dayna Simmons": { targetFirst: "Dayna", targetLast: "Simmons", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Emily English": { targetFirst: "Emily", targetLast: "English", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Hannah Fleming": { targetFirst: "Hannah", targetLast: "Fleming", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Jessica Pitts": { targetFirst: "Jessica", targetLast: "Pitts", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kate Dixon": { targetFirst: "Kate", targetLast: "Dixon", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Johnson": { targetFirst: "Kendall", targetLast: "Johnson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Meek": { targetFirst: "Kendall", targetLast: "Meek", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kenya Bagwell": { targetFirst: "Kenya", targetLast: "Bagwell", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kerry Minando": { targetFirst: "Kerry", targetLast: "Minando", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kiersten Hacker": { targetFirst: "Kiersten", targetLast: "Hacker", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kristen Forehand": { targetFirst: "Kristen", targetLast: "Forehand", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Leah Mace": { targetFirst: "Leah", targetLast: "Mace", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Makenna Murphy": { targetFirst: "Makenna", targetLast: "Murphy", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Nadia Moore": { targetFirst: "Nadia", targetLast: "Moore", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Patience Pearson": { targetFirst: "Patience", targetLast: "Pearson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sarah Bowen": { targetFirst: "Sarah", targetLast: "Bowen", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sarah Rathbone": { targetFirst: "Sarah", targetLast: "Rathbone", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Savannah Gohr": { targetFirst: "Savannah", targetLast: "Gohr", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Somer Wilson": { targetFirst: "Somer", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Stephanie Norris": { targetFirst: "Stephanie", targetLast: "Norris", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
};

const MCADENVILLE_ORDER = [
  "April McElwaine", "Ashley Mull", "Brianna Cope", "Chloey Bailey",
  "Ciara Petty", "Dayna Simmons", "Emily English", "Hannah Fleming",
  "Jessica Pitts", "Kate Dixon", "Kendall Johnson", "Kendall Meek",
  "Kenya Bagwell", "Kerry Minando", "Kiersten Hacker", "Kristen Forehand",
  "Leah Mace", "Makenna Murphy", "Nadia Moore", "Patience Pearson",
  "Sarah Bowen", "Sarah Rathbone", "Savannah Gohr", "Somer Wilson",
  "Stephanie Norris",
];

// ═══════════════════════════════════════════════════════════════════════════════
// BELMONT STAFF
// ═══════════════════════════════════════════════════════════════════════════════

const BELMONT_STAFF: Record<string, StaffMember> = {
  "Alicia West": { targetFirst: "Alicia", targetLast: "West", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Allana Taylor": { targetFirst: "Allana", targetLast: "Taylor", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "AnnaMae Baranowski": { targetFirst: "AnnaMae", targetLast: "Baranowski", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Ariel Leatherwood": { targetFirst: "Ariel", targetLast: "Leatherwood", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Aubrey Ballenger": { targetFirst: "Aubrey", targetLast: "Ballenger", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Brenda Sanchez": { targetFirst: "Brenda", targetLast: "Sanchez", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Cameryn Stansell": { targetFirst: "Cameryn", targetLast: "Stansell", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Candy Zepeda": { targetFirst: "Candy", targetLast: "Zepeda", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Cecy Sanchez": { targetFirst: "Cecy", targetLast: "Sanchez", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Ellie Flowers": { targetFirst: "Ellie", targetLast: "Flowers", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
  "Emily Herrin": { targetFirst: "Emily", targetLast: "Herrin", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Emily Rinehart": { targetFirst: "Emily", targetLast: "Rinehart", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Erica Coombs": { targetFirst: "Erica", targetLast: "Coombs", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Gabby Brewer": { targetFirst: "Gabby", targetLast: "Brewer", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
  "Grace Lesser": { targetFirst: "Grace", targetLast: "Lesser", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
  "Jennifer Davis": { targetFirst: "Jennifer", targetLast: "Davis", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Jordan Kovacs": { targetFirst: "Jordan", targetLast: "Kovacs", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Julia Arnold": { targetFirst: "Julia", targetLast: "Arnold", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Julie Owen": { targetFirst: "Julie", targetLast: "Owen", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kayla Harris": { targetFirst: "Kayla", targetLast: "Harris", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Hunt": { targetFirst: "Kendall", targetLast: "Hunt", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Johnson": { targetFirst: "Kendall", targetLast: "Johnson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Meek": { targetFirst: "Kendall", targetLast: "Meek", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kristen Forehand": { targetFirst: "Kristen", targetLast: "Forehand", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Lauren Eagle": { targetFirst: "Lauren", targetLast: "Eagle", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Lera Cline": { targetFirst: "Lera", targetLast: "Cline", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Lexy Sides": { targetFirst: "Lexy", targetLast: "Sides", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Lindsey Mackey Price": { targetFirst: "Lindsey", targetLast: "Mackey Price", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Maddie Schultz": { targetFirst: "Maddie", targetLast: "Schultz", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
  "Makenna Murphy": { targetFirst: "Makenna", targetLast: "Murphy", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Mariah Wilson": { targetFirst: "Mariah", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Melissa Petty": { targetFirst: "Melissa", targetLast: "Petty", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Nadia Moore": { targetFirst: "Nadia", targetLast: "Moore", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Nadya Bradshaw": { targetFirst: "Nadya", targetLast: "Bradshaw", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Patience Pearson": { targetFirst: "Patience", targetLast: "Pearson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sam Dancer": { targetFirst: "Sam", targetLast: "Dancer", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sariana Braggs": { targetFirst: "Sariana", targetLast: "Braggs", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Shyanne Dutcher": { targetFirst: "Shyanne", targetLast: "Dutcher", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sierra Hanafin": { targetFirst: "Sierra", targetLast: "Hanafin", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Somer Wilson": { targetFirst: "Somer", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Stacey Rollins": { targetFirst: "Stacey", targetLast: "Rollins", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sydney Key": { targetFirst: "Sydney", targetLast: "Key", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Virginia Hellams": { targetFirst: "Virginia", targetLast: "Hellams", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
};

const BELMONT_ORDER = [
  "Alicia West", "Allana Taylor", "AnnaMae Baranowski", "Ariel Leatherwood",
  "Aubrey Ballenger", "Brenda Sanchez", "Cameryn Stansell", "Candy Zepeda",
  "Cecy Sanchez", "Ellie Flowers", "Emily Herrin", "Emily Rinehart",
  "Erica Coombs", "Gabby Brewer", "Grace Lesser", "Jennifer Davis",
  "Jordan Kovacs", "Julia Arnold", "Julie Owen", "Kayla Harris",
  "Kendall Hunt", "Kendall Johnson", "Kendall Meek", "Kristen Forehand",
  "Lauren Eagle", "Lera Cline", "Lexy Sides", "Lindsey Mackey Price",
  "Maddie Schultz", "Makenna Murphy", "Mariah Wilson", "Melissa Petty",
  "Nadia Moore", "Nadya Bradshaw", "Patience Pearson", "Sam Dancer",
  "Sariana Braggs", "Shyanne Dutcher", "Sierra Hanafin", "Somer Wilson",
  "Stacey Rollins", "Sydney Key", "Virginia Hellams",
];

// ═══════════════════════════════════════════════════════════════════════════════
// THE SPA STAFF
// ═══════════════════════════════════════════════════════════════════════════════

const SPA_STAFF: Record<string, StaffMember> = {
  "AnnaMae Baranowski": { targetFirst: "AnnaMae", targetLast: "Baranowski", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Brittany Wilson": { targetFirst: "Brittany", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kalla Schull": { targetFirst: "Kalla", targetLast: "Schull", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Keleigh Ratliff": { targetFirst: "Keleigh", targetLast: "Ratliff", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kelsey Romero": { targetFirst: "Kelsey", targetLast: "Romero", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Meek": { targetFirst: "Kendall", targetLast: "Meek", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kristen Forehand": { targetFirst: "Kristen", targetLast: "Forehand", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Lindsay Holvig": { targetFirst: "Lindsay", targetLast: "Holvig", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Marco Schlemm": { targetFirst: "Marco", targetLast: "Schlemm", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Marla Walls": { targetFirst: "Marla", targetLast: "Walls", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Marolys Gil": { targetFirst: "Marolys", targetLast: "Gil", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Megan O'Shields": { targetFirst: "Megan", targetLast: "O'Shields", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Michelle Frazier": { targetFirst: "Michelle", targetLast: "Frazier", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Naomi Fretz": { targetFirst: "Naomi", targetLast: "Fretz", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Patience Pearson": { targetFirst: "Patience", targetLast: "Pearson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Peter Koronios": { targetFirst: "Peter", targetLast: "Koronios", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sadi Benford": { targetFirst: "Sadi", targetLast: "Benford", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Sierra Sharpe": { targetFirst: "Sierra", targetLast: "Sharpe", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0, associatePay: null, supervisor: null },
  "Somer Wilson": { targetFirst: "Somer", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Stephanie Gee": { targetFirst: "Stephanie", targetLast: "Gee", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
};

const SPA_ORDER = [
  "AnnaMae Baranowski", "Brittany Wilson", "Kalla Schull", "Keleigh Ratliff",
  "Kelsey Romero", "Kendall Meek", "Kristen Forehand", "Lindsay Holvig",
  "Marco Schlemm", "Marla Walls", "Marolys Gil", "Megan O'Shields",
  "Michelle Frazier", "Naomi Fretz", "Patience Pearson", "Peter Koronios",
  "Sadi Benford", "Sierra Sharpe", "Somer Wilson", "Stephanie Gee",
];

// ═══════════════════════════════════════════════════════════════════════════════
// BALLARDS STAFF
// ═══════════════════════════════════════════════════════════════════════════════

const BALLARDS_STAFF: Record<string, StaffMember> = {
  "Bryan Walls": { targetFirst: "Bryan", targetLast: "Walls", internalId: 2293, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Dustin G Goodson": { targetFirst: "Dustin", targetLast: "Goodson", internalId: 2484, stationLease: -380, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Dustin H Helms": { targetFirst: "Dustin", targetLast: "Helms", internalId: 1536, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Dustin P Prince": { targetFirst: "Dustin", targetLast: "Prince", internalId: 1535, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Edward Trevino": { targetFirst: "Edward", targetLast: "Trevino", internalId: 1537, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Hannah Fleming": { targetFirst: "Hannah", targetLast: "Fleming", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kendall Meek": { targetFirst: "Kendall", targetLast: "Meek", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Kristen Forehand": { targetFirst: "Kristen", targetLast: "Forehand", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Owen Prince": { targetFirst: "Owen", targetLast: "Prince", internalId: 1550, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Patience Pearson": { targetFirst: "Patience", targetLast: "Pearson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Ray Goodson": { targetFirst: "Ray", targetLast: "Goodson", internalId: 1553, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Rob Bumgardner": { targetFirst: "Rob", targetLast: "Bumgardner", internalId: 1531, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
  "Somer Wilson": { targetFirst: "Somer", targetLast: "Wilson", internalId: 0, stationLease: 0, financialServices: 0, phorestFee: 0, refreshment: 0 },
  "Thomas Moore": { targetFirst: "Thomas", targetLast: "Moore", internalId: 2805, stationLease: -320, financialServices: -100, phorestFee: -10, refreshment: -10 },
};

const BALLARDS_ORDER = [
  "Bryan Walls", "Dustin G Goodson", "Dustin H Helms", "Dustin P Prince",
  "Edward Trevino", "Hannah Fleming", "Kendall Meek", "Kristen Forehand",
  "Owen Prince", "Patience Pearson", "Ray Goodson", "Rob Bumgardner",
  "Somer Wilson", "Thomas Moore",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ALL BRANCHES
// ═══════════════════════════════════════════════════════════════════════════════

export const BRANCHES: BranchConfig[] = [
  {
    branchId: "MQxU0-XtU5feIqq2iWBVgw",
    name: "William Henry Salon Mount Holly",
    abbreviation: "WHS MH",
    subsidiaryId: 5,
    account: 111,
    staffConfig: MOUNT_HOLLY_STAFF,
    staffOrder: MOUNT_HOLLY_ORDER,
    employeePurchaseNameMap: {
      "Olivia Cornette": "Olivia Wilson",
      "Maddie Shultz": "Maddie Schultz",
    },
  },
  {
    branchId: "8M4TophXdPSUruaequULaw",
    name: "William Henry Salon McAdenville",
    abbreviation: "WHS MCAD",
    subsidiaryId: 5,
    account: 111,
    staffConfig: MCADENVILLE_STAFF,
    staffOrder: MCADENVILLE_ORDER,
    employeePurchaseNameMap: {},
  },
  {
    branchId: "5xgjrXAIiFwmt0XheOoHng",
    name: "William Henry Signature Salon Belmont",
    abbreviation: "WHS BEL",
    subsidiaryId: 5,
    account: 111,
    staffConfig: BELMONT_STAFF,
    staffOrder: BELMONT_ORDER,
    employeePurchaseNameMap: {},
  },
  {
    branchId: "Sil3zmgt4KE4RYWqWnx-hQ",
    name: "William Henry The Spa",
    abbreviation: "WHS SPA",
    subsidiaryId: 5,
    account: 111,
    staffConfig: SPA_STAFF,
    staffOrder: SPA_ORDER,
    employeePurchaseNameMap: {},
  },
  {
    branchId: "yrr4_ACmrRVr0J3NoC2s2Q",
    name: "Ballards Barbershop",
    abbreviation: "BALLARDS",
    subsidiaryId: 7,
    account: 111,
    staffConfig: BALLARDS_STAFF,
    staffOrder: BALLARDS_ORDER,
    employeePurchaseNameMap: {},
  },
];

export function getBranchConfig(branchId: string): BranchConfig | undefined {
  return BRANCHES.find((b) => b.branchId === branchId);
}

export function isBranchConfigured(branchId: string): boolean {
  const branch = getBranchConfig(branchId);
  return !!branch && Object.keys(branch.staffConfig).length > 0;
}

/** Convert branch name to URL-safe slug for storage paths */
export function branchSlug(branchId: string): string {
  const branch = getBranchConfig(branchId);
  if (!branch) return branchId;
  return branch.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
