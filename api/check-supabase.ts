import { supabase, isSupabaseConfigured } from './supabase';

async function checkSupabaseConnection() {
  console.log('=== Supabase Connection & Data Check ===');
  console.log('Supabase Configured:', isSupabaseConfigured());
  console.log('Supabase URL:', process.env.SUPABASE_URL || 'https://exyhjkjgyiakccrlmpds.supabase.co (default)');

  if (!isSupabaseConfigured()) {
    console.log('\n[WARNING] Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are NOT set.');
    console.log('The API is currently running in fallback/mock mode.');
    console.log('To connect to Supabase, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment or .env file.');
    return;
  }

  try {
    console.log('\nQuerying taxonomies table from Supabase...');
    const { data: taxonomies, error: taxError } = await supabase.from('taxonomies').select('*').limit(5);
    if (taxError) throw taxError;
    console.log(`Success! Found ${taxonomies?.length || 0} taxonomies.`);

    console.log('\nQuerying publications table from Supabase...');
    const { data: publications, error: pubError } = await supabase.from('publications').select('id, title, status, updated_at').limit(5);
    if (pubError) throw pubError;
    console.log(`Success! Found ${publications?.length || 0} publications:`);
    console.table(publications);

    console.log('\n[OK] Supabase is successfully connected and serving data!');
  } catch (err: any) {
    console.error('\n[ERROR] Failed to query Supabase:', err.message || err);
  }
}

checkSupabaseConnection();
