import { createClient } from '@supabase/supabase-js';

// Ces valeurs sont publiques et sans danger à exposer dans le code frontend,
// car la sécurité réelle est assurée par les policies RLS de Supabase.
const supabaseUrl = 'https://fyxzxjlldbnftbbhiosm.supabase.co';
const supabaseKey = 'sb_publishable_v_Ih3PaQd3m3dW9pT0TmqQ_nwWBgm8q';

export const supabase = createClient(supabaseUrl, supabaseKey);
