/* storage.js — Paperera Supabase & Local Data Layer */

const DEFAULT_CONFIG = {
  domainPrices: {
    com: 999,
    in: 599,
    org: 799,
    edu: 899,
    "co.in": 649
  },
  paperGen: { pricePerBundle: 500, papersMin: 50, papersMax: 60 },
  monthlyRate: 500, // Flat monthly rate for all site maintenance
  services: [
    { key: "notice", label: "Notice upload" },
    { key: "event", label: "Event page update" },
    { key: "contact", label: "Contact details change" },
    { key: "formbuilding", label: "New form building" },
    { key: "gallery", label: "Gallery update" },
    { key: "siteinfo", label: "Site info change" },
    { key: "inquiry", label: "Inquiry desk handling" },
    { key: "admission", label: "Admission-apply setup" }
  ],
  upiId: "",
  payeeName: "Paperera",
  qrImage: "",
  supabase: {
    url: "https://itpsqbwkjhmygrnngiil.supabase.co",
    key: "sb_publishable_SqqK8Gp24MT35SM13J72Gg_utiRV3-i"
  }
};

/* ─── LocalStorage Helpers ─── */
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { return null; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, val); return true; }
  catch (e) { return false; }
}

/* ─── Supabase REST Client ─── */
function cleanSupaUrl(url) {
  if (!url) return "";
  return url.trim().replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
}

async function sbFetch(path, options = {}) {
  const cfg = await loadConfig();
  const url = cleanSupaUrl(cfg.supabase?.url);
  const key = cfg.supabase?.key?.trim();

  if (!url || !key) return null;

  const endpoint = `${url}/rest/v1/${path}`;
  const headers = {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, { ...options, headers });
    return res;
  } catch (err) {
    console.warn("Supabase fetch error:", err);
    return null;
  }
}

async function sbGetOrders() {
  const res = await sbFetch("paperera_orders?select=*&order=timestamp.desc");
  if (!res || !res.ok) return null;
  return await res.json();
}

async function sbInsertOrder(order) {
  const res = await sbFetch("paperera_orders", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify(order)
  });
  return res && res.ok;
}

async function sbPatchOrder(id, patch) {
  const res = await sbFetch(`paperera_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  return res && res.ok;
}

async function sbDeleteOrder(id) {
  const res = await sbFetch(`paperera_orders?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return res && res.ok;
}

/* ─── Config API ─── */
async function loadConfig() {
  const raw = lsGet("paperera_config");
  let localCfg = DEFAULT_CONFIG;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      localCfg = {
        ...DEFAULT_CONFIG,
        ...parsed,
        supabase: { ...DEFAULT_CONFIG.supabase, ...(parsed.supabase || {}) }
      };
    } catch (e) {}
  } else {
    lsSet("paperera_config", JSON.stringify(DEFAULT_CONFIG));
  }

  // Try fetching remote config from Supabase paperera_kv
  try {
    const res = await sbFetch("paperera_kv?key=eq.site_config&select=value");
    if (res && res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].value) {
        const remoteCfg = JSON.parse(rows[0].value);
        localCfg = {
          ...localCfg,
          ...remoteCfg,
          supabase: { ...localCfg.supabase, ...(remoteCfg.supabase || {}) }
        };
        lsSet("paperera_config", JSON.stringify(localCfg));
      }
    }
  } catch (e) {}

  return localCfg;
}

async function saveConfig(cfg) {
  lsSet("paperera_config", JSON.stringify(cfg));
  try {
    await sbFetch("paperera_kv", {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key: "site_config", value: JSON.stringify(cfg) })
    });
  } catch (e) {}
  return true;
}

/* ─── Orders API ─── */
async function loadOrders() {
  // Try Supabase first
  try {
    const remote = await sbGetOrders();
    if (remote && Array.isArray(remote)) {
      lsSet("paperera_orders", JSON.stringify(remote));
      return remote;
    }
  } catch (e) {}

  // Fallback to local storage
  const raw = lsGet("paperera_orders");
  try { return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}

function newId() {
  return "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

async function addOrder(order) {
  order.id = newId();
  order.timestamp = new Date().toISOString();
  if (!order.status) order.status = "new";

  // 1. Save in localStorage
  const list = await loadOrders();
  list.unshift(order);
  lsSet("paperera_orders", JSON.stringify(list));

  // 2. Sync to Supabase
  try {
    await sbInsertOrder(order);
  } catch (e) {
    console.warn("Could not insert order into Supabase:", e);
  }

  return order;
}

async function updateOrder(id, patch) {
  const list = await loadOrders();
  const idx = list.findIndex(o => o.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...patch };
    lsSet("paperera_orders", JSON.stringify(list));
  }
  try {
    await sbPatchOrder(id, patch);
  } catch (e) {}
  return list[idx] || null;
}

async function deleteOrder(id) {
  const list = await loadOrders();
  const filtered = list.filter(o => o.id !== id);
  lsSet("paperera_orders", JSON.stringify(filtered));
  try {
    await sbDeleteOrder(id);
  } catch (e) {}
  return true;
}

async function deleteOrders(ids) {
  const idSet = new Set(ids);
  const list = await loadOrders();
  const filtered = list.filter(o => !idSet.has(o.id));
  lsSet("paperera_orders", JSON.stringify(filtered));
  for (const id of ids) {
    try { await sbDeleteOrder(id); } catch (e) {}
  }
  return true;
}

async function testSupabase(url, key) {
  if (!url || !key) return { ok: false, msg: "URL and Anon Key are required." };
  const clean = cleanSupaUrl(url);
  try {
    const res = await fetch(`${clean}/rest/v1/paperera_orders?select=id&limit=1`, {
      headers: {
        "apikey": key.trim(),
        "Authorization": `Bearer ${key.trim()}`
      }
    });
    if (res.ok || res.status === 200 || res.status === 206) {
      return { ok: true, msg: "Connected to Supabase successfully ✓" };
    }
    if (res.status === 404 || res.status === 400) {
      return { ok: true, msg: "Connected to Supabase! (Note: run the SQL schema to create tables)" };
    }
    return { ok: false, msg: `HTTP ${res.status} error — check your Anon Key & URL.` };
  } catch (err) {
    return { ok: false, msg: "Connection failed: " + err.message };
  }
}

function money(n) {
  return "₹" + (Number(n) || 0).toLocaleString("en-IN");
}
