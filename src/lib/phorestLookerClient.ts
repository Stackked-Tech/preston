/**
 * Phorest Looker Client — Fetches "Paid to Salon" tips from Phorest's Staff Tips report.
 *
 * Flow: OAuth token → Looker SSO signed URL → follow redirects (collect cookies) →
 *       submit saved query → poll for results → parse staff tips.
 *
 * Falls back gracefully if any step fails (caller catches and uses GC-based tips).
 */

// Branch metadata for Looker SSO (rarely changes, only 5 branches)
const BRANCH_META: Record<
  string,
  { multilinkName: string; email: string; timezone: string }
> = {
  "yrr4_ACmrRVr0J3NoC2s2Q": {
    multilinkName: "Ballards Barbershop",
    email: "info@williamhenrysalon.com",
    timezone: "America/New_York",
  },
  "MQxU0-XtU5feIqq2iWBVgw": {
    multilinkName: "William Henry Salon Mount Holly",
    email: "info@williamhenrysalon.com",
    timezone: "America/New_York",
  },
  "8M4TophXdPSUruaequULaw": {
    multilinkName: "William Henry Salon McAdenville",
    email: "info@williamhenrysalon.com",
    timezone: "America/New_York",
  },
  "5xgjrXAIiFwmt0XheOoHng": {
    multilinkName: "William Henry Signature Salon Belmont",
    email: "info@williamhenrysalon.com",
    timezone: "America/New_York",
  },
  "Sil3zmgt4KE4RYWqWnx-hQ": {
    multilinkName: "William Henry The Spa",
    email: "info@williamhenrysalon.com",
    timezone: "America/New_York",
  },
};

const LOOKER_DASHBOARD_ID =
  "prod_us_reporting_rds::staff_tips_multisite";
const LOOKER_OVERVIEW_RESULT_MAKER_ID = "159764";
const LOOKER_BASE = "https://looker.phorest.com";

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch "Paid to Salon" tip amounts per staff from Phorest's Looker Staff Tips report.
 * Returns a Map of Looker staff name (may include middle initials) → paidToSalon amount.
 * Retries up to 2 times on timeout/transient failures before throwing.
 */
export async function fetchStaffTips(params: {
  branchId: string;
  branchName: string;
  startDate: string;
  endDate: string;
}): Promise<Map<string, number>> {
  const MAX_ATTEMPTS = 2;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchStaffTipsOnce(params);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout =
        lastError.name === "TimeoutError" ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("aborted");
      if (!isTimeout || attempt === MAX_ATTEMPTS) break;
      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  throw lastError!;
}

async function fetchStaffTipsOnce(params: {
  branchId: string;
  branchName: string;
  startDate: string;
  endDate: string;
}): Promise<Map<string, number>> {
  const meta = BRANCH_META[params.branchId];
  if (!meta) {
    throw new Error(
      `No Looker branch metadata for branch ${params.branchId}`
    );
  }

  const email = process.env.PHOREST_USER_EMAIL;
  const password = process.env.PHOREST_USER_PASSWORD;
  const businessId = process.env.PHOREST_BUSINESS_ID_INTERNAL;

  if (!email || !password || !businessId) {
    throw new Error(
      "Missing PHOREST_USER_EMAIL, PHOREST_USER_PASSWORD, or PHOREST_BUSINESS_ID_INTERNAL"
    );
  }

  // Step 1: OAuth token
  const accessToken = await getOAuthToken(email, password);

  // Step 2: Looker SSO signed URL
  const signedUrl = await getLookerSignedUrl(accessToken, {
    businessId,
    branchId: params.branchId,
    branchName: params.branchName,
    multilinkName: meta.multilinkName,
    email: meta.email,
    timezone: meta.timezone,
  });

  // Step 3: Establish Looker session (follow redirects, collect cookies)
  const session = await establishLookerSession(signedUrl);

  // Step 4: Submit query
  // Looker date filter uses exclusive end: "YYYY/MM/DD to YYYY/MM/DD"
  // where the end date is the day AFTER the period end
  const endPlusOne = nextDay(params.endDate);
  const dateRange = `${params.startDate.replace(/-/g, "/")} to ${endPlusOne.replace(/-/g, "/")}`;
  const queryId = await submitTipsQuery(
    session,
    meta.multilinkName,
    dateRange
  );

  // Step 5: Poll for results
  const results = await pollQueryResult(session, queryId);

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL
// ═══════════════════════════════════════════════════════════════════════════════

interface LookerSession {
  cookies: Record<string, string>;
  csrfToken: string;
}

async function getOAuthToken(
  email: string,
  password: string
): Promise<string> {
  const res = await fetch(
    "https://api-gateway-us.phorest.com/auth/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "basic",
        client_type: "user",
        username: email,
        password,
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Phorest OAuth failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("No access_token in OAuth response");
  }
  return data.access_token;
}

async function getLookerSignedUrl(
  accessToken: string,
  params: {
    businessId: string;
    branchId: string;
    branchName: string;
    multilinkName: string;
    email: string;
    timezone: string;
  }
): Promise<string> {
  const res = await fetch(
    "https://api-gateway-us.phorest.com/looker-sso",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        businessId: params.businessId,
        businessName: "William Henry",
        businessLocale: "en-US",
        businessBranchCardinality: "multiple",
        branchId: params.branchId,
        branchName: params.branchName,
        branchMultilinkName: params.multilinkName,
        branchEmail: params.email,
        branchTimeZone: params.timezone,
        dashboardId: LOOKER_DASHBOARD_ID,
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Looker SSO request failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.url) {
    throw new Error("No URL in Looker SSO response");
  }
  return data.url;
}

async function establishLookerSession(
  signedUrl: string
): Promise<LookerSession> {
  const cookies: Record<string, string> = {};

  async function followRedirects(url: string, maxRedirects = 10) {
    for (let i = 0; i < maxRedirects; i++) {
      const cookieStr = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      const res = await fetch(url, {
        redirect: "manual",
        headers: cookieStr ? { Cookie: cookieStr } : {},
        signal: AbortSignal.timeout(20_000),
      });

      // Collect cookies
      const setCookies = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : [];
      for (const sc of setCookies) {
        const parts = sc.split(";")[0].split("=");
        if (parts.length >= 2 && parts[1]) {
          cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
        }
      }

      const location = res.headers.get("location");
      if (
        location &&
        (res.status === 301 || res.status === 302 || res.status === 303)
      ) {
        url = location.startsWith("/")
          ? `${LOOKER_BASE}${location}`
          : location;
        continue;
      }
      break;
    }
  }

  await followRedirects(signedUrl);

  const csrfToken = cookies["CSRF-TOKEN"];
  if (!csrfToken) {
    throw new Error("No CSRF-TOKEN cookie after Looker SSO login");
  }

  return { cookies, csrfToken };
}

async function submitTipsQuery(
  session: LookerSession,
  branchMultilinkName: string,
  dateRange: string
): Promise<string> {
  const cookieStr = Object.entries(session.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch(
    `${LOOKER_BASE}/api/internal/querymanager/queries`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieStr,
        "x-csrf-token": session.csrfToken,
      },
      body: JSON.stringify({
        plain_queries: [],
        saved_queries: [
          {
            element_id: "a5d9a823df76eac7fe98550738cdd4cc",
            filters: [
              {
                "purchase.purchase_date": dateRange,
                "staff.staff_name": "",
                "branch.multilink_name": `"${branchMultilinkName}"`,
              },
            ],
            generate_links: false,
            path_prefix: "/explore",
            server_table_calcs: false,
            source: "dashboard",
            sorts: ["staff.staff_name"],
            query_timezone: "user_timezone",
            result_maker_id: LOOKER_OVERVIEW_RESULT_MAKER_ID,
          },
        ],
        context: {
          id: LOOKER_DASHBOARD_ID,
          type: "dashboard",
        },
        options: {
          force_run: false,
          streaming: true,
          eager_poll: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Looker query submit failed: ${res.status} — ${body.substring(0, 200)}`
    );
  }

  const text = await res.text();
  // Response may contain multiple concatenated JSON objects
  const firstObj = parseFirstJsonObject(text);
  if (!firstObj?.id) {
    throw new Error("No query ID in Looker submit response");
  }
  return firstObj.id;
}

async function pollQueryResult(
  session: LookerSession,
  queryId: string,
  maxWaitMs = 90_000
): Promise<Map<string, number>> {
  const cookieStr = Object.entries(session.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const start = Date.now();
  let delay = 1000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);

    const res = await fetch(
      `${LOOKER_BASE}/api/internal/querymanager/queries?ids%5B%5D=${queryId}&streaming=true`,
      {
        headers: {
          Cookie: cookieStr,
          "x-csrf-token": session.csrfToken,
        },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) continue;

    const text = await res.text();
    const objects = parseAllJsonObjects(text);

    for (const obj of objects) {
      if (obj.status === "complete" && obj.data?.data) {
        const results = new Map<string, number>();
        for (const row of obj.data.data) {
          const name = row["staff.staff_name"]?.value;
          const paidToSalon =
            row["purchase_tip_cdc.paid_to_salon"]?.value || 0;
          if (name && paidToSalon > 0) {
            results.set(name, paidToSalon);
          }
        }
        return results;
      }
    }
  }

  throw new Error(`Looker tips query timed out after ${maxWaitMs / 1000}s`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFirstJsonObject(text: string): any {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    }
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAllJsonObjects(text: string): any[] {
  const objects = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    }
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          objects.push(JSON.parse(text.substring(start, i + 1)));
        } catch {
          // skip malformed
        }
      }
    }
  }
  return objects;
}
