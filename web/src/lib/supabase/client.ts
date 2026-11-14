import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabaseConfig = { url: url || '', key: key || '' };
// Avoid fake test credentials. A missing config produces an explicit UI error.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase not configured: populate web/.env');
  return supabase;
}
export type Profile = {
  id: string; display_name: string; role: 'student' | 'university'; university_id: string | null;
  wallet_address: string | null; wallet_binding_signature: string | null; wallet_binding_challenge: string | null;
  encryption_public_key: JsonWebKey | null; encryption_key_binding_signature: string | null; encryption_key_binding_challenge: string | null;
};
export type University = { id: string; name: string; issuer_wallet: string; approved: boolean };
export type StudentRecord = { id: string; university_id: string; student_reference: string; student_name: string; claimed_by: string | null; created_at: string };
export type CredentialRow = {
  cert_id: string; university_id: string; student_record_id: string;
  holder_wallet: string; issuer_wallet: string; signed_credential_data: Record<string, unknown>;
  issuer_signature: string; pdf_sha256: string; credential_digest: string;
  issue_date: string; expiry_date: string | null; issuance_state: string;
  transaction_hash: string | null; block_number: number | null; revocation_transaction_hash: string | null;
  pdf_storage_path: string; encrypted_package_path: string | null;
};
export async function ownProfile(): Promise<Profile> {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('Please log in first');
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) throw new Error(error?.message || 'User profile not found');
  return data as Profile;
}
export async function edgeAction(action: string, body: Record<string, unknown> = {}) {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  const response = await fetch(`${supabaseConfig.url}/functions/v1/identity-api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseConfig.key,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ action, ...body })
  });
  const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(data.error || `Identity service HTTP ${response.status}`);
  return data;
}
