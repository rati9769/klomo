import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Called on app launch AND transparently retried by getAccessToken() on
 * every authenticated API call. If there's no session yet, this creates an
 * anonymous Supabase session — a real auth.uid() with zero PII attached.
 * That's what lets the app work fully before anyone signs in: reports,
 * search history, everything just references this UUID.
 *
 * Retrying on every call (not just once at splash) matters: if the very
 * first attempt fails — a cold-start network hiccup, or the Supabase
 * project not having "Anonymous Sign-Ins" enabled yet — the app doesn't
 * stay permanently sessionless for the rest of the session; the next
 * screen that needs a token tries again.
 *
 * When the person later chooses to sign in with email/phone, use
 * supabase.auth.updateUser() / linkIdentity flows so the SAME uid is kept
 * and nothing they did anonymously is lost.
 */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // The single most common cause of a totally broken anonymous flow:
    // the Supabase project has "Anonymous Sign-Ins" turned off. Confirmed
    // error shape from Supabase: code 'anonymous_provider_disabled',
    // message "Anonymous sign-ins are disabled". Check both since the
    // code is more stable across supabase-js versions than message text.
    if (error.code === 'anonymous_provider_disabled' || /anonymous/i.test(error.message)) {
      throw new Error(
        'Anonymous sign-ins are disabled on this Supabase project. Fix: Supabase dashboard → Authentication → Providers → enable "Anonymous Sign-Ins".'
      );
    }
    throw error;
  }
  return anon.session;
}

export async function getAccessToken() {
  const session = await ensureSession();
  return session?.access_token ?? null;
}
