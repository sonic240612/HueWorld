import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export function subscribePixels(onPixel: (pixel: any) => void): () => void {
  if (!supabase) {
    console.log('Supabase not configured — skipping realtime subscription');
    return () => {};
  }

  const channel = supabase
    .channel('pixels-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pixels' },
      (payload) => {
        onPixel(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
