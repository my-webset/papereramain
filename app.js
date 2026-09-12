/* app.js — Paperera Public Site Logic */

let CONFIG = null;

/* ─── DOM Elements ─── */
const el = {
  // School info
  school: document.getElementById("mainSchool"),
  place: document.getElementById("mainPlace"),
  contact: document.getElementById("mainContact"),
  person: document.getElementById("mainPerson"),
  email: document.getElementById("mainEmail"),

  // Domain
  chkDomain: document.getElementById("chkDomain"),
  domainBody: document.getElementById("domainBody"),
  dExt: document.getElementById("dExt"),
  dWanted: document.getElementById("dWanted"),
  domainNameOut: document.getElementById("domainNameOut"),
  domainPriceOut: document.getElementById("domainPriceOut"),
  domainPillPrice: document.getElementById("domainPillPrice"),

  // AI Papers
  chkPaper: document.getElementById("chkPaper"),
  paperBody: document.getElementById("paperBody"),
  pAmount: document.getElementById("pAmount"),
  paperRateHint: document.getElementById("paperRateHint"),
  paperAmtOut: document.getElementById("paperAmtOut"),
  paperCountOut: document.getElementById("paperCountOut"),
  paperPillPrice: document.getElementById("paperPillPrice"),

  // Monthly Services
  chkServices: document.getElementById("chkServices"),
  servicesBody: document.getElementById("servicesBody"),
  sMonths: document.getElementById("sMonths"),
  servicesChecklist: document.getElementById("servicesChecklist"),
  serviceMonthsOut: document.getElementById("serviceMonthsOut"),
  servicesPriceOut: document.getElementById("servicesPriceOut"),
  servicePillPrice: document.getElementById("servicePillPrice"),

  // Notes & file
  notes: document.getElementById("iNotes"),
  file: document.getElementById("iFile"),

  // Summary & Checkout
  cartList: document.getElementById("cartItemsList"),
  grandTotalOut: document.getElementById("grandTotalOut"),
  btnPayAmount: document.getElementById("btnPayAmount"),
  payNowBtn: document.getElementById("payNowBtn"),
  orderMsg: document.getElementById("orderMsg"),

  // Modal
  modalOverlay: document.getElementById("payModalOverlay"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  modalAmountOut: document.getElementById("modalAmountOut"),
  modalUpiOut: document.getElementById("modalUpiOut"),
  modalQrWrap: document.getElementById("modalQrWrap"),
  modalUpiBtn: document.getElementById("modalUpiBtn"),
  modalCopyUpiBtn: document.getElementById("modalCopyUpiBtn")
};

/* ─── Initialization ─── */
async function init() {
  CONFIG = await loadConfig();

  // Populate hero indicators
  const domainPrices = Object.values(CONFIG.domainPrices || { in: 599 });
  const cheapestDomain = Math.min(...domainPrices);
  document.getElementById("heroDomainFrom").textContent = money(cheapestDomain);
  document.getElementById("heroPaperRate").textContent = money(CONFIG.paperGen?.pricePerBundle || 500);
  document.getElementById("heroPaperRange").textContent = `${CONFIG.paperGen?.papersMin || 50}–${CONFIG.paperGen?.papersMax || 60} papers`;
  document.getElementById("heroServiceRate").textContent = money(CONFIG.monthlyRate || 500);

  // Populate domain extension dropdown
  el.dExt.innerHTML = Object.entries(CONFIG.domainPrices).map(([ext, price]) =>
    `<option value="${ext}">.${ext} — ${money(price)}</option>`
  ).join("");
  el.domainPillPrice.textContent = `from ${money(cheapestDomain)}`;

  // Populate paper hint
  const pRate = CONFIG.paperGen || { pricePerBundle: 500, papersMin: 50, papersMax: 60 };
  el.paperRateHint.textContent = `Rate: ${money(pRate.pricePerBundle)} = ${pRate.papersMin}–${pRate.papersMax} papers`;
  el.paperPillPrice.textContent = `${money(pRate.pricePerBundle)} / ${pRate.papersMin}–${pRate.papersMax} papers`;

  // Populate services checklist
  el.servicesChecklist.innerHTML = (CONFIG.services || []).map((s, idx) => `
    <label class="check-item">
      <input type="checkbox" value="${s.key}" data-label="${s.label}" ${idx < 4 ? "checked" : ""}>
      <span>${s.label}</span>
    </label>
  `).join("");
  el.servicePillPrice.textContent = `${money(CONFIG.monthlyRate || 500)}/month`;

  // Populate months dropdown with live pricing
  const mRate = CONFIG.monthlyRate || 500;
  el.sMonths.innerHTML = [1, 2, 3, 6, 12].map(m => `
    <option value="${m}" ${m === 3 ? "selected" : ""}>${m} ${m === 1 ? "month" : "months"} (${money(mRate * m)})</option>
  `).join("");

  // Restore saved school session info if available
  try {
    const saved = JSON.parse(sessionStorage.getItem("paperera_school_info") || "{}");
    if (saved.school) el.school.value = saved.school;
    if (saved.place) el.place.value = saved.place;
    if (saved.contact) el.contact.value = saved.contact;
    if (saved.person) el.person.value = saved.person;
    if (saved.email) el.email.value = saved.email;
  } catch (e) {}

  // Event Listeners
  attachListeners();

  // Initial calculation
  recalculateOrder();
}

function attachListeners() {
  // Service Toggles
  el.chkDomain.addEventListener("change", () => {
    el.domainBody.classList.toggle("disabled", !el.chkDomain.checked);
    recalculateOrder();
  });
  document.getElementById("domainToggleBar").addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") {
      el.chkDomain.checked = !el.chkDomain.checked;
      el.chkDomain.dispatchEvent(new Event("change"));
    }
  });

  el.chkPaper.addEventListener("change", () => {
    el.paperBody.classList.toggle("disabled", !el.chkPaper.checked);
    recalculateOrder();
  });
  document.getElementById("paperToggleBar").addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") {
      el.chkPaper.checked = !el.chkPaper.checked;
      el.chkPaper.dispatchEvent(new Event("change"));
    }
  });

  el.chkServices.addEventListener("change", () => {
    el.servicesBody.classList.toggle("disabled", !el.chkServices.checked);
    recalculateOrder();
  });
  document.getElementById("serviceToggleBar").addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") {
      el.chkServices.checked = !el.chkServices.checked;
      el.chkServices.dispatchEvent(new Event("change"));
    }
  });

  // Inputs change
  el.dExt.addEventListener("change", recalculateOrder);
  el.dWanted.addEventListener("input", recalculateOrder);
  el.school.addEventListener("input", () => {
    saveSchoolSession();
    if (!el.dWanted.value) recalculateOrder();
  });
  el.place.addEventListener("input", saveSchoolSession);
  el.contact.addEventListener("input", saveSchoolSession);
  if (el.person) el.person.addEventListener("input", saveSchoolSession);
  if (el.email) el.email.addEventListener("input", saveSchoolSession);

  el.pAmount.addEventListener("input", recalculateOrder);
  el.sMonths.addEventListener("change", recalculateOrder);
  el.servicesChecklist.addEventListener("change", recalculateOrder);

  // Pay button
  el.payNowBtn.addEventListener("click", handleProceedToPay);

  // Modal
  el.closeModalBtn.addEventListener("click", () => {
    el.modalOverlay.classList.remove("open");
  });
  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) el.modalOverlay.classList.remove("open");
  });
}

function saveSchoolSession() {
  try {
    const info = {
      school: el.school.value.trim(),
      place: el.place.value.trim(),
      contact: el.contact.value.trim(),
      person: el.person ? el.person.value.trim() : "",
      email: el.email ? el.email.value.trim() : ""
    };
    sessionStorage.setItem("paperera_school_info", JSON.stringify(info));
  } catch (e) {}
}

/* ─── Order Recalculation ─── */
function getSelectedItems() {
  const items = [];

  // 1. Domain
  if (el.chkDomain.checked) {
    const ext = el.dExt.value;
    const price = Number(CONFIG.domainPrices[ext]) || 599;
    const schoolBase = el.school.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "yourschool";
    const customName = el.dWanted.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const domainFull = (customName || schoolBase) + "." + ext;

    el.domainNameOut.textContent = domainFull;
    el.domainPriceOut.textContent = money(price);

    items.push({
      key: "domain",
      type: "domain",
      label: `Domain Registration (${domainFull})`,
      price: price,
      details: { ext, domainName: domainFull }
    });
  }

  // 2. AI Papers
  if (el.chkPaper.checked) {
    const amt = Math.max(500, Number(el.pAmount.value) || 500);
    const pRate = CONFIG.paperGen || { pricePerBundle: 500, papersMin: 50, papersMax: 60 };
    const bundles = amt / pRate.pricePerBundle;
    const minP = Math.floor(bundles * pRate.papersMin);
    const maxP = Math.floor(bundles * pRate.papersMax);

    el.paperAmtOut.textContent = money(amt);
    el.paperCountOut.textContent = `${minP}–${maxP} papers`;

    items.push({
      key: "paper",
      type: "paper",
      label: `AI Question Papers (${minP}–${maxP} papers bundle)`,
      price: amt,
      details: { amount: amt, papersMin: minP, papersMax: maxP }
    });
  }

  // 3. Monthly Services
  if (el.chkServices.checked) {
    const months = Number(el.sMonths.value) || 1;
    const mRate = Number(CONFIG.monthlyRate) || 500;
    const totalPrice = mRate * months;

    const checkedBoxes = Array.from(el.servicesChecklist.querySelectorAll("input[type=checkbox]:checked"));
    const selectedLabels = checkedBoxes.map(chk => chk.dataset.label);

    el.serviceMonthsOut.textContent = `${months} ${months === 1 ? "month" : "months"}`;
    el.servicesPriceOut.textContent = money(totalPrice);

    items.push({
      key: "service",
      type: "service",
      label: `Website Upkeep (${months} mo) — ${selectedLabels.length} feature(s)`,
      price: totalPrice,
      details: { months, ratePerMonth: mRate, services: selectedLabels }
    });
  }

  return items;
}

function recalculateOrder() {
  const items = getSelectedItems();
  const total = items.reduce((sum, item) => sum + item.price, 0);

  // Render Cart List
  if (items.length === 0) {
    el.cartList.innerHTML = '<li class="empty">No services selected yet. Check items above to build your order.</li>';
  } else {
    el.cartList.innerHTML = items.map(i => `
      <li>
        <span>${i.label}</span>
        <strong style="font-family:'IBM Plex Mono',monospace;color:var(--gold);">${money(i.price)}</strong>
      </li>
    `).join("");
  }

  el.grandTotalOut.textContent = money(total);
  el.btnPayAmount.textContent = money(total);
}

/* ─── Proceed to Pay & Auto-Save ─── */
async function handleProceedToPay() {
  const school = el.school.value.trim();
  const place = el.place.value.trim();
  const contact = el.contact.value.trim();
  const person = el.person ? el.person.value.trim() : "";
  const email = el.email ? el.email.value.trim() : "";
  const notes = el.notes ? el.notes.value.trim() : "";

  // 1. Validation
  if (!school) {
    flashMessage(el.orderMsg, "Please enter your School Name in section 01 above.", false);
    el.school.focus();
    return;
  }
  if (!place) {
    flashMessage(el.orderMsg, "Please enter your Place / City in section 01 above.", false);
    el.place.focus();
    return;
  }
  if (!contact || contact.length < 8) {
    flashMessage(el.orderMsg, "Please enter a valid 10-digit mobile number.", false);
    el.contact.focus();
    return;
  }

  const items = getSelectedItems();
  const total = items.reduce((sum, item) => sum + item.price, 0);

  if (items.length === 0 && !notes && !el.file.files[0]) {
    flashMessage(el.orderMsg, "Please select at least one service above to proceed.", false);
    return;
  }

  // Handle optional file
  let fileName = "";
  let fileData = "";
  if (el.file && el.file.files[0]) {
    const f = el.file.files[0];
    if (f.size > 3 * 1024 * 1024) {
      flashMessage(el.orderMsg, "Attached file is over 3 MB. Please share it via WhatsApp after submitting.", false);
      return;
    }
    fileName = f.name;
    try {
      fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    } catch (e) {}
  }

  // Build combined order payload
  const orderPayload = {
    type: "payment",
    school,
    place,
    contact,
    amount: total,
    status: "pending",
    details: {
      person,
      email,
      notes,
      fileName,
      fileData,
      items: items.map(i => ({ label: i.label, price: i.price, details: i.details }))
    }
  };

  el.payNowBtn.disabled = true;
  el.payNowBtn.textContent = "Registering Order…";

  try {
    // Automatically save to Supabase + localStorage
    const savedOrder = await addOrder(orderPayload);

    flashMessage(el.orderMsg, "✓ Order registered! Opening payment drawer…", true);

    // Open Payment Modal
    openPaymentModal(total, savedOrder);
  } catch (err) {
    flashMessage(el.orderMsg, "Could not submit to server. Please check internet connection.", false);
  } finally {
    el.payNowBtn.disabled = false;
    el.payNowBtn.textContent = `⚡ Proceed to Pay & Confirm Order (${money(total)}) →`;
  }
}

/* ─── Open Payment Modal ─── */
function openPaymentModal(total, order) {
  el.modalAmountOut.textContent = money(total);

  const upiId = (CONFIG && CONFIG.upiId) ? CONFIG.upiId.trim() : "";
  const payee = (CONFIG && CONFIG.payeeName) || "Paperera";
  const note = `Paperera Order ${order?.id || ""}`.trim();

  if (upiId) {
    el.modalUpiOut.textContent = "UPI ID: " + upiId;
    el.modalCopyUpiBtn.style.display = "inline-flex";
    el.modalCopyUpiBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(upiId);
        el.modalCopyUpiBtn.textContent = "Copied UPI ID ✓";
        setTimeout(() => { el.modalCopyUpiBtn.textContent = "📋 Copy UPI ID"; }, 2500);
      } catch (e) {
        prompt("Copy UPI ID:", upiId);
      }
    };
  } else {
    el.modalUpiOut.textContent = "UPI ID configured in Admin Panel";
    el.modalCopyUpiBtn.style.display = "none";
  }

  // QR Code Rendering
  if (CONFIG && CONFIG.qrImage) {
    el.modalQrWrap.innerHTML = `<img src="${CONFIG.qrImage}" alt="Payment QR code">`;
  } else if (upiId && total > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${total}&cu=INR&tn=${encodeURIComponent(note)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`;
    el.modalQrWrap.innerHTML = `<img src="${qrUrl}" alt="Scan to pay ${money(total)}">`;
  } else {
    el.modalQrWrap.innerHTML = '<p class="hint">QR code ready. You can also pay via phone transfer.</p>';
  }

  // Direct UPI App Link
  if (upiId && total > 0) {
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${total}&cu=INR&tn=${encodeURIComponent(note)}`;
    el.modalUpiBtn.href = upiUri;
    el.modalUpiBtn.style.display = "inline-flex";
  } else {
    el.modalUpiBtn.href = "#";
    el.modalUpiBtn.onclick = (e) => {
      e.preventDefault();
      alert("Order is registered! Admin will contact you on your registered mobile number.");
    };
  }

  el.modalOverlay.classList.add("open");
}

/* ─── Helper: Flash notification ─── */
function flashMessage(elem, text, isOk) {
  if (!elem) return;
  elem.textContent = text;
  elem.className = "msg show " + (isOk ? "ok" : "err");
  setTimeout(() => elem.classList.remove("show"), 6000);
}

// Start app
init();
