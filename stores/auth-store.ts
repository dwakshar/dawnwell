import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

type AuthStatus = 'idle' | 'sending' | 'sent' | 'error';

type AuthState = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  errorMessage: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  status: 'idle',
  errorMessage: null,

  sendMagicLink: async (email) => {
    if (!supabase) {
      set({ status: 'error', errorMessage: 'Auth not configured — add Supabase env vars.' });
      return;
    }
    set({ status: 'sending', errorMessage: null });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: 'dawnwell://auth/callback' },
      });
      if (error) throw error;
      set({ status: 'sent' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      logger.error('sendMagicLink failed', msg);
      set({ status: 'error', errorMessage: msg });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, user: null, status: 'idle', errorMessage: null });
  },

  hydrate: () => {
    if (!supabase) return;
    // Restore existing session from MMKV-backed storage
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null });
    });
    // Keep store in sync with all future auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },
}));
