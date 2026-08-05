import { createClient } from '@supabase/supabase-js';

// Ces valeurs sont publiques et sans danger à exposer dans le code frontend,
// car la sécurité réelle est assurée par les policies RLS de Supabase.
const supabaseUrl = 'https://fyxzxjlldbnftbbhiosm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eHp4amxsZGJuZnRiYmhpb3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MTkwNzIsImV4cCI6MjEwMTI5NTA3Mn0.jISYA4NHiYLIOz5OQL74bu_Cjdch-Sqtx2AIiHw2ZKw';

export const supabase = createClient(supabaseUrl, supabaseKey);
