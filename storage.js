/* storage.js — Paperera data layer
   Primary:  localStorage (works in any browser, no setup)
   Optional: Supabase (admin enables in Settings → Supabase card)
   Keys:
     paperera_config  → prices, UPI, QR image, Supabase credentials
     paperera_orders  → all form submissions & payment requests
*/

const DEFAULT_CONFIG = {
  domainPrices: {
    com:   999,
    in:    599,
    org:   799,
    edu:   899,
    "co.in": 649
  },
  paperGen: { pricePerBundle: 500, papersMin: 50, papersMax: 60 },
  monthlyRate: 500,          // flat monthly fee for all services combined
  services: [
    { key: "notice",       label: "Notice upload"          },
    { key: "event",        label: "Event page update"       },
    { key: "contact",      label: "Contact details change"  },
    { key: "formbuilding", label: "New form building"       },
    { key: "gallery",      label: "Gallery update"          },
    { key: "siteinfo",     label: "Site info change"        },
    { key: "inquiry",      label: "Inquiry desk handling"   },
    { key: "admission",    label: "Admission-apply setup"   }
  ],
  upiId:      "",
  payeeName:  "Paperera",
  qrImage:    "",
  supabase: { url: "", key: "" }
};

/* ── localStorage helpers ── */
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); return true; }
  catch { return false; }
}

/* ── Supabase helpers ── */
async function sbGet(cfg, table, col) {
  const res = await fetch(
    `${cfg.url}/rest/v1/${table}?key=eq.${col}&select=value`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? rows[0].value : null;
}

async function sbUpsert(cfg, table, key, value) {
  const res = await fetch(
    `${cfg.url}/rest/v1/${table}`,
    {
      method: "POST",
      headers: {
        apikey:           cfg.key,
        Authorization:    `Bearer ${cfg.key}`,
        "Content-Type":   "application/json",
        Prefer:           "resolution=merge-duplicates"
      },
      body: JSON.stringify({ key, value })
    }
  );
  return res.ok;
}

async function sbGetOrders(cfg) {
  const res = await fetch(
    `${cfg.url}/rest/v1/paperera_orders?select=*&order=timestamp.desc`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

async function sbInsertOrder(cfg, order) {
  const res = await fetch(
    `${cfg.url}/rest/v1/paperera_orders`,
    {
      method: "POST",
      headers: {
        apikey:         cfg.key,
        Authorization:  `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer:         "return=representation"
      },
      body: JSON.stringify(order)
    }
  );
  return res.ok;
}

async function sbPatchOrder(cfg, id, patch) {
  const res = await fetch(
    `${cfg.url}/rest/v1/paperera_orders?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey:         cfg.key,
        Authorization:  `Bearer ${cfg.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    }
  );
  return res.ok;
}

function hasSupa(cfg) {
  return !!(cfg && cfg.supabase && cfg.supabase.url && cfg.supabase.key);
}

/* ── Public API ── */
async function loadConfig() {
  const raw = lsGet("paperera_config");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // merge in any missing keys from DEFAULT_CONFIG
      return { ...DEFAULT_CONFIG, ...parsed,
        supabase: { ...DEFAULT_CONFIG.supabase, ...(parsed.supabase || {}) }
      };
    } catch { /* fall through */ }
  }
  lsSet("paperera_config", JSON.stringify(DEFAULT_CONFIG));
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

async function saveConfig(cfg) {
  return lsSet("paperera_config", JSON.stringify(cfg));
}

async function loadOrders() {
  // Try Supabase first
  const cfg = await loadConfig();
  if (hasSupa(cfg)) {
    try {
      const rows = await sbGetOrders(cfg.supabase);
      if (rows) return rows;
    } catch { /* fall back to localStorage */ }
  }
  const raw = lsGet("paperera_orders");
  try { return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

async function saveOrders(list) {
  return lsSet("paperera_orders", JSON.stringify(list));
}

function newId() {
  return "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

async function addOrder(order) {
  order.id        = newId();
  order.timestamp = new Date().toISOString();
  if (!order.status) order.status = "new";

  // Always write to localStorage
  const list = await loadOrders();
  list.push(order);
  lsSet("paperera_orders", JSON.stringify(list));

  // Also push to Supabase if configured
  const cfg = await loadConfig();
  if (hasSupa(cfg)) {
    try { await sbInsertOrder(cfg.supabase, order); } catch { /* non-fatal */ }
  }
  return order;
}

async function updateOrder(id, patch) {
  const list = await loadOrders();
  const idx  = list.findIndex(o => o.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  lsSet("paperera_orders", JSON.stringify(list));

  // Patch in Supabase too
  const cfg = await loadConfig();
  if (hasSupa(cfg)) {
    try { await sbPatchOrder(cfg.supabase, id, patch); } catch { /* non-fatal */ }
  }
  return list[idx];
}

async function deleteOrder(id) {
  const list = await loadOrders();
  const filtered = list.filter(o => o.id !== id);
  lsSet("paperera_orders", JSON.stringify(filtered));
  return true;
}

async function deleteOrders(ids) {
  const idSet = new Set(ids);
  const list = await loadOrders();
  const filtered = list.filter(o => !idSet.has(o.id));
  lsSet("paperera_orders", JSON.stringify(filtered));
  return true;
}

/* Test Supabase connection — returns { ok, msg } */
async function testSupabase(url, key) {
  if (!url || !key) return { ok: false, msg: "URL and key are required." };
  try {
    const res = await fetch(`${url}/rest/v1/paperera_kv?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (res.ok || res.status === 406) {
      return { ok: true, msg: "Connected to Supabase ✓" };
    }
    return { ok: false, msg: `HTTP ${res.status} — check URL and key.` };
  } catch (e) {
    return { ok: false, msg: "Network error: " + e.message };
  }
}

/* Shared money formatter */
function money(n) {
  const num = Number(n) || 0;
  return "\u20B9" + num.toLocaleString("en-IN");
}
