/* admin.js — Paperera admin panel */

const ADMIN_PASSWORD = "5555jai";

let CONFIG = {};
let ORDERS = [];
let loggedIn   = false;
let activeFilter = "all";

/* ─── Helpers ─── */
function money(n) {
  return "\u20B9" + (Number(n) || 0).toLocaleString("en-IN");
}

function fmtWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status) {
  const s = status || "new";
  return `<span class="badge ${s}">${s}</span>`;
}

function typeBadge(type) {
  const map = {
    domain:          { cls: "domain",   label: "Domain"    },
    paper:           { cls: "paper",    label: "AI Paper"  },
    service:         { cls: "service",  label: "Services"  },
    siteinfo_upload: { cls: "siteinfo", label: "Site Info" },
    payment:         { cls: "payment",  label: "Payment"   }
  };
  const t = map[type] || { cls: "new", label: type };
  return `<span class="badge ${t.cls}">${t.label}</span>`;
}

function orderDetail(o) {
  switch (o.type) {
    case "domain":         return o.details?.domainName || "—";
    case "paper":          return `${o.details?.papersMin}–${o.details?.papersMax} papers`;
    case "service":
      const mText = o.details?.months ? `${o.details.months} mo: ` : "";
      return mText + (o.details?.services || []).join(", ") || "—";
    case "siteinfo_upload":
      const note = o.details?.notes ? o.details.notes.slice(0, 60) + (o.details.notes.length > 60 ? "…" : "") : "";
      const fileLink = o.details?.fileName
        ? ` <a href="${o.details.fileData}" download="${o.details.fileName}" style="font-size:.75rem;">📎 ${o.details.fileName}</a>`
        : "";
      return note + fileLink || "—";
    case "payment":
      const items = (o.details?.items || []).map(i => i.label).join(", ");
      return items || "—";
    default: return "—";
  }
}

function toggleStates(type) {
  if (type === "payment") return ["pending", "paid"];
  return ["new", "handled"];
}

function statusToggleBtn(order) {
  const states = toggleStates(order.type);
  const idx  = states.indexOf(order.status || states[0]);
  const next = states[(idx + 1) % states.length];
  return `<button class="sm secondary" data-toggle="${order.id}" data-next="${next}">Mark ${next}</button>`;
}

/* ─── Login ─── */
document.getElementById("loginBtn").addEventListener("click", tryLogin);
document.getElementById("pwInput").addEventListener("keydown", e => {
  if (e.key === "Enter") tryLogin();
});

function tryLogin() {
  const val   = document.getElementById("pwInput").value;
  const msgEl = document.getElementById("loginMsg");
  if (val === ADMIN_PASSWORD) {
    loggedIn = true;
    document.getElementById("loginWrap").style.display = "none";
    document.getElementById("adminShell").classList.add("show");
    boot();
  } else {
    msgEl.textContent = "Wrong password. Please try again.";
    msgEl.className = "msg show err";
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  loggedIn = false;
  document.getElementById("adminShell").classList.remove("show");
  document.getElementById("loginWrap").style.display = "flex";
  document.getElementById("pwInput").value = "";
});

/* ─── Tabs ─── */
document.getElementById("adminTabs").addEventListener("click", e => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  document.querySelectorAll("#adminTabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
});

/* ─── Boot ─── */
async function boot() {
  CONFIG = await loadConfig();
  ORDERS = await loadOrders();
  renderAll();
  renderSettings();
}

async function refreshData() {
  ORDERS = await loadOrders();
  renderAll();
}

document.getElementById("refreshBtn").addEventListener("click",  refreshData);
document.getElementById("refreshBtn2").addEventListener("click", refreshData);

function renderAll() {
  renderOverview();
}

let currentView = "grouped"; // "grouped" or "feed"

/* ─── Grouping by School ─── */
function getSchoolGroups() {
  const groups = new Map();
  const sorted = [...ORDERS].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  sorted.forEach(o => {
    const schoolClean = (o.school || "").trim();
    const contactClean = (o.contact || "").trim();
    const key = (schoolClean.toLowerCase() || "unnamed") + "__" + (contactClean.replace(/\D/g, "") || "nocontact");

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        school: schoolClean || "—",
        place: (o.place || "").trim() || "—",
        contact: contactClean || "—",
        orders: [],
        firstSeen: o.timestamp,
        lastSeen: o.timestamp,
        totalAmount: 0
      });
    }

    const g = groups.get(key);
    if (g.place === "—" && (o.place || "").trim()) g.place = o.place.trim();
    if (g.school === "—" && schoolClean) g.school = schoolClean;
    if (g.contact === "—" && contactClean) g.contact = contactClean;

    g.orders.push(o);
    g.lastSeen = o.timestamp;
    g.totalAmount += (Number(o.amount) || 0);
  });

  return Array.from(groups.values()).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function getGroupOverallStatus(group) {
  const paymentOrder = group.orders.find(o => o.type === "payment");
  if (paymentOrder) return paymentOrder.status; // "paid" or "pending"
  const hasNew = group.orders.some(o => o.status === "new");
  return hasNew ? "new" : "handled";
}

/* ─── Overview Renderer ─── */
function renderOverview() {
  // Update top statistics
  const payments = ORDERS.filter(o => o.type === "payment");
  const paid     = payments.filter(o => o.status === "paid").reduce((s, o) => s + o.amount, 0);
  const pending  = payments.filter(o => o.status !== "paid").reduce((s, o) => s + o.amount, 0);

  document.getElementById("statPaid").textContent     = money(paid);
  document.getElementById("statPending").textContent  = money(pending);
  document.getElementById("statLeads").textContent    = ORDERS.length;
  document.getElementById("statPayCount").textContent = payments.length;

  const headEl = document.getElementById("overviewHead");
  const bodyEl = document.getElementById("overviewBody");
  const filterPillsEl = document.getElementById("filterPills");

  if (currentView === "grouped") {
    filterPillsEl.style.display = "none";
    headEl.innerHTML = `
      <tr>
        <th style="width:60px;text-align:center;">Sr No.</th>
        <th>School Name</th>
        <th>City / Place</th>
        <th>Contact</th>
        <th>All Requests &amp; Services</th>
        <th>Total Amount</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>`;

    const groups = getSchoolGroups();
    if (groups.length === 0) {
      bodyEl.innerHTML = '<tr class="empty-row"><td colspan="8">No school submissions yet.</td></tr>';
      return;
    }

    bodyEl.innerHTML = groups.map((g, idx) => {
      const overallStatus = getGroupOverallStatus(g);
      const reqListHtml = g.orders.map(o => {
        return `<span class="req-item">
          <span class="type-tag">${o.type.replace('_upload', '')}</span>
          <span>${orderDetail(o)}</span>
          ${o.amount ? `<strong>(${money(o.amount)})</strong>` : ''}
        </span>`;
      }).join(" ");

      const orderIds = g.orders.map(o => o.id).join(",");

      let actionBtn = "";
      if (overallStatus === "new" || overallStatus === "pending") {
        const nextStatus = overallStatus === "pending" ? "paid" : "handled";
        actionBtn = `<button class="sm secondary" data-group-action="toggle" data-ids="${orderIds}" data-next="${nextStatus}">Mark ${nextStatus}</button>`;
      } else {
        actionBtn = `<button class="sm secondary" data-group-action="toggle" data-ids="${orderIds}" data-next="new">Reset</button>`;
      }

      const deleteBtn = `<button class="sm secondary" data-group-action="delete" data-ids="${orderIds}" title="Delete school entries" style="color:var(--red);margin-left:4px;">✕</button>`;

      return `
        <tr>
          <td style="text-align:center;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--gold-deep);">${idx + 1}</td>
          <td style="font-weight:600;color:var(--navy-deep);">${g.school}</td>
          <td>${g.place}</td>
          <td style="white-space:nowrap;font-family:'IBM Plex Mono',monospace;">${g.contact}</td>
          <td style="max-width:340px;">${reqListHtml}</td>
          <td style="white-space:nowrap;font-weight:700;color:var(--navy-deep);">${g.totalAmount ? money(g.totalAmount) : '—'}</td>
          <td>${statusBadge(overallStatus)}</td>
          <td style="white-space:nowrap;">${actionBtn}${deleteBtn}</td>
        </tr>`;
    }).join("");

  } else {
    // Feed View
    filterPillsEl.style.display = "flex";
    headEl.innerHTML = `
      <tr>
        <th style="width:60px;text-align:center;">Sr No.</th>
        <th>When</th>
        <th>Type</th>
        <th>School</th>
        <th>City</th>
        <th>Contact</th>
        <th>Details</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>`;

    const rows = ORDERS
      .filter(o => activeFilter === "all" || o.type === activeFilter)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (rows.length === 0) {
      bodyEl.innerHTML = `<tr class="empty-row"><td colspan="10">No submissions found${activeFilter !== "all" ? " for this filter" : ""}.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = rows.map((o, idx) => `
      <tr data-id="${o.id}">
        <td style="text-align:center;font-weight:700;font-family:'IBM Plex Mono',monospace;color:var(--gold-deep);">${idx + 1}</td>
        <td style="white-space:nowrap;">${fmtWhen(o.timestamp)}</td>
        <td>${typeBadge(o.type)}</td>
        <td>${o.school || "—"}</td>
        <td>${o.place  || "—"}</td>
        <td style="white-space:nowrap;">${o.contact || "—"}</td>
        <td style="max-width:220px;font-size:.82rem;">${orderDetail(o)}</td>
        <td style="white-space:nowrap;font-weight:600;">${o.amount ? money(o.amount) : "—"}</td>
        <td>${statusBadge(o.status)}</td>
        <td style="white-space:nowrap;">
          ${statusToggleBtn(o)}
          <button class="sm secondary" data-order-delete="${o.id}" style="color:var(--red);margin-left:4px;" title="Delete">✕</button>
        </td>
      </tr>
    `).join("");
  }
}

/* ─── View Switcher ─── */
document.getElementById("viewSwitcher").addEventListener("click", e => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  document.querySelectorAll("#viewSwitcher button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentView = btn.dataset.view;
  renderOverview();
});

/* Filter pills */
document.getElementById("filterPills").addEventListener("click", e => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  document.querySelectorAll("#filterPills button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderOverview();
});

/* Group actions & single order actions */
document.querySelector(".admin-panel").addEventListener("click", async e => {
  // Single order status toggle
  const toggleBtn = e.target.closest("button[data-toggle]");
  if (toggleBtn) {
    toggleBtn.disabled = true;
    toggleBtn.textContent = "Saving…";
    const id   = toggleBtn.dataset.toggle;
    const next = toggleBtn.dataset.next;
    await updateOrder(id, { status: next });
    ORDERS = await loadOrders();
    renderOverview();
    return;
  }

  // Single order delete
  const delBtn = e.target.closest("button[data-order-delete]");
  if (delBtn) {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    delBtn.disabled = true;
    await deleteOrder(delBtn.dataset.orderDelete);
    ORDERS = await loadOrders();
    renderOverview();
    return;
  }

  // Group actions (toggle / delete)
  const groupBtn = e.target.closest("button[data-group-action]");
  if (groupBtn) {
    const action = groupBtn.dataset.groupAction;
    const ids = groupBtn.dataset.ids.split(",");
    if (action === "delete") {
      if (!confirm(`Delete all ${ids.length} submission(s) for this school?`)) return;
      groupBtn.disabled = true;
      await deleteOrders(ids);
      ORDERS = await loadOrders();
      renderOverview();
    } else if (action === "toggle") {
      const next = groupBtn.dataset.next;
      groupBtn.disabled = true;
      for (const id of ids) {
        await updateOrder(id, { status: next });
      }
      ORDERS = await loadOrders();
      renderOverview();
    }
  }
});

/* ─── CSV Download Export ─── */
document.getElementById("downloadCsvBtn").addEventListener("click", () => {
  if (ORDERS.length === 0) {
    alert("No submissions to download yet.");
    return;
  }

  let csvContent = "";
  const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

  if (currentView === "grouped") {
    const groups = getSchoolGroups();
    const headers = ["Sr No", "School Name", "City / Place", "Contact", "Total Amount (INR)", "Status", "All Requests & Details", "First Submission", "Latest Activity"];
    csvContent += headers.map(escapeCsv).join(",") + "\r\n";

    groups.forEach((g, idx) => {
      const status = getGroupOverallStatus(g);
      const reqSummary = g.orders.map(o => `[${o.type}] ${orderDetail(o)} (INR ${o.amount || 0})`).join(" | ");
      const row = [
        idx + 1,
        g.school,
        g.place,
        g.contact,
        g.totalAmount || 0,
        status,
        reqSummary,
        new Date(g.firstSeen).toLocaleString("en-IN"),
        new Date(g.lastSeen).toLocaleString("en-IN")
      ];
      csvContent += row.map(escapeCsv).join(",") + "\r\n";
    });
  } else {
    const headers = ["Sr No", "Date & Time", "Type", "School Name", "City / Place", "Contact", "Details", "Amount (INR)", "Status"];
    csvContent += headers.map(escapeCsv).join(",") + "\r\n";

    const rows = [...ORDERS].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    rows.forEach((o, idx) => {
      const row = [
        idx + 1,
        new Date(o.timestamp).toLocaleString("en-IN"),
        o.type,
        o.school || "",
        o.place || "",
        o.contact || "",
        orderDetail(o),
        o.amount || 0,
        o.status || "new"
      ];
      csvContent += row.map(escapeCsv).join(",") + "\r\n";
    });
  }

  // Prepend UTF-8 BOM so Excel reads Indian formatting correctly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Paperera_School_Data_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ─── Settings ─── */
function renderSettings() {
  document.getElementById("setUpi").value   = CONFIG.upiId    || "";
  document.getElementById("setPayee").value = CONFIG.payeeName || "Paperera";

  if (CONFIG.qrImage) {
    document.getElementById("qrPreviewWrap").innerHTML =
      `<img class="qr-preview" src="${CONFIG.qrImage}" alt="Current QR">`;
  }

  // Domain prices
  document.getElementById("domainPriceFields").innerHTML =
    Object.entries(CONFIG.domainPrices).map(([ext, price]) => `
      <div class="price-field">
        <label>.${ext}</label>
        <input type="number" class="domainPriceInput" data-ext="${ext}" value="${price}" min="0">
      </div>`).join("");

  // Paper rate
  document.getElementById("setPaperPrice").value = CONFIG.paperGen?.pricePerBundle || 500;
  document.getElementById("setPaperMin").value   = CONFIG.paperGen?.papersMin      || 50;
  document.getElementById("setPaperMax").value   = CONFIG.paperGen?.papersMax      || 60;

  // Monthly site usage rate
  document.getElementById("setMonthlyRate").value = CONFIG.monthlyRate || 500;

  // Supabase
  document.getElementById("setSupaUrl").value = CONFIG.supabase?.url || "";
  document.getElementById("setSupaKey").value = CONFIG.supabase?.key || "";
}

/* QR preview */
let pendingQrData = null;
document.getElementById("setQr").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("Please use a QR image under 2 MB.");
    e.target.value = "";
    return;
  }
  pendingQrData = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  document.getElementById("qrPreviewWrap").innerHTML =
    `<img class="qr-preview" src="${pendingQrData}" alt="New QR preview">`;
});

/* Save payment */
document.getElementById("savePaymentBtn").addEventListener("click", async () => {
  CONFIG.upiId    = document.getElementById("setUpi").value.trim();
  CONFIG.payeeName = document.getElementById("setPayee").value.trim() || "Paperera";
  if (pendingQrData) { CONFIG.qrImage = pendingQrData; pendingQrData = null; }
  const ok = await saveConfig(CONFIG);
  flash("paymentSettingsMsg", ok ? "✓ Payment details saved." : "Could not save — try again.", ok);
});

/* Save domain prices */
document.getElementById("saveDomainBtn").addEventListener("click", async () => {
  document.querySelectorAll(".domainPriceInput").forEach(inp => {
    CONFIG.domainPrices[inp.dataset.ext] = Number(inp.value) || 0;
  });
  const ok = await saveConfig(CONFIG);
  flash("domainPriceMsg", ok ? "✓ Domain prices saved." : "Could not save — try again.", ok);
});

/* Save paper rate */
document.getElementById("savePaperBtn").addEventListener("click", async () => {
  CONFIG.paperGen.pricePerBundle = Number(document.getElementById("setPaperPrice").value) || 500;
  CONFIG.paperGen.papersMin      = Number(document.getElementById("setPaperMin").value)   || 50;
  CONFIG.paperGen.papersMax      = Number(document.getElementById("setPaperMax").value)   || 60;
  const ok = await saveConfig(CONFIG);
  flash("paperRateMsg", ok ? "✓ Paper rate saved." : "Could not save — try again.", ok);
});

/* Save monthly services rate */
document.getElementById("saveServicesBtn").addEventListener("click", async () => {
  CONFIG.monthlyRate = Number(document.getElementById("setMonthlyRate").value) || 500;
  const ok = await saveConfig(CONFIG);
  flash("servicesMsg", ok ? "✓ Monthly rate saved." : "Could not save — try again.", ok);
});

/* Save Supabase */
document.getElementById("saveSupaBtn").addEventListener("click", async () => {
  if (!CONFIG.supabase) CONFIG.supabase = {};
  CONFIG.supabase.url = document.getElementById("setSupaUrl").value.trim().replace(/\/$/, "");
  CONFIG.supabase.key = document.getElementById("setSupaKey").value.trim();
  const ok = await saveConfig(CONFIG);
  flash("supaMsg", ok ? "✓ Supabase config saved." : "Could not save — try again.", ok);
});

/* Test Supabase */
document.getElementById("testSupaBtn").addEventListener("click", async () => {
  const url = document.getElementById("setSupaUrl").value.trim().replace(/\/$/, "");
  const key = document.getElementById("setSupaKey").value.trim();
  const btn = document.getElementById("testSupaBtn");
  btn.disabled = true;
  btn.textContent = "Testing…";
  const result = await testSupabase(url, key);
  const el = document.getElementById("supaStatus");
  el.textContent  = result.msg;
  el.className    = "supa-status show " + (result.ok ? "ok" : "err");
  btn.disabled    = false;
  btn.textContent = "Test connection";
  setTimeout(() => el.classList.remove("show"), 6000);
});

/* Flash helper */
function flash(elId, text, ok) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className   = "msg show " + (ok ? "ok" : "err");
  setTimeout(() => el.classList.remove("show"), 5000);
}
