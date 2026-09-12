/* admin.js — Paperera Admin Control Center */

const ADMIN_PASSWORD = "5555jai";

let CONFIG = {};
let ORDERS = [];
let loggedIn = false;
let currentView = "grouped"; // "grouped" | "feed"
let activeFilter = "all";

/* ─── Login ─── */
document.getElementById("loginBtn").addEventListener("click", tryLogin);
document.getElementById("pwInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin();
});

function tryLogin() {
  const val = document.getElementById("pwInput").value;
  const msgEl = document.getElementById("loginMsg");
  if (val === ADMIN_PASSWORD) {
    loggedIn = true;
    document.getElementById("loginWrap").style.display = "none";
    document.getElementById("adminShell").classList.add("show");
    boot();
  } else {
    msgEl.textContent = "Incorrect password. Please try again.";
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
document.getElementById("adminTabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  document.querySelectorAll("#adminTabs button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".tab-view").forEach((v) => v.classList.remove("active"));
  document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
});

/* ─── Boot & Refresh ─── */
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

document.getElementById("refreshBtn").addEventListener("click", refreshData);
document.getElementById("refreshBtn2").addEventListener("click", refreshData);

function renderAll() {
  renderOverview();
}

/* ─── Grouping Logic ─── */
function getSchoolGroups() {
  const groups = new Map();
  // Sort chronologically
  const sorted = [...ORDERS].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  sorted.forEach((o) => {
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
    g.totalAmount += Number(o.amount) || 0;
  });

  return Array.from(groups.values()).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
}

function getGroupOverallStatus(group) {
  const paymentOrder = group.orders.find((o) => o.type === "payment");
  if (paymentOrder) return paymentOrder.status; // "paid" or "pending"
  const hasNew = group.orders.some((o) => o.status === "new");
  return hasNew ? "new" : "handled";
}

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

function statusBadge(status) {
  const s = status || "new";
  return `<span class="badge ${s}">${s}</span>`;
}

function typeBadge(type) {
  const map = {
    payment: { cls: "payment", label: "Order & Payment" },
    domain: { cls: "domain", label: "Domain" },
    paper: { cls: "paper", label: "AI Paper" },
    service: { cls: "service", label: "Services" },
    siteinfo_upload: { cls: "siteinfo", label: "Site Info" }
  };
  const t = map[type] || { cls: "new", label: type };
  return `<span class="badge ${t.cls}">${t.label}</span>`;
}

function orderDetail(o) {
  if (o.type === "payment" && o.details?.items) {
    const itemsText = o.details.items.map((i) => i.label).join(", ");
    const noteText = o.details.notes ? ` [Note: ${o.details.notes}]` : "";
    const fileLink = o.details.fileName
      ? ` <a href="${o.details.fileData}" download="${o.details.fileName}" style="font-size:.78rem;">📎 ${o.details.fileName}</a>`
      : "";
    return (itemsText || "Order") + noteText + fileLink;
  }
  if (o.type === "domain") return o.details?.domainName || "Domain";
  if (o.type === "paper") return `${o.details?.papersMin || 50}–${o.details?.papersMax || 60} papers`;
  if (o.type === "service") {
    const m = o.details?.months ? `${o.details.months} mo: ` : "";
    return m + (o.details?.services || []).join(", ");
  }
  if (o.type === "siteinfo_upload") {
    const note = o.details?.notes ? o.details.notes.slice(0, 80) : "";
    const fileLink = o.details?.fileName
      ? ` <a href="${o.details.fileData}" download="${o.details.fileName}">📎 ${o.details.fileName}</a>`
      : "";
    return note + fileLink || "Site update";
  }
  return "—";
}

/* ─── Render Overview Table ─── */
function renderOverview() {
  const groups = getSchoolGroups();
  const payments = ORDERS.filter((o) => o.type === "payment");
  const paid = payments.filter((o) => o.status === "paid").reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const pending = payments.filter((o) => o.status !== "paid").reduce((s, o) => s + (Number(o.amount) || 0), 0);

  document.getElementById("statPaid").textContent = money(paid);
  document.getElementById("statPending").textContent = money(pending);
  document.getElementById("statLeads").textContent = groups.length;
  document.getElementById("statPayCount").textContent = ORDERS.length;

  const headEl = document.getElementById("overviewHead");
  const bodyEl = document.getElementById("overviewBody");
  const filterPillsEl = document.getElementById("filterPills");

  if (currentView === "grouped") {
    filterPillsEl.style.display = "none";
    headEl.innerHTML = `
      <tr>
        <th style="width:55px; text-align:center;">Sr No.</th>
        <th>School Name</th>
        <th>City / Place</th>
        <th>Contact Number</th>
        <th>All Requests &amp; Services</th>
        <th>Total Amount</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>`;

    if (groups.length === 0) {
      bodyEl.innerHTML = '<tr class="empty-row"><td colspan="8">No school orders or leads received yet.</td></tr>';
      return;
    }

    bodyEl.innerHTML = groups
      .map((g, idx) => {
        const overallStatus = getGroupOverallStatus(g);
        const reqListHtml = g.orders
          .map((o) => {
            return `<div style="margin: 3px 0;">
              <span class="req-item">
                <span class="type-tag">${o.type}</span>
                <span>${orderDetail(o)}</span>
                ${o.amount ? `<strong>(${money(o.amount)})</strong>` : ""}
              </span>
            </div>`;
          })
          .join("");

        const orderIds = g.orders.map((o) => o.id).join(",");

        let actionBtn = "";
        if (overallStatus === "new" || overallStatus === "pending") {
          const nextStatus = overallStatus === "pending" ? "paid" : "handled";
          actionBtn = `<button class="sm secondary" data-group-action="toggle" data-ids="${orderIds}" data-next="${nextStatus}">Mark ${nextStatus}</button>`;
        } else {
          actionBtn = `<button class="sm secondary" data-group-action="toggle" data-ids="${orderIds}" data-next="new">Reset</button>`;
        }

        const deleteBtn = `<button class="sm secondary" data-group-action="delete" data-ids="${orderIds}" title="Delete School Record" style="color:var(--red);margin-left:4px;">✕</button>`;

        return `
        <tr>
          <td style="text-align:center; font-weight:700; font-family:'IBM Plex Mono',monospace; color:var(--gold-deep);">${idx + 1}</td>
          <td style="font-weight:600; color:var(--navy-deep); font-size:.95rem;">${g.school}</td>
          <td>${g.place}</td>
          <td style="white-space:nowrap; font-family:'IBM Plex Mono',monospace; font-weight:500;">${g.contact}</td>
          <td style="max-width:380px;">${reqListHtml}</td>
          <td style="white-space:nowrap; font-weight:700; font-size:1rem; color:var(--navy-deep);">${g.totalAmount ? money(g.totalAmount) : "—"}</td>
          <td>${statusBadge(overallStatus)}</td>
          <td style="white-space:nowrap;">${actionBtn}${deleteBtn}</td>
        </tr>`;
      })
      .join("");
  } else {
    // Feed View
    filterPillsEl.style.display = "flex";
    headEl.innerHTML = `
      <tr>
        <th style="width:55px; text-align:center;">Sr No.</th>
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

    const rows = ORDERS.filter((o) => activeFilter === "all" || o.type === activeFilter).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (rows.length === 0) {
      bodyEl.innerHTML = `<tr class="empty-row"><td colspan="10">No submissions found for this filter.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = rows
      .map(
        (o, idx) => `
      <tr data-id="${o.id}">
        <td style="text-align:center; font-weight:700; font-family:'IBM Plex Mono',monospace; color:var(--gold-deep);">${idx + 1}</td>
        <td style="white-space:nowrap;">${fmtWhen(o.timestamp)}</td>
        <td>${typeBadge(o.type)}</td>
        <td style="font-weight:600;">${o.school || "—"}</td>
        <td>${o.place || "—"}</td>
        <td style="white-space:nowrap;">${o.contact || "—"}</td>
        <td style="max-width:240px; font-size:.82rem;">${orderDetail(o)}</td>
        <td style="white-space:nowrap; font-weight:700;">${o.amount ? money(o.amount) : "—"}</td>
        <td>${statusBadge(o.status)}</td>
        <td style="white-space:nowrap;">
          <button class="sm secondary" data-order-toggle="${o.id}" data-status="${o.status}">Toggle Status</button>
          <button class="sm secondary" data-order-delete="${o.id}" style="color:var(--red);margin-left:4px;" title="Delete">✕</button>
        </td>
      </tr>
    `
      )
      .join("");
  }
}

/* ─── View Switcher & Filter Pills ─── */
document.getElementById("viewSwitcher").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  document.querySelectorAll("#viewSwitcher button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentView = btn.dataset.view;
  renderOverview();
});

document.getElementById("filterPills").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  document.querySelectorAll("#filterPills button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderOverview();
});

/* ─── Table Actions Click Delegation ─── */
document.querySelector(".admin-panel").addEventListener("click", async (e) => {
  // Feed item toggle
  const orderToggleBtn = e.target.closest("button[data-order-toggle]");
  if (orderToggleBtn) {
    const id = orderToggleBtn.dataset.orderToggle;
    const cur = orderToggleBtn.dataset.status;
    const next = cur === "paid" ? "pending" : cur === "pending" ? "paid" : cur === "new" ? "handled" : "new";
    orderToggleBtn.disabled = true;
    await updateOrder(id, { status: next });
    ORDERS = await loadOrders();
    renderOverview();
    return;
  }

  // Feed item delete
  const orderDelBtn = e.target.closest("button[data-order-delete]");
  if (orderDelBtn) {
    if (!confirm("Delete this submission?")) return;
    orderDelBtn.disabled = true;
    await deleteOrder(orderDelBtn.dataset.orderDelete);
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
  const escapeCsv = (str) => `"${String(str || "").replace(/"/g, '""')}"`;

  if (currentView === "grouped") {
    const groups = getSchoolGroups();
    const headers = [
      "Sr No",
      "School Name",
      "City / Place",
      "Contact Number",
      "Total Amount (INR)",
      "Status",
      "All Requests & Details",
      "First Submission",
      "Latest Activity"
    ];
    csvContent += headers.map(escapeCsv).join(",") + "\r\n";

    groups.forEach((g, idx) => {
      const status = getGroupOverallStatus(g);
      const reqSummary = g.orders.map((o) => `[${o.type}] ${orderDetail(o)} (₹${o.amount || 0})`).join(" | ");
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
    const headers = [
      "Sr No",
      "Date & Time",
      "Type",
      "School Name",
      "City / Place",
      "Contact Number",
      "Details",
      "Amount (INR)",
      "Status"
    ];
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

/* ─── Settings Logic ─── */
function renderSettings() {
  document.getElementById("setUpi").value = CONFIG.upiId || "";
  document.getElementById("setPayee").value = CONFIG.payeeName || "Paperera";

  if (CONFIG.qrImage) {
    document.getElementById("qrPreviewWrap").innerHTML =
      `<img class="qr-preview" src="${CONFIG.qrImage}" alt="Current QR">`;
  }

  // Domain Extension Prices
  document.getElementById("domainPriceFields").innerHTML = Object.entries(CONFIG.domainPrices)
    .map(
      ([ext, price]) => `
      <div class="price-field">
        <label>.${ext}</label>
        <input type="number" class="domainPriceInput" data-ext="${ext}" value="${price}" min="0">
      </div>`
    )
    .join("");

  // Paper Rate
  document.getElementById("setPaperPrice").value = CONFIG.paperGen?.pricePerBundle || 500;
  document.getElementById("setPaperMin").value = CONFIG.paperGen?.papersMin || 50;
  document.getElementById("setPaperMax").value = CONFIG.paperGen?.papersMax || 60;

  // Monthly Rate
  document.getElementById("setMonthlyRate").value = CONFIG.monthlyRate || 500;

  // Supabase
  document.getElementById("setSupaUrl").value = CONFIG.supabase?.url || "";
  document.getElementById("setSupaKey").value = CONFIG.supabase?.key || "";
}

// QR Upload
let pendingQrData = null;
document.getElementById("setQr").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("Please select an image file under 2 MB.");
    e.target.value = "";
    return;
  }
  pendingQrData = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  document.getElementById("qrPreviewWrap").innerHTML =
    `<img class="qr-preview" src="${pendingQrData}" alt="New QR Preview">`;
});

// Save Payment
document.getElementById("savePaymentBtn").addEventListener("click", async () => {
  CONFIG.upiId = document.getElementById("setUpi").value.trim();
  CONFIG.payeeName = document.getElementById("setPayee").value.trim() || "Paperera";
  if (pendingQrData) {
    CONFIG.qrImage = pendingQrData;
    pendingQrData = null;
  }
  const ok = await saveConfig(CONFIG);
  flashMsg("paymentSettingsMsg", ok ? "✓ Payment details saved successfully." : "Could not save.", ok);
});

// Save Domain
document.getElementById("saveDomainBtn").addEventListener("click", async () => {
  document.querySelectorAll(".domainPriceInput").forEach((inp) => {
    CONFIG.domainPrices[inp.dataset.ext] = Number(inp.value) || 0;
  });
  const ok = await saveConfig(CONFIG);
  flashMsg("domainPriceMsg", ok ? "✓ Domain prices saved." : "Could not save.", ok);
});

// Save Paper Rate
document.getElementById("savePaperBtn").addEventListener("click", async () => {
  CONFIG.paperGen.pricePerBundle = Number(document.getElementById("setPaperPrice").value) || 500;
  CONFIG.paperGen.papersMin = Number(document.getElementById("setPaperMin").value) || 50;
  CONFIG.paperGen.papersMax = Number(document.getElementById("setPaperMax").value) || 60;
  const ok = await saveConfig(CONFIG);
  flashMsg("paperRateMsg", ok ? "✓ Paper generator rate saved." : "Could not save.", ok);
});

// Save Services Rate
document.getElementById("saveServicesBtn").addEventListener("click", async () => {
  CONFIG.monthlyRate = Number(document.getElementById("setMonthlyRate").value) || 500;
  const ok = await saveConfig(CONFIG);
  flashMsg("servicesMsg", ok ? "✓ Monthly rate saved." : "Could not save.", ok);
});

// Save Supabase
document.getElementById("saveSupaBtn").addEventListener("click", async () => {
  if (!CONFIG.supabase) CONFIG.supabase = {};
  CONFIG.supabase.url = document.getElementById("setSupaUrl").value.trim();
  CONFIG.supabase.key = document.getElementById("setSupaKey").value.trim();
  const ok = await saveConfig(CONFIG);
  flashMsg("supaStatusMsg", ok ? "✓ Supabase configuration saved." : "Could not save.", ok);
});

// Test Supabase
document.getElementById("testSupaBtn").addEventListener("click", async () => {
  const url = document.getElementById("setSupaUrl").value.trim();
  const key = document.getElementById("setSupaKey").value.trim();
  const btn = document.getElementById("testSupaBtn");
  btn.disabled = true;
  btn.textContent = "Testing…";
  const result = await testSupabase(url, key);
  flashMsg("supaStatusMsg", result.msg, result.ok);
  btn.disabled = false;
  btn.textContent = "Test Connection";
});

function flashMsg(elId, text, isOk) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.className = "msg show " + (isOk ? "ok" : "err");
  setTimeout(() => el.classList.remove("show"), 5000);
}
