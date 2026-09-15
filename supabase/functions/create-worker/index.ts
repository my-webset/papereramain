// Deploy with: supabase functions deploy create-worker
// Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the function's secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') || '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);
  const token = auth.replace('Bearer ', '');
  const { data: { user } } = await admin.auth.getUser(token);
  const { data: caller } = user ? await admin.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
  if (!caller?.is_admin) return Response.json({ error: 'Admin access required.' }, { status: 403 });
  const body = await req.json();
  if (!body.password || !body.full_name || !body.role) return Response.json({ error: 'Name, password and role are required.' }, { status: 400 });
  const worker_code = `WKR-${String(Date.now()).slice(-6)}`;
  // A private system email lets workers sign in with their ID instead of a personal Gmail address.
  const internalEmail = `${worker_code.toLowerCase()}@workers.paperera.local`;
  const { data, error } = await admin.auth.admin.createUser({ email: internalEmail, password: body.password, email_confirm: true, user_metadata: { full_name: body.full_name } });
  if (error || !data.user) return Response.json({ error: error?.message || 'Could not create user.' }, { status: 400 });
  const { error: profileError } = await admin.from('profiles').update({ full_name: body.full_name, role: body.role, worker_code, active: true }).eq('id', data.user.id);
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  return Response.json({ worker_code, id: data.user.id });
});
