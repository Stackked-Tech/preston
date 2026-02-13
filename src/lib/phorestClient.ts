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

function getAuthHeader(): string {
  return "Basic " + Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");
}

function getBaseUrl(): string {
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
    `/branch/${branchId}/staff?fetch_archived=true`,
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
