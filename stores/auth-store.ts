import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { logger } from '@/lib/logger';
import { bootstrapProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
export type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

type AuthState = {
  session: Session | null;
  user: User | null;
  /** Lifecycle status of the session (used for layout gating and splash). */
  status: AuthStatus;
  /** Status of an in-flight magic-link send (used by sign-in screen). */
  sendStatus: SendStatus;
  sendError: string | null;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Restore session from MMKV and subscribe to future auth changes. Call once on mount. */
  initialize: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  status: 'idle',
  sendStatus: 'idle',
  sendError: null,

  signInWithMagicLink: async (email) => {
    set({ sendStatus: 'sending', sendError: null });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: 'dawnwell://auth/callback' },
      });
      if (error) throw error;
      set({ sendStatus: 'sent' });
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Something went wrong.';
      logger.error('signInWithMagicLink failed', raw);
      const msg = raw.toLowerCase().includes('rate limit')
        ? 'Too many emails sent. Wait a few minutes before trying again.'
        : raw;
      set({ sendStatus: 'error', sendError: msg });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, status: 'unauthenticated', sendStatus: 'idle', sendError: null });
  },

  initialize: async () => {
    set({ status: 'loading' });

    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } catch (e) {
      logger.error('auth.getSession failed', e instanceof Error ? e.message : String(e));
    }
    set({
      session,
      user: session?.user ?? null,
      status: session ? 'authenticated' : 'unauthenticated',
    });

    if (session?.user) {
      void bootstrapProfile(session.user.id);
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      const wasAuthenticated = nextSession !== null;
      set({
        session: nextSession,
        user: nextSession?.user ?? null,
        status: wasAuthenticated ? 'authenticated' : 'unauthenticated',
      });
      if (nextSession?.user) {
        void bootstrapProfile(nextSession.user.id);
      }
    });
  },
}));
