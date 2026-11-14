import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ownProfile, requireSupabase, supabase, type Profile } from '../lib/supabase/client';
export function useAuth() {
  const [user,setUser] = useState<User|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const refresh = async () => {
    try {
      const client = requireSupabase();
      const { data: { user: u } } = await client.auth.getUser();
      setUser(u);
      setProfile(u ? await ownProfile() : null);
    } catch(e) { setError((e as Error).message); setProfile(null); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refresh();
    const sub = supabase?.auth.onAuthStateChange(() => { setTimeout(() => { void refresh(); }, 0); });
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  return { user, profile, loading, error, refresh };
}
