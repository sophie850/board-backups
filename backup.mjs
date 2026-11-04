// Nightly backup of BOARD proposals, the opportunity catalogue, and every file they point to.
// Run by .github/workflows/backup.yml. Needs Node 20+ (built-in fetch).
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
if (!SUPABASE_URL || !KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY secret");

const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const today = new Date().toISOString().slice(0, 10);
const MAX_FILE = 90 * 1024 * 1024; // GitHub rejects files over 100 MB

const save = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const getJson = async (path) => {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: H });
  if (!r.ok) throw new Error(path + " -> " + r.status + " " + (await r.text()));
  return r.json();
};

const proposals = await getJson("proposals?select=id,data,updated_at&order=id");
const catalogue = await getJson("catalogue?select=id,data");
if (!Array.isArray(proposals) || proposals.length === 0) throw new Error("No proposals returned, refusing to overwrite backup with an empty one");

const pretty = (o) => JSON.stringify(o, null, 2);
await save(join("snapshots", today, "proposals.json"), pretty(proposals));
await save(join("snapshots", today, "catalogue.json"), pretty(catalogue));
await save(join("latest", "proposals.json"), pretty(proposals));
await save(join("latest", "catalogue.json"), pretty(catalogue));

// Collect every file a proposal references: logos, videos, custom package photos.
// Photos embedded directly in a proposal (data:...) are already inside proposals.json, so skip them.
const urls = new Set();
const add = (u) => { if (typeof u === "string" && u.trim() && !u.startsWith("data:")) urls.add(u.trim()); };
for (const p of proposals) {
  const d = p.data || {};
  add(d.logoUrl); add(d.logoUrlOriginal); add(d.videoUrl);
  for (const it of (d.package && d.package.items) || []) add(it.image);
}
const cat = catalogue[0] && catalogue[0].data;
for (const o of (Array.isArray(cat) ? cat : (cat && cat.items) || [])) add(o && o.image);

let saved = 0, kept = 0; const failed = [];
for (const u of urls) {
  const full = /^https?:\/\//.test(u) ? u : (SITE_URL ? SITE_URL + "/" + u.replace(/^\.?\//, "") : null);
  if (!full) continue;
  const name = decodeURIComponent(new URL(full).pathname.split("/").filter(Boolean).slice(-2).join("__"));
  const out = join("files", name);
  if (await exists(out)) { kept++; continue; }
  try {
    const r = await fetch(full);
    if (!r.ok) { failed.push(r.status + " " + full); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_FILE) { failed.push("too large (" + Math.round(buf.length / 1e6) + " MB) " + full); continue; }
    await save(out, buf); saved++;
  } catch (e) { failed.push(e.message + " " + full); }
}

const summary = `Backup ${new Date().toISOString()}\nProposals: ${proposals.length}\nFiles: ${saved} new, ${kept} already backed up, ${failed.length} failed\n` + (failed.length ? "\nFailed:\n" + failed.join("\n") + "\n" : "");
await save("LAST_BACKUP.txt", summary);
console.log(summary);
