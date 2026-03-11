import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxotrrlhwthyatnylhkb.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4b3Rycmxod3RoeWF0bnlsaGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTk1MjgsImV4cCI6MjA4ODc5NTUyOH0.tqT4R_Q7pXvIZED0sHCKTSfedhFZgfGLQ3NXJN9GSc8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
