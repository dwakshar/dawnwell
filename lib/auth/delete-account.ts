/**
 * Delete account — client-side flow for account deletion.
 *
 * V1 LIMITATION: The auth.users row is NOT deleted from this client.
 * Supabase does not expose admin.deleteUser() to the anon key. The
 * app-schema data (rituals, habits, check_ins, sync_meta, profiles) is
 * fully removed via the delete_user_account() RPC, and pending_deletion_at
 * is stamped on the profiles row so a server-side cleanup job can finish
 * the auth.users delete in v1.1.
 *
 * Effect on re-sign-in: the email can still be used to sign in via magic
 * link. Supabase will create a new session for the same auth.users row.
 * The app will start fresh (zero habits) because all app-schema data was
 * cascade-deleted by the RPC. This is the expected v1 behavior.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/db/client';
import { checkIns, habits, rituals } from '@/db/schema';
import { cancelAllReminders } from '@/lib/notifications';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

export async function deleteAccount(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Not authenticated');

  // Step 1: RPC cascades all app-schema rows (SECURITY DEFINER so it bypasses
  // RLS, but auth.uid() check inside the function guards against unauthed calls).
  // Cast to untyped client because delete_user_account() is not yet in the
  // generated database.types.ts — regenerate after running migration 0004.
  const { error: rpcError } = await (supabase as SupabaseClient).rpc('delete_user_account');
  if (rpcError) throw rpcError;

  // Step 2: Sign out from Supabase auth (clears session, does NOT delete auth.users)
  await supabase.auth.signOut();

  // Step 3: Cancel all local scheduled notifications
  await cancelAllReminders();

  // Step 4: Wipe local SQLite — delete in reverse FK order to be explicit,
  // though PRAGMA foreign_keys=ON + CASCADE would handle it automatically.
  try {
    db.delete(checkIns).run();
    db.delete(habits).run();
    db.delete(rituals).run();
  } catch (e) {
    // Log but don't block — auth session and remote data are already gone.
    logger.error('deleteAccount: local SQLite wipe failed (non-fatal)', e);
  }

  // Step 5: Wipe MMKV — clears auth tokens, preferences, onboarding flag.
  // App will restart into onboarding on next launch.
  storage.clearAll();

  // Step 6: Update auth store state synchronously so listeners see the change
  useAuthStore.setState({
    session: null,
    user: null,
    status: 'unauthenticated',
    sendStatus: 'idle',
    sendError: null,
  });
}
