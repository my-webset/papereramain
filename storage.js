/* Supabase RPC & REST Client for Paperera.
   All passwords are encrypted with pgcrypto on Supabase.
   No credentials or business records are cached in browser localStorage. */

const PAPERERA = window.PAPERERA_CONFIG || {
  supabaseUrl: 'https://eiajcoohmgkqjvhkqdud.supabase.co',
  supabaseAnonKey: 'sb_publishable_TEK_L-11CvV2PaOW-l19ng_x9v7CE4y'
};
let currentAdmin = null;
let currentWorker = null;

const cleanUrl = () => (PAPERERA.supabaseUrl || '').replace(/\/$/, '');
const getConfigDiagnostics = () => {
  const url = (PAPERERA.supabaseUrl || '').trim();
  const anonKey = (PAPERERA.supabaseAnonKey || '').trim();
  const missing = [];

  if (!url) missing.push('supabaseUrl');
  if (!anonKey) missing.push('supabaseAnonKey');

  return {
    url,
    anonKeyPresent: Boolean(anonKey),
    hasPlaceholder: url.includes('YOUR_') || url.includes('your_'),
    missing
  };
};

const configured = () => {
  const d = getConfigDiagnostics();
  return !!(d.url && d.anonKeyPresent && !d.hasPlaceholder);
};
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

async function rpc(functionName, params = {}) {
  if (!configured()) {
    const d = getConfigDiagnostics();
    console.error('Supabase config diagnostics:', d);
    const detail = d.missing.length ? `Missing: ${d.missing.join(', ')}.` : '';
    const placeholder = d.hasPlaceholder ? 'URL still contains a placeholder.' : '';
    const message = `Supabase is not configured. Please check config.js. ${detail} ${placeholder}`.trim();
    throw new Error(message);
  }
  const res = await fetch(`${cleanUrl()}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'apikey': PAPERERA.supabaseAnonKey,
      'Authorization': `Bearer ${PAPERERA.supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.hint || `Request failed (${res.status})`);
  }
  return data;
}

// Authentication RPCs
async function adminLogin(username, password) {
  const res = await rpc('admin_login', { p_username: username, p_password: password });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Invalid Admin ID or password.');
  }
  currentAdmin = res.admin;
  return currentAdmin;
}

async function workerLogin(workerCode, password) {
  const res = await rpc('worker_login', { p_worker_code: workerCode, p_password: password });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Invalid Worker ID or password.');
  }
  currentWorker = res.worker;
  return currentWorker;
}

function adminLogout() {
  currentAdmin = null;
}

function workerLogout() {
  currentWorker = null;
}

// Admin Operations
async function getAdminData() {
  return await rpc('get_admin_dashboard');
}

async function adminCreateWorker({ worker_code, full_name, password, role }) {
  const res = await rpc('admin_create_worker', {
    p_worker_code: worker_code,
    p_full_name: full_name,
    p_password: password,
    p_role: role || 'sales'
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to create worker.');
  }
  return res.worker;
}

async function adminUpdateWorkerPassword(workerId, newPassword) {
  const res = await rpc('admin_update_worker_password', {
    p_worker_id: workerId,
    p_new_password: newPassword
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to update password.');
  }
  return res;
}

async function adminChangeOwnPassword(username, oldPassword, newPassword) {
  const res = await rpc('admin_change_own_password', {
    p_username: username,
    p_old_password: oldPassword,
    p_new_password: newPassword
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to change password.');
  }
  return res;
}

async function adminSetPaymentStatus(clientId, status, amount = 0) {
  const res = await rpc('admin_set_payment_status', {
    p_client_id: clientId,
    p_status: status,
    p_amount: Number(amount) || 0
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to update payment status.');
  }
  return res;
}

async function adminSetInquiryPaymentStatus(inquiryId, status) {
  const res = await rpc('admin_set_inquiry_payment_status', {
    p_inquiry_id: inquiryId,
    p_status: status
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to update inquiry payment status.');
  }
  return res;
}

async function adminSetWorkerTarget({ worker_id, daily_target_count, daily_target_amount, weekly_target_count, weekly_target_amount, note }) {
  const res = await rpc('admin_set_worker_target', {
    p_worker_id: worker_id,
    p_daily_count: Number(daily_target_count) || 0,
    p_daily_amount: Number(daily_target_amount) || 0,
    p_weekly_count: Number(weekly_target_count) || 0,
    p_weekly_amount: Number(weekly_target_amount) || 0,
    p_note: note || ''
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to save targets.');
  }
  return res;
}

async function adminUpdateSettings(settings) {
  const res = await rpc('admin_update_settings', { p_settings: settings });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to update settings.');
  }
  return res;
}

async function adminConvertInquiryToClient(inquiryId, workerId = null, serviceType = 'basic_site') {
  const res = await rpc('admin_convert_inquiry_to_client', {
    p_inquiry_id: inquiryId,
    p_worker_id: workerId,
    p_service_type: serviceType
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to convert inquiry.');
  }
  return res;
}

// Worker Operations
async function getWorkerData(workerId) {
  return await rpc('get_worker_dashboard', { p_worker_id: workerId });
}

async function workerSubmitLead({ worker_id, school_name, city, contact_name, contact_phone, contact_email, service_type, notes }) {
  const res = await rpc('worker_submit_lead', {
    p_worker_id: worker_id,
    p_school_name: school_name,
    p_city: city || '',
    p_contact_name: contact_name || '',
    p_contact_phone: contact_phone,
    p_contact_email: contact_email || '',
    p_service_type: service_type || 'basic_site',
    p_notes: notes || ''
  });
  if (!res || !res.success) {
    throw new Error(res?.error || 'Failed to submit lead.');
  }
  return res;
}

// Public Operations (Website Home)
async function getPublicSettings() {
  try {
    return await rpc('get_app_settings');
  } catch (e) {
    console.warn('Using default settings fallback:', e);
    return {
      domain_base_price: 599,
      ai_paper_rate: 500,
      ai_paper_count_text: '50–60 papers',
      monthly_upkeep_rate: 500,
      ai_trial_enabled: true,
      ai_trial_price: 0,
      ai_trial_papers: '5 test question papers'
    };
  }
}

async function submitInquiry(inquiryData) {
  if (!configured()) throw new Error('Online requests are not configured.');
  const request = payload => fetch(`${cleanUrl()}/rest/v1/inquiries`, {
    method: 'POST',
    headers: {
      'apikey': PAPERERA.supabaseAnonKey,
      'Authorization': `Bearer ${PAPERERA.supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  let res = await request(inquiryData);
  let data = await res.json().catch(() => null);

  // Keep submissions working until an existing Supabase project runs the total_amount migration.
  if (!res.ok && ['42703', '42501'].includes(data?.code) && Object.prototype.hasOwnProperty.call(inquiryData, 'total_amount')) {
    const { total_amount, ...legacyPayload } = inquiryData;
    res = await request(legacyPayload);
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    if (data?.code === '42501') {
      throw new Error('Homepage orders are temporarily unavailable. Please run the inquiries RLS policy migration in Supabase.');
    }
    throw new Error(data?.message || 'Could not submit inquiry.');
  }
  return data;
}
