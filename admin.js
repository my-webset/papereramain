let adminData = {};
const $ = id => document.getElementById(id);
const esc = s => String(s || '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function say(id, text, isOk = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + (isOk ? 'ok' : 'err');
}

// 1. Admin Login
$('loginBtn').onclick = async () => {
  const username = $('adminUsername').value.trim();
  const password = $('adminPassword').value;
  if (!username || !password) {
    say('loginMsg', 'Enter Admin ID and password.');
    return;
  }
  try {
    $('loginBtn').disabled = true;
    const admin = await adminLogin(username, password);
    $('loginWrap').style.display = 'none';
    $('adminShell').classList.add('show');
    $('adminSubtitle').textContent = `${admin.full_name || 'Admin'} (${admin.username})`;
    await render();
  } catch (err) {
    say('loginMsg', err.message);
  } finally {
    $('loginBtn').disabled = false;
  }
};

// 2. Admin Logout & Refresh
$('logoutBtn').onclick = () => {
  adminLogout();
  location.reload();
};
$('refreshBtn').onclick = () => render();

// 3. Change Admin Password
$('changeAdminPwdBtn').onclick = async () => {
  const oldPwd = prompt('Enter your CURRENT admin password:');
  if (!oldPwd) return;
  const newPwd = prompt('Enter your NEW admin password (minimum 4 characters):');
  if (!newPwd || newPwd.length < 4) {
    alert('Password must be at least 4 characters.');
    return;
  }
  try {
    await adminChangeOwnPassword(currentAdmin.username, oldPwd, newPwd);
    alert('Admin password changed successfully!');
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// 4. Main Render Function
async function render() {
  try {
    adminData = await getAdminData();
    const settings = adminData.settings || {};
    const stats = adminData.stats || {};
    const workers = adminData.workers || [];
    const clients = adminData.clients || [];
    const inquiries = adminData.inquiries || [];
    const domPrices = settings.domain_prices || { in: 599, com: 999, org: 899, co_in: 499, edu_in: 1199 };

    // Overview Stats
    $('statPaidRev').textContent = money(stats.paid_revenue || 0);
    $('statUnpaidCount').textContent = stats.unpaid_leads_count || 0;
    $('statWorkerCount').textContent = workers.filter(w => w.active).length;
    $('statInqCount').textContent = inquiries.length;
    if ($('navInqCount')) $('navInqCount').textContent = inquiries.length;

    // Domain Extension Pricing Inputs
    if ($('setDomainIn')) $('setDomainIn').value = domPrices.in || 599;
    if ($('setDomainCom')) $('setDomainCom').value = domPrices.com || 999;
    if ($('setDomainOrg')) $('setDomainOrg').value = domPrices.org || 899;
    if ($('setDomainCoin')) $('setDomainCoin').value = domPrices.co_in || 499;
    if ($('setDomainEduin')) $('setDomainEduin').value = domPrices.edu_in || 1199;

    // Homepage Pricing Inputs
    $('setUpkeepPrice').value = settings.monthly_upkeep_rate || 500;
    $('setPaperRate').value = settings.ai_paper_rate || 500;
    $('setPaperCountText').value = settings.ai_paper_count_text || '50–60 papers';
    $('setTrialEnabled').checked = settings.ai_trial_enabled !== false;
    $('setTrialPrice').value = settings.ai_trial_price || 0;
    $('setTrialPapers').value = settings.ai_trial_papers || '5 test question papers';

    // Worker Commission Inputs
    $('setCommBasic').value = settings.worker_comm_basic_site || 100;
    $('setCommAi').value = settings.worker_comm_ai_papers || 150;
    $('setCommBoth').value = settings.worker_comm_both || 250;

    // Worker Selectors
    const workerOptions = `<option value="">-- Choose Worker --</option>` +
      workers.filter(w => w.active).map(w => `<option value="${w.id}">${esc(w.full_name)} (${esc(w.worker_code)})</option>`).join('');
    $('targetWorkerSelect').innerHTML = workerOptions;

    const filterOptions = `<option value="all">All Workers (${clients.length} leads)</option>` +
      workers.map(w => `<option value="${w.id}">${esc(w.full_name)} (${esc(w.worker_code)})</option>`).join('');
    $('filterWorkerLeads').innerHTML = filterOptions;

    // Render Inquiries Table (Homepage client orders)
    renderInquiriesTable(inquiries, workers);

    // Render Worker Table
    renderWorkerTable(workers);

    // Render Leads Table
    renderLeadsTable(clients);

  } catch (err) {
    alert('Failed to load admin data: ' + err.message);
  }
}

function renderInquiriesTable(inquiries, workers) {
  const tbody = $('inquiriesTableBody');
  if (!tbody) return;

  if (!inquiries || !inquiries.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No direct homepage orders or inquiries submitted yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = inquiries.map(inq => {
    const dateStr = inq.created_at
      ? new Date(inq.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    let servicesHtml = '';
    if (Array.isArray(inq.requested_services)) {
      servicesHtml = inq.requested_services.map(s => `<span class="badge" style="margin:2px 2px 2px 0;">${esc(s)}</span>`).join('');
    } else {
      servicesHtml = `<span class="badge">${esc(inq.requested_services)}</span>`;
    }

    if (inq.is_trial) {
      servicesHtml += ` <span class="badge highlight">🎯 AI Trial</span>`;
    }

    return `
      <tr>
        <td>
          <strong>${esc(inq.school_name)}</strong>
          ${inq.city ? `<br><small style="color:var(--ink-soft);">${esc(inq.city)}</small>` : ''}
        </td>
        <td>
          ${inq.contact_name ? `<div>${esc(inq.contact_name)}</div>` : ''}
          <a href="tel:${esc(inq.contact_phone)}" style="font-weight:600; font-family:'IBM Plex Mono',monospace;">${esc(inq.contact_phone)}</a>
          ${inq.contact_email ? `<br><a href="mailto:${esc(inq.contact_email)}" style="font-size:0.8rem; color:var(--ink-soft);">${esc(inq.contact_email)}</a>` : ''}
        </td>
        <td>${servicesHtml || '<span style="color:var(--ink-mute);">General Inquiry</span>'}</td>
        <td>
          <strong>${money(inq.total_amount || 0)}</strong><br>
          <span class="badge ${inq.payment_status === 'paid' ? 'paid' : 'pending'}">
            ${inq.payment_status === 'paid' ? '✓ Paid' : '⏳ Unpaid'}
          </span>
        </td>
        <td style="max-width:240px; font-size:0.85rem;">${inq.notes ? esc(inq.notes) : '<span style="color:var(--ink-mute);">None</span>'}</td>
        <td style="font-size:0.82rem; color:var(--ink-soft); white-space:nowrap;">${dateStr}</td>
        <td>
          ${inq.payment_status === 'paid'
            ? `<button class="sm secondary" data-action="set-inq-unpaid" data-id="${inq.id}">Mark Unpaid</button>`
            : `<button class="sm gold" data-action="set-inq-paid" data-id="${inq.id}">Mark Paid</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

function renderWorkerTable(workers) {
  if (!workers || !workers.length) {
    $('workerTableBody').innerHTML = `<tr class="empty-row"><td colspan="7">No worker accounts created yet.</td></tr>`;
    return;
  }

  $('workerTableBody').innerHTML = workers.map(w => {
    const daily = w.daily_target_count > 0 ? `${w.daily_target_count} leads (${money(w.daily_target_amount)})` : '<span style="color:var(--ink-mute);">Not set</span>';
    const weekly = w.weekly_target_count > 0 ? `${w.weekly_target_count} leads (${money(w.weekly_target_amount)})` : '<span style="color:var(--ink-mute);">Not set</span>';
    const paidCount = w.paid_leads_count || 0;
    const unpaidCount = w.unpaid_leads_count || 0;

    return `
      <tr>
        <td><strong>${esc(w.full_name)}</strong></td>
        <td><span class="worker-id-pill">${esc(w.worker_code)}</span></td>
        <td><span class="badge">${esc(w.role)}</span></td>
        <td>${daily}</td>
        <td>${weekly}</td>
        <td><strong style="color:var(--green);">${paidCount} paid</strong> / <span style="color:var(--ink-mute);">${unpaidCount} pending</span></td>
        <td>
          <button class="sm secondary" data-action="reset-pwd" data-id="${w.id}" data-name="${esc(w.full_name)}">Reset Password</button>
        </td>
      </tr>
    `;
  }).join('');
}

function serviceLabel(type) {
  switch (type) {
    case 'basic_site': return '<span class="badge service">Website Upkeep</span>';
    case 'ai_papers': return '<span class="badge paper">AI Papers</span>';
    case 'both':
    case 'all': return '<span class="badge highlight">Full Suite (Site+AI)</span>';
    case 'domain': return '<span class="badge domain">Domain Only</span>';
    case 'trial': return '<span class="badge new">AI Free/Trial</span>';
    default: return `<span class="badge">${esc(type)}</span>`;
  }
}

function renderLeadsTable(clients) {
  const selectedWorkerId = $('filterWorkerLeads').value;
  const filtered = (selectedWorkerId && selectedWorkerId !== 'all')
    ? clients.filter(c => c.worker_id === selectedWorkerId)
    : clients;

  if (!filtered || !filtered.length) {
    $('leadsTableBody').innerHTML = `<tr class="empty-row"><td colspan="7">No school leads found.</td></tr>`;
    return;
  }

  $('leadsTableBody').innerHTML = filtered.map(c => {
    const isPaid = c.payment_status === 'paid';
    const workerInfo = c.worker_name
      ? `<strong>${esc(c.worker_name)}</strong><br><small class="worker-id-pill">${esc(c.worker_code)}</small>`
      : `<span style="color:var(--ink-mute); font-style:italic;">Direct / Website</span>`;

    const payoutInfo = isPaid
      ? `<strong style="color:var(--green);">${money(c.worker_commission)}</strong>`
      : `<span style="color:var(--ink-mute);">₹0 (Unpaid)</span>`;

    const toggleBtn = isPaid
      ? `<button class="sm secondary" data-action="set-unpaid" data-id="${c.id}">Mark Unpaid</button>`
      : `<button class="sm gold" data-action="set-paid" data-id="${c.id}">Mark as Paid</button>`;

    return `
      <tr>
        <td>
          <strong>${esc(c.school_name)}</strong>
          ${c.city ? `<br><small style="color:var(--ink-soft);">${esc(c.city)}</small>` : ''}
          ${c.notes ? `<br><small style="color:var(--ink-mute);">Note: ${esc(c.notes)}</small>` : ''}
        </td>
        <td>
          ${c.contact_name ? `<div>${esc(c.contact_name)}</div>` : ''}
          <a href="tel:${esc(c.contact_phone)}" style="font-weight:600; font-family:'IBM Plex Mono',monospace;">${esc(c.contact_phone)}</a>
        </td>
        <td>${serviceLabel(c.service_type)}</td>
        <td>${workerInfo}</td>
        <td>
          <span class="badge ${isPaid ? 'paid' : 'pending'}">${isPaid ? '✓ Paid' : '⏳ Unpaid'}</span>
          ${isPaid && c.paid_amount > 0 ? `<br><small>${money(c.paid_amount)}</small>` : ''}
        </td>
        <td>${payoutInfo}</td>
        <td>${toggleBtn}</td>
      </tr>
    `;
  }).join('');
}

// 5. Save Pricing & AI Trial Settings
$('savePricesBtn').onclick = async () => {
  try {
    $('savePricesBtn').disabled = true;
    const domPrices = {
      in: Number($('setDomainIn')?.value) || 599,
      com: Number($('setDomainCom')?.value) || 999,
      org: Number($('setDomainOrg')?.value) || 899,
      co_in: Number($('setDomainCoin')?.value) || 499,
      edu_in: Number($('setDomainEduin')?.value) || 1199
    };

    await adminUpdateSettings({
      domain_base_price: domPrices.in,
      domain_prices: domPrices,
      monthly_upkeep_rate: Number($('setUpkeepPrice').value) || 500,
      ai_paper_rate: Number($('setPaperRate').value) || 500,
      ai_paper_count_text: $('setPaperCountText').value.trim() || '50–60 papers',
      ai_trial_enabled: $('setTrialEnabled').checked,
      ai_trial_price: Number($('setTrialPrice').value) || 0,
      ai_trial_papers: $('setTrialPapers').value.trim() || '5 test question papers'
    });
    say('pricingMsg', 'Domain prices, upkeep, AI paper & trial settings saved! Homepage updated live.', true);
    await render();
  } catch (err) {
    say('pricingMsg', err.message);
  } finally {
    $('savePricesBtn').disabled = false;
  }
};

// 6. Save Commission Rates
$('saveCommsBtn').onclick = async () => {
  try {
    $('saveCommsBtn').disabled = true;
    await adminUpdateSettings({
      worker_comm_basic_site: Number($('setCommBasic').value) || 100,
      worker_comm_ai_papers: Number($('setCommAi').value) || 150,
      worker_comm_both: Number($('setCommBoth').value) || 250
    });
    say('commMsg', 'Worker commission payouts updated successfully.', true);
    await render();
  } catch (err) {
    say('commMsg', err.message);
  } finally {
    $('saveCommsBtn').disabled = false;
  }
};

// 7. Create Worker
$('createWorkerBtn').onclick = async () => {
  const full_name = $('newWorkerName').value.trim();
  const worker_code = $('newWorkerCode').value.trim().toUpperCase();
  const password = $('newWorkerPassword').value;
  const role = $('newWorkerRole').value;

  if (!full_name || !password) {
    say('createWorkerMsg', 'Worker name and password are required.');
    return;
  }
  if (password.length < 4) {
    say('createWorkerMsg', 'Password must be at least 4 characters.');
    return;
  }

  try {
    $('createWorkerBtn').disabled = true;
    const worker = await adminCreateWorker({ worker_code, full_name, password, role });
    say('createWorkerMsg', `Worker created! Worker ID: ${worker.worker_code}`, true);
    $('newWorkerName').value = '';
    $('newWorkerCode').value = '';
    $('newWorkerPassword').value = '';
    await render();
  } catch (err) {
    say('createWorkerMsg', err.message);
  } finally {
    $('createWorkerBtn').disabled = false;
  }
};

// 8. Save Daily & Weekly Targets
$('saveTargetBtn').onclick = async () => {
  const worker_id = $('targetWorkerSelect').value;
  if (!worker_id) {
    say('targetMsg', 'Select a worker first.');
    return;
  }

  try {
    $('saveTargetBtn').disabled = true;
    await adminSetWorkerTarget({
      worker_id,
      daily_target_count: Number($('targetDailyCount').value) || 0,
      daily_target_amount: Number($('targetDailyAmount').value) || 0,
      weekly_target_count: Number($('targetWeeklyCount').value) || 0,
      weekly_target_amount: Number($('targetWeeklyAmount').value) || 0,
      note: $('targetNote').value.trim()
    });
    say('targetMsg', 'Today & weekly targets dispatched to worker workspace.', true);
    await render();
  } catch (err) {
    say('targetMsg', err.message);
  } finally {
    $('saveTargetBtn').disabled = false;
  }
};

// 9. Filter Leads Handler
$('filterWorkerLeads').onchange = () => {
  renderLeadsTable(adminData.clients || []);
};

// 10. Inquiries Table Action Delegate (Payment Status)
const inqTable = $('inquiriesTableBody');
if (inqTable) {
  inqTable.onclick = async (e) => {
    const btn = e.target.closest('button[data-action^="set-inq-"]');
    if (!btn) return;
    const inqId = btn.dataset.id;
    const status = btn.dataset.action === 'set-inq-paid' ? 'paid' : 'unpaid';
    try {
      btn.disabled = true;
      await adminSetInquiryPaymentStatus(inqId, status);
      await render();
    } catch (err) {
      alert('Error updating inquiry payment: ' + err.message);
      btn.disabled = false;
    }
  };
}

// 11. Worker Action Delegate (Reset Password)
$('workerTableBody').onclick = async (e) => {
  const btn = e.target.closest('button[data-action="reset-pwd"]');
  if (!btn) return;
  const workerId = btn.dataset.id;
  const workerName = btn.dataset.name;

  const newPassword = prompt(`Set new password for ${workerName} (stored securely in Supabase):`);
  if (!newPassword) return;
  if (newPassword.length < 4) {
    alert('Password must be at least 4 characters.');
    return;
  }

  try {
    await adminUpdateWorkerPassword(workerId, newPassword);
    alert(`Password for ${workerName} updated successfully!`);
    await render();
  } catch (err) {
    alert('Error updating password: ' + err.message);
  }
};

// 12. Leads Table Action Delegate (Mark Paid / Unpaid)
$('leadsTableBody').onclick = async (e) => {
  const paidBtn = e.target.closest('button[data-action="set-paid"]');
  const unpaidBtn = e.target.closest('button[data-action="set-unpaid"]');

  if (paidBtn) {
    const clientId = paidBtn.dataset.id;
    const amountStr = prompt('Enter client invoice payment amount received (₹):', '500');
    if (amountStr === null) return;
    const amount = Number(amountStr) || 0;
    try {
      await adminSetPaymentStatus(clientId, 'paid', amount);
      await render();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (unpaidBtn) {
    const clientId = unpaidBtn.dataset.id;
    if (!confirm('Mark this school as Unpaid? Worker commission will revert to ₹0 until paid.')) return;
    try {
      await adminSetPaymentStatus(clientId, 'unpaid', 0);
      await render();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
};
