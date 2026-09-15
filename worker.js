let workerData = {};
const $ = id => document.getElementById(id);
const esc = s => String(s || '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function say(id, text, isOk = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + (isOk ? 'ok' : 'err');
}

// 1. Worker Login
$('loginBtn').onclick = async () => {
  const code = $('workerCode').value.trim().toUpperCase();
  const password = $('password').value;

  if (!code || !password) {
    say('loginMsg', 'Enter your Worker ID and password.');
    return;
  }

  try {
    $('loginBtn').disabled = true;
    const worker = await workerLogin(code, password);
    $('loginWrap').style.display = 'none';
    $('workerShell').classList.add('show');
    $('workerIdentity').textContent = `${worker.full_name} · ${worker.worker_code} · ${worker.role.toUpperCase()}`;
    await render();
  } catch (err) {
    say('loginMsg', err.message);
  } finally {
    $('loginBtn').disabled = false;
  }
};

// 2. Logout & Refresh
$('logoutBtn').onclick = () => {
  workerLogout();
  location.reload();
};
$('refreshBtn').onclick = () => render();

// 3. Render Dashboard
async function render() {
  if (!currentWorker) return;
  try {
    workerData = await getWorkerData(currentWorker.id);
    const earnings = workerData.earnings || { total_earned: 0, awaiting_payment: 0 };
    const target = workerData.target || null;
    const settings = workerData.settings || {};
    const clients = workerData.clients || [];

    // Top Stat Cards
    $('statEarned').textContent = money(earnings.total_earned || 0);
    $('statAwaiting').textContent = money(earnings.awaiting_payment || 0);

    const dailyText = (target && target.daily_target_count > 0)
      ? `${target.daily_target_count} leads (${money(target.daily_target_amount)})`
      : 'Not set';
    const weeklyText = (target && target.weekly_target_count > 0)
      ? `${target.weekly_target_count} leads (${money(target.weekly_target_amount)})`
      : 'Not set';

    $('statTodayTarget').textContent = dailyText;
    $('statWeekTarget').textContent = weeklyText;

    // Target Card Details
    $('cardTodayTarget').textContent = dailyText;
    $('cardWeekTarget').textContent = weeklyText;

    if (target && target.note) {
      $('targetNoteBox').style.display = 'block';
      $('targetNoteBox').textContent = `Admin note: ${target.note}`;
    } else {
      $('targetNoteBox').style.display = 'none';
    }

    // Commission Rates and Counts
    $('commBasicRate').textContent = `${money(settings.worker_comm_basic_site || 100)} / close`;
    $('commAiRate').textContent = `${money(settings.worker_comm_ai_papers || 150)} / close`;
    $('commBothRate').textContent = `${money(settings.worker_comm_both || 250)} / close`;

    $('countBasicSite').textContent = earnings.basic_site_paid_count || 0;
    $('countAiPapers').textContent = earnings.ai_papers_paid_count || 0;
    $('countBoth').textContent = earnings.both_paid_count || 0;

    // Render My Leads Table
    renderMyLeads(clients);

  } catch (err) {
    alert('Failed to load worker workspace: ' + err.message);
  }
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

function renderMyLeads(clients) {
  if (!clients || !clients.length) {
    $('myLeadsTableBody').innerHTML = `<tr class="empty-row"><td colspan="6">You haven't submitted any school leads yet. Use the form above to add your first school lead!</td></tr>`;
    return;
  }

  $('myLeadsTableBody').innerHTML = clients.map(c => {
    const isPaid = c.payment_status === 'paid';
    const dateStr = c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
          ${c.contact_email ? `<br><small style="color:var(--ink-mute);">${esc(c.contact_email)}</small>` : ''}
        </td>
        <td>${serviceLabel(c.service_type)}</td>
        <td style="font-size:0.85rem; color:var(--ink-soft);">${dateStr}</td>
        <td>
          <span class="badge ${isPaid ? 'paid' : 'pending'}">
            ${isPaid ? '✓ Paid by Client' : '⏳ Payment Pending'}
          </span>
        </td>
        <td>
          ${isPaid 
            ? `<strong style="color:var(--green); font-size:1.05rem;">+${money(c.commission_earned)}</strong>`
            : `<span style="color:var(--ink-mute);">₹0 (Awaiting Payment)</span>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// 4. Submit Lead Handler
$('submitLeadBtn').onclick = async () => {
  const school_name = $('leadSchool').value.trim();
  const contact_phone = $('leadPhone').value.trim();

  if (!school_name || !contact_phone) {
    say('leadMsg', 'School name and contact mobile number are required.');
    return;
  }

  try {
    $('submitLeadBtn').disabled = true;
    await workerSubmitLead({
      worker_id: currentWorker.id,
      school_name,
      city: $('leadCity').value.trim(),
      contact_name: $('leadContactName').value.trim(),
      contact_phone,
      contact_email: $('leadEmail').value.trim(),
      service_type: $('leadService').value,
      notes: $('leadNotes').value.trim()
    });

    say('leadMsg', `✓ School lead "${school_name}" sent to Admin successfully!`, true);

    // Clear form inputs
    $('leadSchool').value = '';
    $('leadCity').value = '';
    $('leadContactName').value = '';
    $('leadPhone').value = '';
    $('leadEmail').value = '';
    $('leadNotes').value = '';

    await render();
  } catch (err) {
    say('leadMsg', err.message);
  } finally {
    $('submitLeadBtn').disabled = false;
  }
};
