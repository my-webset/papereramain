// Worker-ID login. Password verification happens through Supabase Auth,
// which stores passwords as hashes; this function never stores or returns a password.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { worker_code, password } = await req.json();
  if (!worker_code || !password) return Response.json({ error: 'Worker ID and password are required.' }, { status: 400 });
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, serviceKey);
  const { data: person } = await admin.from('profiles').select('id,active,is_admin').eq('worker_code', worker_code.toUpperCase()).maybeSingle();
  if (!person || !person.active || person.is_admin) return Response.json({ error: 'Worker ID or password is incorrect.' }, { status: 401 });
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(person.id);
  if (userError || !userData.user?.email) return Response.json({ error: 'Worker account is unavailable.' }, { status: 401 });
  const auth = createClient(url, anonKey);
  const { data, error } = await auth.auth.signInWithPassword({ email: userData.user.email, password });
  if (error || !data.session) return Response.json({ error: 'Worker ID or password is incorrect.' }, { status: 401 });
  return Response.json(data.session);
});
