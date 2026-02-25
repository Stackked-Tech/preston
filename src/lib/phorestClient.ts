import type {
  PhorestBranch,
  PhorestStaff,
  PhorestAppointment,
  PhorestClient,
  PhorestPageMetadata,
} from "@/types/phorest";

const API_URL = process.env.PHOREST_API_URL;
const BUSINESS_ID = process.env.PHOREST_BUSINESS_ID;
const USERNAME = process.env.PHOREST_USERNAME;
const PASSWORD = process.env.PHOREST_PASSWORD;

function assertConfigured(): void {
  if (!API_URL || !BUSINESS_ID || !USERNAME || !PASSWORD) {
    throw new Error(
      "Phorest API credentials not configured. Set PHOREST_API_URL, PHOREST_BUSINESS_ID, PHOREST_USERNAME, and PHOREST_PASSWORD environment variables."
    );
  }
}

function getAuthHeader(): string {
  assertConfigured();
  return "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
}

function getBaseUrl(): string {
  assertConfigured();
  return `${API_URL}/api/business/${BUSINESS_ID}`;
}

async function phorestFetch(path: string): Promise<Response> {
  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Phorest API error ${res.status}: ${body}`);
  }
  return res;
}

// Generic paginated fetch — collects all pages into a single array
async function fetchAllPages<T>(
  path: string,
  embeddedKey: string
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const separator = path.includes("?") ? "&" : "?";
    const res = await phorestFetch(`${path}${separator}page=${page}&size=100`);
    const data = await res.json();

    const items = data._embedded?.[embeddedKey] ?? [];
    allItems.push(...items);

    const pageMeta: PhorestPageMetadata = data.page;
    totalPages = pageMeta.totalPages;
    page++;
  }

  return allItems;
}

export async function fetchBranches(): Promise<PhorestBranch[]> {
  return fetchAllPages<PhorestBranch>("/branch", "branches");
}

export async function fetchStaff(branchId: string): Promise<PhorestStaff[]> {
  return fetchAllPages<PhorestStaff>(
    `/branch/${branchId}/staff`,
    "staffs"
  );
}

export async function fetchAppointments(
  branchId: string,
  fromDate: string,
  toDate: string
): Promise<PhorestAppointment[]> {
  // Phorest limits appointment queries to 1-month range
  // Split into monthly chunks if needed
  const chunks = splitIntoMonthlyRanges(fromDate, toDate);
  const allAppointments: PhorestAppointment[] = [];

  for (const chunk of chunks) {
    const appointments = await fetchAllPages<PhorestAppointment>(
      `/branch/${branchId}/appointment?from_date=${chunk.from}&to_date=${chunk.to}`,
      "appointments"
    );
    allAppointments.push(...appointments);
  }

  return allAppointments;
}

export async function fetchClientsBatch(
  clientIds: string[]
): Promise<PhorestClient[]> {
  if (clientIds.length === 0) return [];

  const allClients: PhorestClient[] = [];

  // client-batch supports max 100 IDs per call
  for (let i = 0; i < clientIds.length; i += 100) {
    const batch = clientIds.slice(i, i + 100);
    const params = batch.map((id) => `client_id=${id}`).join("&");
    const res = await phorestFetch(`/client-batch?${params}`);
    const data = await res.json();
    const clients = data._embedded?.clients ?? [];
    allClients.push(...clients);
  }

  return allClients;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT JOB (for Payout Suite payroll processing)
// ═══════════════════════════════════════════════════════════════════════════════

interface CsvExportJob {
  jobId: string;
  jobStatus: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  totalRows?: number;
  succeededRows?: number;
  failureReason?: string;
  tempCsvExternalUrl?: string;
}

async function phorestPost(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Phorest API error ${res.status}: ${text}`);
  }
  return res;
}

/**
 * Create a CSV export job for a branch's transactions.
 */
export async function createCsvExportJob(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<CsvExportJob> {
  const res = await phorestPost(
    `/branch/${branchId}/csvexportjob`,
    {
      startFilter: startDate,
      finishFilter: endDate,
      jobType: "TRANSACTIONS_CSV",
    }
  );
  return res.json();
}

/**
 * Poll a CSV export job until it completes or times out.
 */
export async function pollCsvExportJob(
  branchId: string,
  jobId: string,
  maxWaitMs = 600_000,
  intervalMs = 5_000
): Promise<CsvExportJob> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await phorestFetch(
      `/branch/${branchId}/csvexportjob/${jobId}`
    );
    const job: CsvExportJob = await res.json();
    if (job.jobStatus === "DONE" || job.jobStatus === "FAILED") {
      return job;
    }
  }
  throw new Error(`CSV export job timed out after ${maxWaitMs / 1000}s`);
}

/**
 * Download CSV content from a presigned URL.
 */
export async function downloadCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download CSV: ${res.status}`);
  }
  return res.text();
}

// Helper: split a date range into 1-month chunks for Phorest's appointment API
function splitIntoMonthlyRanges(
  fromDate: string,
  toDate: string
): Array<{ from: string; to: string }> {
  const ranges: Array<{ from: string; to: string }> = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);

  let current = new Date(start);

  while (current <= end) {
    const chunkEnd = new Date(current);
    chunkEnd.setMonth(chunkEnd.getMonth() + 1);
    chunkEnd.setDate(chunkEnd.getDate() - 1);

    const actualEnd = chunkEnd > end ? end : chunkEnd;

    ranges.push({
      from: current.toISOString().split("T")[0],
      to: actualEnd.toISOString().split("T")[0],
    });

    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return ranges;
}
