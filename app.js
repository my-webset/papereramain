/* app.js — Paperera public site logic */

let CONFIG = null;
let cart = []; // { key, label, price, meta }

/* ─── Session memory for school / contact ─── */
const SS = {
  get: (k) => { try { return sessionStorage.getItem("paperera_" + k) || ""; } catch { return ""; } },
  set: (k, v) => { try { sessionStorage.setItem("paperera_" + k, v); } catch {} }
};

function rememberSchoolContact(school, place, contact) {
  if (school)  SS.set("school",  school);
  if (place)   SS.set("place",   place);
  if (contact) SS.set("contact", contact);
}

function prefillField(id, key) {
  const el = document.getElementById(id);
  if (el && !el.value && SS.get(key)) el.value = SS.get(key);
}

function prefillAll() {
  // Domain form
  prefillField("dSchool",  "school");
  prefillField("dPlace",   "place");
  prefillField("dContact", "contact");
  // Paper form
  prefillField("pSchool",  "school");
  prefillField("pContact", "contact");
  // Services form
  prefillField("sSchool",  "school");
  prefillField("sPlace",   "place");
  prefillField("sContact", "contact");
  // Info form
  prefillField("iSchool",  "school");
  prefillField("iPlace",   "place");
  prefillField("iContact", "contact");
  // Pay box
  prefillField("payName",    "school");
  prefillField("payContact", "contact");
}

/* ─── Utilities ─── */
function flash(el, text, ok) {
  el.textContent = text;
  el.className = "msg show " + (ok ? "ok" : "err");
  setTimeout(() => el.classList.remove("show"), 5000);
}

/* ─── Init ─── */
async function init() {
  CONFIG = await loadConfig();

  // Domain dropdown
  const dExt = document.getElementById("dExt");
  const entries = Object.entries(CONFIG.domainPrices);
  dExt.innerHTML = entries
    .map(([ext, price]) => `<option value="${ext}">.${ext} — ${money(price)}</option>`)
    .join("");
  const cheapest = Math.min(...entries.map(e => e[1]));
  document.getElementById("heroDomainFrom").textContent = money(cheapest);

  // Hero & hint
  document.getElementById("heroPaperRate").textContent  = money(CONFIG.paperGen.pricePerBundle);
  document.getElementById("heroPaperRange").textContent = `${CONFIG.paperGen.papersMin}–${CONFIG.paperGen.papersMax} papers`;
  document.getElementById("paperRateHint").textContent  =
    `Rate: ${money(CONFIG.paperGen.pricePerBundle)} = ${CONFIG.paperGen.papersMin}–${CONFIG.paperGen.papersMax} papers`;

  // Hero service rate (flat monthly)
  const monthlyRate = CONFIG.monthlyRate || 500;
  document.getElementById("heroServiceRate").textContent = money(monthlyRate);

  // Services checklist (no per-item price — flat monthly rate)
  const list = document.getElementById("serviceList");
  list.innerHTML = CONFIG.services
    .map(s => `
    <div class="service-row">
      <label>
        <input type="checkbox" value="${s.key}" data-label="${s.label}">
        ${s.label}
      </label>
    </div>`)
    .join("");

  // Monthly label in description
  const svcLabel = document.getElementById("svcMonthlyLabel");
  if (svcLabel) svcLabel.textContent = `${money(monthlyRate)}/month`;

  // Live preview for monthly services
  document.getElementById("serviceList").addEventListener("change", updateServicesPreview);
  document.getElementById("sMonths").addEventListener("change", updateServicesPreview);

  renderPayBox();
  renderCart();
  prefillAll();

  // Auto-fill when user focuses a form section
  document.querySelectorAll("form input, form select, form textarea").forEach(el => {
    el.addEventListener("focus", prefillAll, { once: true });
  });
}

function updateServicesPreview() {
  const checked = Array.from(document.querySelectorAll("#serviceList input[type=checkbox]:checked"));
  const months = Number(document.getElementById("sMonths").value) || 1;
  const rate = (CONFIG && CONFIG.monthlyRate) || 500;
  const total = rate * months;
  const resultEl = document.getElementById("servicesResult");
  if (checked.length > 0) {
    resultEl.style.display = "block";
    resultEl.innerHTML = `<strong>${checked.length} service${checked.length > 1 ? "s" : ""}</strong> selected for <strong>${months} month${months > 1 ? "s" : ""}</strong> = <span class="big">${money(total)}</span> (${money(rate)}/month)`;
  } else {
    resultEl.style.display = "none";
  }
}

/* ─── Cart ─── */
function upsertCart(item) {
  const idx = cart.findIndex(c => c.key === item.key);
  if (idx >= 0) cart[idx] = item;
  else cart.push(item);
  renderCart();
  renderPayBox();
}

function addManyToCart(items) {
  items.forEach(upsertCart);
}

function removeFromCart(key) {
  cart = cart.filter(c => c.key !== key);
  renderCart();
  renderPayBox();
}

function cartTotal() {
  return cart.reduce((s, c) => s + c.price, 0);
}

function renderCart() {
  const listEl = document.getElementById("cartList");
  const barEl  = document.getElementById("cartBar");

  if (cart.length === 0) {
    listEl.innerHTML = '<li class="empty-row"><em>Nothing added yet — fill a form above first.</em></li>';
    if (barEl) barEl.style.display = "none";
  } else {
    listEl.innerHTML = cart
      .map(c => `
        <li>
          <span>${c.label}</span>
          <span style="display:flex;align-items:center;gap:8px;">
            <strong>${money(c.price)}</strong>
            <button class="remove-item" data-key="${c.key}" title="Remove" aria-label="Remove">✕</button>
          </span>
        </li>`)
      .join("");
    if (barEl) barEl.style.display = "block";
  }

  const total = cartTotal();
  document.getElementById("cartTotalOut").textContent  = money(total);
  document.getElementById("cartBarTotal").textContent  = money(total);
  document.getElementById("cartBarItems").textContent  =
    cart.length === 0
      ? "No items added yet"
      : `${cart.length} item${cart.length > 1 ? "s" : ""} in your order`;

  // Pay name/contact auto-fill whenever cart updates
  prefillField("payName",    "school");
  prefillField("payContact", "contact");

  renderPayBox();
}

// Remove item click
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-item");
  if (btn) removeFromCart(btn.dataset.key);
});

function renderPayBox() {
  const total = cartTotal();
  document.getElementById("qrAmountOut").textContent = money(total);

  const upiId   = CONFIG && CONFIG.upiId ? CONFIG.upiId.trim() : "";
  const payee   = (CONFIG && CONFIG.payeeName) || "Paperera";
  const upiOut  = document.getElementById("qrUpiOut");
  const copyBtn = document.getElementById("copyUpiBtn");
  const wrap    = document.getElementById("qrImageWrap");
  const payBtn  = document.getElementById("upiPayBtn");

  if (upiId) {
    upiOut.textContent = "UPI: " + upiId;
    if (copyBtn) {
      copyBtn.style.display = "inline-block";
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(upiId);
          copyBtn.textContent = "Copied ✓";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
        } catch {
          prompt("Copy UPI ID:", upiId);
        }
      };
    }
  } else {
    upiOut.textContent = "UPI ID not configured in admin settings.";
    if (copyBtn) copyBtn.style.display = "none";
  }

  // QR Code Rendering:
  // If admin uploaded a custom QR image, use that.
  // Otherwise if UPI ID exists, dynamically generate a QR code with the total amount!
  if (CONFIG && CONFIG.qrImage) {
    wrap.innerHTML = `<img src="${CONFIG.qrImage}" alt="Payment QR code">`;
  } else if (upiId && total > 0) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${total}&cu=INR&tn=${encodeURIComponent("Paperera Order")}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;
    wrap.innerHTML = `<img src="${qrUrl}" alt="Dynamic UPI QR code for ${money(total)}" style="max-width:200px;background:#fff;padding:8px;">`;
  } else {
    wrap.innerHTML = '<p class="hint">QR code will appear when order is added and UPI ID is configured.</p>';
  }

  // UPI deep link
  if (upiId && total > 0) {
    const note = encodeURIComponent("Paperera services payment");
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payee)}&am=${total}&cu=INR&tn=${note}`;
    payBtn.href = upiUri;
    payBtn.style.opacity = "1";
    payBtn.onclick = (e) => {
      // If desktop, give feedback if custom protocol doesn't launch
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (!isMobile) {
        setTimeout(() => {
          const msgEl = document.getElementById("payMsg");
          flash(msgEl, `UPI link triggered. If on PC, scan QR code with your mobile UPI app or pay to: ${upiId}`, true);
        }, 1000);
      }
    };
  } else {
    payBtn.href = "#";
    payBtn.style.opacity = "0.5";
    payBtn.onclick = (e) => {
      e.preventDefault();
      const msgEl = document.getElementById("payMsg");
      if (!upiId) {
        flash(msgEl, "UPI ID is not set yet by admin. Please contact support or set UPI ID in admin panel.", false);
      } else {
        flash(msgEl, "Please add at least one item to your order first.", false);
      }
    };
  }
}

/* ─── Domain form ─── */
document.addEventListener("submit", async (e) => {

  if (e.target.id === "domainForm") {
    e.preventDefault();
    const school  = document.getElementById("dSchool").value.trim();
    const place   = document.getElementById("dPlace").value.trim();
    const contact = document.getElementById("dContact").value.trim();
    const ext     = document.getElementById("dExt").value;
    const wanted  = document.getElementById("dWanted").value.trim();
    const price   = CONFIG.domainPrices[ext];
    const base    = wanted || school.replace(/\s+/g, "").toLowerCase() || "yourschool";
    const domainName = base + "." + ext;

    rememberSchoolContact(school, place, contact);

    document.getElementById("domainResult").style.display = "block";
    document.getElementById("domainPriceOut").textContent = money(price);
    document.getElementById("domainNameOut").textContent  = domainName;

    upsertCart({ key: "domain", label: `Domain — ${domainName}`, price,
                 meta: { school, place, contact, ext, domainName } });

    const msgEl = document.getElementById("domainMsg");
    try {
      await addOrder({ type: "domain", school, place, contact, amount: price,
                       details: { ext, domainName } });
      flash(msgEl, "✓ Added to your order and sent to our team.", true);
      e.target.reset();
      prefillAll();
    } catch {
      flash(msgEl, "Added to your order, but couldn't reach the server. Please also call us.", false);
    }
  }

  /* ─── Paper form ─── */
  if (e.target.id === "paperForm") {
    e.preventDefault();
    const school  = document.getElementById("pSchool").value.trim();
    const contact = document.getElementById("pContact").value.trim();
    const amount  = Number(document.getElementById("pAmount").value);
    const rate    = CONFIG.paperGen;
    const bundles   = amount / rate.pricePerBundle;
    const papersMin = Math.floor(bundles * rate.papersMin);
    const papersMax = Math.floor(bundles * rate.papersMax);

    rememberSchoolContact(school, "", contact);

    const resultEl = document.getElementById("paperResult");
    resultEl.style.display = "block";
    resultEl.innerHTML = `For <span class="big">${money(amount)}</span> you get approximately
      <strong>${papersMin}–${papersMax} papers</strong> generated.`;

    upsertCart({ key: "paper", label: `AI paper generation (${papersMin}–${papersMax} papers)`,
                 price: amount, meta: { school, contact, papersMin, papersMax } });

    const msgEl = document.getElementById("paperMsg");
    try {
      await addOrder({ type: "paper", school, place: "", contact, amount,
                       details: { papersMin, papersMax } });
      flash(msgEl, "✓ Added to your order and sent to our team.", true);
    } catch {
      flash(msgEl, "Added to your order, but couldn't reach the server. Please also call us.", false);
    }
  }

  /* ─── Services form ─── */
  if (e.target.id === "servicesForm") {
    e.preventDefault();
    const school  = document.getElementById("sSchool").value.trim();
    const place   = document.getElementById("sPlace").value.trim();
    const contact = document.getElementById("sContact").value.trim();
    const months  = Number(document.getElementById("sMonths").value) || 1;
    const checked = Array.from(document.querySelectorAll("#serviceList input[type=checkbox]:checked"));

    if (checked.length === 0) {
      flash(document.getElementById("serviceMsg"), "Pick at least one service feature first.", false);
      return;
    }

    rememberSchoolContact(school, place, contact);

    const monthlyRate = (CONFIG && CONFIG.monthlyRate) || 500;
    const totalPrice  = monthlyRate * months;
    const selectedLabels = checked.map(chk => chk.dataset.label);

    upsertCart({
      key:   "service",
      label: `Site usage (${months} mo) — ${selectedLabels.join(", ")}`,
      price: totalPrice,
      meta:  { school, place, contact, months, services: selectedLabels }
    });

    const msgEl = document.getElementById("serviceMsg");
    try {
      await addOrder({
        type: "service",
        school, place, contact,
        amount: totalPrice,
        details: { months, ratePerMonth: monthlyRate, services: selectedLabels }
      });
      flash(msgEl, `✓ Added ${months} month(s) site usage (${money(totalPrice)}) to your order and sent to our team.`, true);
      // uncheck all
      checked.forEach(chk => { chk.checked = false; });
      updateServicesPreview();
    } catch {
      flash(msgEl, "Added to your order, but couldn't reach the server. Please also call us.", false);
    }
  }

  /* ─── Site info form ─── */
  if (e.target.id === "infoForm") {
    e.preventDefault();
    const school  = document.getElementById("iSchool").value.trim();
    const place   = document.getElementById("iPlace").value.trim();
    const contact = document.getElementById("iContact").value.trim();
    const notes   = document.getElementById("iNotes").value.trim();
    const fileInput = document.getElementById("iFile");
    const msgEl   = document.getElementById("infoMsg");

    rememberSchoolContact(school, place, contact);

    let fileData = "", fileName = "";
    const file = fileInput.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        flash(msgEl, "That file is over 3 MB — please share it via WhatsApp instead.", false);
        return;
      }
      fileName = file.name;
      fileData = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    try {
      await addOrder({ type: "siteinfo_upload", school, place, contact, amount: 0,
                       details: { notes, fileName, fileData } });
      flash(msgEl, "✓ Sent to our site team. If you want this billed, tick 'Site info change' above too.", true);
      e.target.reset();
      prefillAll();
    } catch {
      flash(msgEl, "Couldn't reach the server — please try again or call us.", false);
    }
  }
});

/* ─── Confirm paid ─── */
document.getElementById("confirmPaidBtn").addEventListener("click", async () => {
  const total   = cartTotal();
  const msgEl   = document.getElementById("payMsg");
  if (total <= 0) { flash(msgEl, "Your order is empty — add something above first.", false); return; }
  const name    = document.getElementById("payName").value.trim();
  const contact = document.getElementById("payContact").value.trim();
  if (!contact) { flash(msgEl, "Please add a contact number so we can confirm your payment.", false); return; }

  try {
    await addOrder({
      type: "payment", school: name, place: "", contact,
      amount: total, status: "pending",
      details: { items: cart.map(c => ({ label: c.label, price: c.price })) }
    });
    flash(msgEl, "✓ Thanks! We've logged your payment as pending — our team will confirm it shortly.", true);
    cart = [];
    renderCart();
  } catch {
    flash(msgEl, "Couldn't reach the server — please try again.", false);
  }
});

init();
