/**
 * Delete all non-production Vercel deployments for this project.
 *
 * Usage:
 *   node scripts/delete-old-deployments.mjs
 *
 * Required env vars (or edit the constants below):
 *   VERCEL_TOKEN   — your personal Vercel API token
 *                    (vercel.com/account/tokens → Create Token)
 *   VERCEL_PROJECT — your project name or project ID
 *   VERCEL_TEAM    — (optional) your team slug, if the project is under a team
 */

const TOKEN   = process.env.VERCEL_TOKEN   || "";
const PROJECT = process.env.VERCEL_PROJECT || "profiler";   // ← change if needed
const TEAM    = process.env.VERCEL_TEAM    || "";           // leave blank for personal

if (!TOKEN) {
  console.error("❌  Set VERCEL_TOKEN before running this script.");
  console.error("    Get one at: https://vercel.com/account/tokens");
  process.exit(1);
}

const BASE = "https://api.vercel.com";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const teamParam = TEAM ? `&teamId=${TEAM}` : "";

// ── 1. Resolve project ID ──────────────────────────────────────────────────
async function getProjectId() {
  const res = await fetch(`${BASE}/v9/projects/${PROJECT}?${teamParam}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not find project "${PROJECT}": ${err.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

// ── 2. Fetch all deployments (paginated) ───────────────────────────────────
async function getAllDeployments(projectId) {
  const deployments = [];
  let until = undefined;

  while (true) {
    const cursor = until ? `&until=${until}` : "";
    const url = `${BASE}/v6/deployments?projectId=${projectId}&limit=100${cursor}${teamParam}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Failed to list deployments: ${res.statusText}`);
    const data = await res.json();
    deployments.push(...data.deployments);
    if (!data.pagination?.next) break;
    until = data.pagination.next;
  }

  return deployments;
}

// ── 3. Delete one deployment ───────────────────────────────────────────────
async function deleteDeployment(id) {
  const res = await fetch(`${BASE}/v13/deployments/${id}?${teamParam}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

// ── Main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`🔍  Looking up project "${PROJECT}"…`);
  const projectId = await getProjectId();
  console.log(`    Project ID: ${projectId}`);

  console.log("📋  Fetching deployments…");
  const all = await getAllDeployments(projectId);
  console.log(`    Found ${all.length} total deployment(s).`);

  // Keep the current production deployment alive
  const toDelete = all.filter((d) => d.target !== "production" || d.state !== "READY");
  const production = all.filter((d) => d.target === "production" && d.state === "READY");

  if (production.length > 0) {
    console.log(`✅  Keeping production deployment: ${production[0].url}`);
  }

  if (toDelete.length === 0) {
    console.log("🎉  Nothing to delete.");
    return;
  }

  console.log(`🗑️   Deleting ${toDelete.length} old deployment(s)…\n`);

  let deleted = 0;
  let failed = 0;

  for (const d of toDelete) {
    const label = `${d.url ?? d.id}  (${d.state}, ${new Date(d.createdAt).toLocaleDateString()})`;
    const ok = await deleteDeployment(d.id);
    if (ok) {
      console.log(`  ✓  ${label}`);
      deleted++;
    } else {
      console.log(`  ✗  ${label}  ← could not delete`);
      failed++;
    }
  }

  console.log(`\nDone. ${deleted} deleted, ${failed} failed.`);
})();
