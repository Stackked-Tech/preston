/**
 * Standalone script for GitHub Actions — fetches Phorest Looker "Paid to Salon" tips
 * and writes them to Supabase. Runs outside of Next.js/Vercel.
 *
 * Usage: node fetch-looker-tips.mjs <branchId> <startDate> <endDate>
 *
 * Required env vars:
 *   PHOREST_USER_EMAIL, PHOREST_USER_PASSWORD, PHOREST_BUSINESS_ID_INTERNAL
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

// ── Branch metadata (mirrors phorestLookerClient.ts) ──
const BRANCH_META = {
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

const LOOKER_DASHBOARD_ID = "prod_us_reporting_rds::staff_tips_multisite";
const LOOKER_RESULT_MAKER_ID = "159764";
const LOOKER_BASE = "https://looker.phorest.com";

// ── Main ──

const [branchId, startDate, endDate] = process.argv.slice(2);
if (!branchId || !startDate || !endDate) {
  console.error("Usage: node fetch-looker-tips.mjs <branchId> <startDate> <endDate>");
  process.exit(1);
}

const meta = BRANCH_META[branchId];
if (!meta) {
  console.error(`Unknown branchId: ${branchId}`);
  process.exit(1);
}

const { PHOREST_USER_EMAIL, PHOREST_USER_PASSWORD, PHOREST_BUSINESS_ID_INTERNAL, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!PHOREST_USER_EMAIL || !PHOREST_USER_PASSWORD || !PHOREST_BUSINESS_ID_INTERNAL) {
  console.error("Missing PHOREST_USER_EMAIL, PHOREST_USER_PASSWORD, or PHOREST_BUSINESS_ID_INTERNAL");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

try {
  console.log(`Fetching tips for ${meta.multilinkName} (${startDate} to ${endDate})...`);

  // Step 1: OAuth
  console.log("  Step 1: OAuth token...");
  const tokenRes = await fetch("https://api-gateway-us.phorest.com/auth/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "basic",
      client_type: "user",
      username: PHOREST_USER_EMAIL,
      password: PHOREST_USER_PASSWORD,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) throw new Error(`OAuth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // Step 2: Looker SSO signed URL
  console.log("  Step 2: Looker SSO URL...");
  const ssoRes = await fetch("https://api-gateway-us.phorest.com/looker-sso", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({
      businessId: PHOREST_BUSINESS_ID_INTERNAL,
      businessName: "William Henry",
      businessLocale: "en-US",
      businessBranchCardinality: "multiple",
      branchId,
      branchName: meta.multilinkName,
      branchMultilinkName: meta.multilinkName,
      branchEmail: meta.email,
      branchTimeZone: meta.timezone,
      dashboardId: LOOKER_DASHBOARD_ID,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!ssoRes.ok) throw new Error(`SSO failed: ${ssoRes.status}`);
  const { url: signedUrl } = await ssoRes.json();

  // Step 3: Establish Looker session (follow redirects, collect cookies)
  console.log("  Step 3: Establishing Looker session...");
  const cookies = {};
  let currentUrl = signedUrl;
  for (let i = 0; i < 10; i++) {
    const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: cookieStr ? { Cookie: cookieStr } : {},
      signal: AbortSignal.timeout(20_000),
    });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const sc of setCookies) {
      const parts = sc.split(";")[0].split("=");
      if (parts.length >= 2 && parts[1]) {
        cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
      }
    }
    const location = res.headers.get("location");
    if (location && [301, 302, 303].includes(res.status)) {
      currentUrl = location.startsWith("/") ? `${LOOKER_BASE}${location}` : location;
      continue;
    }
    break;
  }
  const csrfToken = cookies["CSRF-TOKEN"];
  if (!csrfToken) throw new Error("No CSRF-TOKEN cookie");

  // Step 4: Submit query
  console.log("  Step 4: Submitting query...");
  const endPlusOne = nextDay(endDate);
  const dateRange = `${startDate.replace(/-/g, "/")} to ${endPlusOne.replace(/-/g, "/")}`;
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

  const queryRes = await fetch(`${LOOKER_BASE}/api/internal/querymanager/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieStr,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify({
      plain_queries: [],
      saved_queries: [{
        element_id: "a5d9a823df76eac7fe98550738cdd4cc",
        filters: [{
          "purchase.purchase_date": dateRange,
          "staff.staff_name": "",
          "branch.multilink_name": `"${meta.multilinkName}"`,
        }],
        generate_links: false,
        path_prefix: "/explore",
        server_table_calcs: false,
        source: "dashboard",
        sorts: ["staff.staff_name"],
        query_timezone: "user_timezone",
        result_maker_id: LOOKER_RESULT_MAKER_ID,
      }],
      context: { id: LOOKER_DASHBOARD_ID, type: "dashboard" },
      options: { force_run: false, streaming: true, eager_poll: false },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!queryRes.ok) throw new Error(`Query submit failed: ${queryRes.status}`);
  const queryText = await queryRes.text();
  const queryObj = parseFirstJsonObject(queryText);
  if (!queryObj?.id) throw new Error("No query ID in response");
  const queryId = queryObj.id;

  // Step 5: Poll for results
  console.log("  Step 5: Polling for results...");
  const tips = new Map();
  const maxWaitMs = 60_000;
  const start = Date.now();
  let delay = 1000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);

    const pollRes = await fetch(
      `${LOOKER_BASE}/api/internal/querymanager/queries?ids%5B%5D=${queryId}&streaming=true`,
      {
        headers: { Cookie: cookieStr, "x-csrf-token": csrfToken },
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!pollRes.ok) continue;

    const text = await pollRes.text();
    const objects = parseAllJsonObjects(text);

    for (const obj of objects) {
      if (obj.status === "complete" && obj.data?.data) {
        const rows = obj.data.data;
        // Debug: show column keys and sample row
        if (rows.length > 0) {
          console.log(`  Columns: ${Object.keys(rows[0]).join(", ")}`);
          console.log(`  Sample row: ${JSON.stringify(rows[0])}`);
        }
        for (const row of rows) {
          const name = row["staff.staff_name"]?.value;
          const paidToSalon = row["purchase_tip_cdc.paid_to_salon"]?.value || 0;
          if (name && paidToSalon > 0) {
            tips.set(name, paidToSalon);
          }
        }
        console.log(`  Found ${tips.size} staff with tips from ${rows.length} rows`);

        // Step 6: Write to Supabase
        console.log("  Step 6: Writing to Supabase...");
        // Upsert: delete existing rows for this branch+period, then insert fresh
        await supabase
          .from("ps_looker_tips")
          .delete()
          .eq("branch_id", branchId)
          .eq("start_date", startDate)
          .eq("end_date", endDate);

        if (tips.size > 0) {
          const rows = [...tips.entries()].map(([staffName, amount]) => ({
            branch_id: branchId,
            start_date: startDate,
            end_date: endDate,
            staff_name: staffName,
            paid_to_salon: Math.round(amount * 100) / 100,
            fetched_at: new Date().toISOString(),
          }));
          const { error } = await supabase.from("ps_looker_tips").insert(rows);
          if (error) throw new Error(`Supabase insert failed: ${error.message}`);
        }

        console.log(`Done! ${tips.size} tip records saved.`);
        for (const [name, amount] of tips) {
          console.log(`  ${name}: $${amount}`);
        }
        process.exit(0);
      }
    }
  }

  throw new Error(`Query timed out after ${maxWaitMs / 1000}s`);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

// ── Helpers ──

function nextDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function parseFirstJsonObject(text) {
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    if (text[i] === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.substring(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

function parseAllJsonObjects(text) {
  const objects = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") { if (depth === 0) start = i; depth++; }
    if (text[i] === "}") { depth--; if (depth === 0) { try { objects.push(JSON.parse(text.substring(start, i + 1))); } catch {} } }
  }
  return objects;
}
