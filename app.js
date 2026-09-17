/* Paperera Public Home Page: Dynamic pricing, individual domain rates, AI paper trial, order builder & lead submission */

let liveSettings = {
  domain_base_price: 599,
  domain_prices: {
    in: 599,
    com: 999,
    org: 899,
    co_in: 499,
    edu_in: 1199
  },
  ai_paper_rate: 500,
  ai_paper_count_text: '50–60 papers',
  monthly_upkeep_rate: 500,
  ai_trial_enabled: true,
  ai_trial_price: 0,
  ai_trial_papers: '5 test question papers'
};

const byId = id => document.getElementById(id);
const check = id => Boolean(byId(id)?.checked);

async function initHome() {
  try {
    const s = await getPublicSettings();
    if (s) {
      liveSettings = {
        ...liveSettings,
        ...s,
        domain_prices: {
          ...liveSettings.domain_prices,
          ...(s.domain_prices || {})
        }
      };
    }
  } catch (err) {
    console.warn('Using default settings fallback:', err);
  }

  // Update Hero Section
  const minDomainPrice = liveSettings.domain_prices?.in || liveSettings.domain_base_price || 599;
  if (byId('heroDomainFrom')) byId('heroDomainFrom').textContent = money(minDomainPrice);
  if (byId('heroPaperRate')) byId('heroPaperRate').textContent = money(liveSettings.ai_paper_rate);
  if (byId('heroPaperRange')) byId('heroPaperRange').textContent = liveSettings.ai_paper_count_text;
  if (byId('heroServiceRate')) byId('heroServiceRate').textContent = money(liveSettings.monthly_upkeep_rate);

  // Update Domain Section
  if (byId('domainPillPrice')) byId('domainPillPrice').textContent = `from ${money(minDomainPrice)}`;
  populateDomainExtensions();

  // Update AI Trial Section
  const trialBar = byId('trialToggleBar');
  if (trialBar) {
    if (!liveSettings.ai_trial_enabled) {
      trialBar.style.display = 'none';
      if (byId('trialBody')) byId('trialBody').style.display = 'none';
    } else {
      trialBar.style.display = 'flex';
      const trialPill = byId('trialPillPrice');
      if (trialPill) trialPill.textContent = liveSettings.ai_trial_price > 0 ? money(liveSettings.ai_trial_price) : 'Free Trial';
      if (byId('trialDescOut')) byId('trialDescOut').textContent = `${liveSettings.ai_trial_papers} generated`;
      if (byId('trialCostOut')) byId('trialCostOut').textContent = liveSettings.ai_trial_price > 0 ? money(liveSettings.ai_trial_price) : '₹0 (Free)';
    }
  }

  // Update AI Full Bundle Section
  if (byId('paperPillPrice')) byId('paperPillPrice').textContent = `${money(liveSettings.ai_paper_rate)} / ${liveSettings.ai_paper_count_text}`;
  if (byId('paperRateHint')) byId('paperRateHint').textContent = `Rate: ${money(liveSettings.ai_paper_rate)} = ${liveSettings.ai_paper_count_text}`;
  if (byId('pAmount')) {
    byId('pAmount').min = liveSettings.ai_paper_rate;
    byId('pAmount').step = liveSettings.ai_paper_rate;
  }

  // Update Monthly Upkeep Section
  if (byId('servicePillPrice')) byId('servicePillPrice').textContent = `${money(liveSettings.monthly_upkeep_rate)}/month`;

  setupEventListeners();
  calculateOrder();
}

function populateDomainExtensions() {
  const dExt = byId('dExt');
  const domainChips = byId('domainChips');
  const p = liveSettings.domain_prices || {};
  
  const list = [
    { ext: '.in', label: '.in (Recommended for Indian Schools)', shortLabel: '.in', price: Number(p.in) || 599 },
    { ext: '.com', label: '.com (Global Standard)', shortLabel: '.com', price: Number(p.com) || 999 },
    { ext: '.org', label: '.org (Non-Profit / Trust)', shortLabel: '.org', price: Number(p.org) || 899 },
    { ext: '.co.in', label: '.co.in (Commercial / Institutional)', shortLabel: '.co.in', price: Number(p.co_in) || 499 },
    { ext: '.edu.in', label: '.edu.in (Verified Educational Institution)', shortLabel: '.edu.in', price: Number(p.edu_in) || 1199 }
  ];

  if (dExt) {
    dExt.innerHTML = list.map(d => `<option value="${d.ext}" data-price="${d.price}">${d.label} — ${money(d.price)}</option>`).join('');
  }

  if (domainChips) {
    domainChips.innerHTML = list.map((d, i) => `
      <button type="button" class="preset-chip ${i === 0 ? 'active' : ''}" data-ext="${d.ext}" data-price="${d.price}">
        <strong>${d.shortLabel}</strong> &nbsp;${money(d.price)}
      </button>
    `).join('');

    domainChips.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        domainChips.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (dExt) {
          dExt.value = btn.dataset.ext;
        }
        calculateOrder();
      });
    });
  }
}

function setupEventListeners() {
  // Service toggle cards (Clicking anywhere on toggle bar or label)
  const toggles = [
    { bar: 'domainToggleBar', chk: 'chkDomain', body: 'domainBody', card: 'domainCard' },
    { bar: 'trialToggleBar', chk: 'chkTrial', body: 'trialBody', card: 'paperCard' },
    { bar: 'paperToggleBar', chk: 'chkPaper', body: 'paperBody', card: 'paperCard' },
    { bar: 'serviceToggleBar', chk: 'chkServices', body: 'servicesBody', card: 'serviceCard' }
  ];

  toggles.forEach(t => {
    const barEl = byId(t.bar);
    const chkEl = byId(t.chk);
    const bodyEl = byId(t.body);
    const cardEl = byId(t.card);

    function updateCardState() {
      if (bodyEl) {
        bodyEl.classList.toggle('disabled', !chkEl.checked);
      }
      if (cardEl) {
        if (t.card === 'domainCard') {
          cardEl.classList.toggle('service-selected', check('chkDomain'));
        } else if (t.card === 'paperCard') {
          cardEl.classList.toggle('service-selected', check('chkTrial') || check('chkPaper'));
        } else if (t.card === 'serviceCard') {
          cardEl.classList.toggle('service-selected', check('chkServices'));
        }
      }
      calculateOrder();
    }

    if (chkEl) {
      chkEl.addEventListener('change', updateCardState);
    }

    if (barEl) {
      barEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
        if (chkEl) {
          chkEl.checked = !chkEl.checked;
          updateCardState();
        }
      });
    }
  });

  // Dynamic domain changes
  byId('dExt')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const chips = byId('domainChips');
    if (chips) {
      chips.querySelectorAll('.preset-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.ext === val);
      });
    }
    calculateOrder();
  });

  byId('dWanted')?.addEventListener('input', calculateOrder);

  // AI Paper Presets & Steppers
  const paperPresets = byId('paperPresets');
  if (paperPresets) {
    paperPresets.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        paperPresets.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const amt = Number(btn.dataset.amount) || liveSettings.ai_paper_rate;
        if (byId('pAmount')) byId('pAmount').value = amt;
        calculateOrder();
      });
    });
  }

  byId('pAmount')?.addEventListener('input', () => {
    const val = Number(byId('pAmount').value);
    const paperPresets = byId('paperPresets');
    if (paperPresets) {
      paperPresets.querySelectorAll('.preset-chip').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.amount) === val);
      });
    }
    calculateOrder();
  });

  byId('btnPaperMinus')?.addEventListener('click', () => {
    const pInput = byId('pAmount');
    if (!pInput) return;
    const step = Number(liveSettings.ai_paper_rate) || 500;
    const current = Number(pInput.value) || step;
    if (current > step) {
      pInput.value = current - step;
      pInput.dispatchEvent(new Event('input'));
    }
  });

  byId('btnPaperPlus')?.addEventListener('click', () => {
    const pInput = byId('pAmount');
    if (!pInput) return;
    const step = Number(liveSettings.ai_paper_rate) || 500;
    const current = Number(pInput.value) || step;
    pInput.value = current + step;
    pInput.dispatchEvent(new Event('input'));
  });

  // Duration Presets & Steppers (Section 04)
  const durationChips = byId('durationChips');
  if (durationChips) {
    durationChips.querySelectorAll('.preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        durationChips.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const months = Number(btn.dataset.months) || 1;
        if (byId('sMonths')) byId('sMonths').value = months;
        calculateOrder();
      });
    });
  }

  byId('sMonths')?.addEventListener('input', () => {
    const val = Number(byId('sMonths').value);
    const durationChips = byId('durationChips');
    if (durationChips) {
      durationChips.querySelectorAll('.preset-chip').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.months) === val);
      });
    }
    calculateOrder();
  });

  byId('btnMonthMinus')?.addEventListener('click', () => {
    const mInput = byId('sMonths');
    if (!mInput) return;
    const current = Number(mInput.value) || 1;
    if (current > 1) {
      mInput.value = current - 1;
      mInput.dispatchEvent(new Event('input'));
    }
  });

  byId('btnMonthPlus')?.addEventListener('click', () => {
    const mInput = byId('sMonths');
    if (!mInput) return;
    const current = Number(mInput.value) || 1;
    if (current < 60) {
      mInput.value = current + 1;
      mInput.dispatchEvent(new Event('input'));
    }
  });

  // Website / School Branches Steppers
  byId('sSites')?.addEventListener('input', calculateOrder);

  byId('btnSiteMinus')?.addEventListener('click', () => {
    const sInput = byId('sSites');
    if (!sInput) return;
    const current = Number(sInput.value) || 1;
    if (current > 1) {
      sInput.value = current - 1;
      calculateOrder();
    }
  });

  byId('btnSitePlus')?.addEventListener('click', () => {
    const sInput = byId('sSites');
    if (!sInput) return;
    const current = Number(sInput.value) || 1;
    if (current < 20) {
      sInput.value = current + 1;
      calculateOrder();
    }
  });

  // Order submission
  byId('payNowBtn')?.addEventListener('click', handleOrderSubmission);

  // Payment modal close
  byId('closeModalBtn')?.addEventListener('click', () => {
    byId('payModalOverlay')?.classList.remove('open');
  });
}

function calculateOrder() {
  const items = [];
  let grandTotal = 0;

  // 1. Domain
  if (check('chkDomain')) {
    const extEl = byId('dExt');
    const selectedOpt = extEl?.options[extEl.selectedIndex];
    const price = Number(selectedOpt?.dataset.price) || liveSettings.domain_base_price || 599;
    const rawName = byId('dWanted')?.value.trim() || 'schoolname';
    const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '') + (extEl?.value || '.in');
    
    if (byId('domainNameOut')) byId('domainNameOut').textContent = cleanName;
    if (byId('domainPriceOut')) byId('domainPriceOut').textContent = money(price);

    items.push({ name: `Custom Domain Registration (${cleanName})`, price });
    grandTotal += price;
  }

  // 2. AI Trial
  if (check('chkTrial') && liveSettings.ai_trial_enabled) {
    const trialPrice = Number(liveSettings.ai_trial_price) || 0;
    items.push({ name: `AI Question Papers Trial (${liveSettings.ai_trial_papers})`, price: trialPrice });
    grandTotal += trialPrice;
  }

  // 3. AI Paper Bundle
  if (check('chkPaper')) {
    const baseRate = Number(liveSettings.ai_paper_rate) || 500;
    const amt = Math.max(Number(byId('pAmount')?.value) || baseRate, baseRate);
    const multiple = amt / baseRate;
    const countRange = `${Math.round(50 * multiple)}–${Math.round(60 * multiple)} papers`;

    if (byId('paperAmtOut')) byId('paperAmtOut').textContent = money(amt);
    if (byId('paperCountOut')) byId('paperCountOut').textContent = countRange;

    items.push({ name: `AI Papers Bundle (~${countRange})`, price: amt });
    grandTotal += amt;
  }

  // 4. Monthly Upkeep (first two months at full rate, then half rate)
  if (check('chkServices')) {
    const months = Math.max(Number(byId('sMonths')?.value) || 1, 1);
    const sites = Math.max(Number(byId('sSites')?.value) || 1, 1);
    const monthlyRate = Number(liveSettings.monthly_upkeep_rate) || 500;
    const fullRateMonths = Math.min(months, 2);
    const discountedMonths = Math.max(months - 2, 0);
    const pricePerSite = (fullRateMonths * monthlyRate) + (discountedMonths * monthlyRate / 2);
    const price = pricePerSite * sites;

    if (byId('serviceMonthsOut')) byId('serviceMonthsOut').textContent = `${months} month${months > 1 ? 's' : ''}`;
    if (byId('serviceSitesOut')) byId('serviceSitesOut').textContent = `${sites} website${sites > 1 ? 's' : ''}`;
    if (byId('servicesPriceOut')) byId('servicesPriceOut').textContent = money(price);

    items.push({ name: `Website Upkeep & Management (${months} mo × ${sites} site${sites > 1 ? 's' : ''})`, price });
    grandTotal += price;
  }

  // Render Order Summary List
  const cartList = byId('cartItemsList');
  if (cartList) {
    if (!items.length) {
      cartList.innerHTML = `<li class="empty">No services selected yet. Check items above to build your order.</li>`;
    } else {
      cartList.innerHTML = items.map(item => `
        <li>
          <span>${item.name}</span>
          <strong>${item.price > 0 ? money(item.price) : 'FREE'}</strong>
        </li>
      `).join('');
    }
  }

  if (byId('grandTotalOut')) byId('grandTotalOut').textContent = money(grandTotal);
  if (byId('btnPayAmount')) byId('btnPayAmount').textContent = money(grandTotal);

  return { items, grandTotal };
}

async function handleOrderSubmission() {
  const school = byId('mainSchool')?.value.trim();
  const phone = byId('mainContact')?.value.trim();
  const msg = byId('orderMsg');

  if (!school || !phone) {
    if (msg) {
      msg.textContent = 'Please enter your School Name and Contact Mobile Number in Section 01.';
      msg.className = 'msg show err';
    }
    byId('school-info')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const { items, grandTotal } = calculateOrder();
  if (!items.length) {
    if (msg) {
      msg.textContent = 'Please select at least one service or take the AI trial above.';
      msg.className = 'msg show err';
    }
    return;
  }

  try {
    byId('payNowBtn').disabled = true;
    if (msg) {
      msg.textContent = 'Submitting order...';
      msg.className = 'msg show';
    }

    const isTrial = check('chkTrial');
    const selectedServiceNames = items.map(i => i.name);

    await submitInquiry({
      school_name: school,
      city: byId('mainPlace')?.value.trim() || '',
      contact_name: byId('mainPerson')?.value.trim() || '',
      contact_phone: phone,
      contact_email: byId('mainEmail')?.value.trim() || '',
      requested_services: selectedServiceNames,
      total_amount: grandTotal,
      is_trial: isTrial,
      notes: byId('iNotes')?.value.trim() || ''
    });

    if (msg) {
      msg.textContent = '✓ Order registered successfully! Our site desk will confirm your setup.';
      msg.className = 'msg show ok';
    }

    // Show Payment Modal
    const modal = byId('payModalOverlay');
    if (modal) {
      byId('modalAmountOut').textContent = money(grandTotal);
      const upiId = '9979370684@fam';
      const payerName = 'Jaisingh Kushwaha';
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payerName)}&am=${grandTotal}&cu=INR&tn=Paperera_${encodeURIComponent(school.slice(0, 15))}`;
      
      if (byId('modalUpiOut')) byId('modalUpiOut').textContent = `UPI: ${upiId}`;
      if (byId('modalUpiBtn')) byId('modalUpiBtn').href = upiLink;
      
      const qrWrap = byId('modalQrWrap');
      if (qrWrap) {
        qrWrap.innerHTML = `<img src="./share_image4113068545197211153.gif" alt="UPI QR code for ${payerName}" style="max-width:100%; height:auto; border-radius:12px; background:#fff;">`;
      }

      modal.classList.add('open');
    }

  } catch (err) {
    if (msg) {
      msg.textContent = 'Error: ' + err.message;
      msg.className = 'msg show err';
    }
  } finally {
    byId('payNowBtn').disabled = false;
  }
}

// Copy UPI ID button in modal
byId('modalCopyUpiBtn')?.addEventListener('click', () => {
  const upiId = '9979370684@fam';
  navigator.clipboard.writeText(upiId).then(() => {
    alert(`UPI ID (${upiId}) copied to clipboard!`);
  }).catch(() => {
    prompt('Copy UPI ID:', upiId);
  });
});

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHome);
} else {
  initHome();
}


