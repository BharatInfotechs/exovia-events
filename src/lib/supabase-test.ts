
import { supabase } from './supabase';

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Supabase connection/query failed:', error.message);
    return false;
  }

  console.log('Supabase connection successful!');
  console.log('Events query result:', data);

  return true;
}
