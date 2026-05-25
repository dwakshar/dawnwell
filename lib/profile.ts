import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export async function bootstrapProfile(userId: string): Promise<void> {
  const { data, error: selectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) {
    logger.error('profile: select failed', selectError.message);
    return;
  }

  if (data) return;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, timezone });

  if (insertError) {
    logger.error('profile: insert failed', insertError.message);
  } else {
    logger.info('profile: created for', userId);
  }
}
