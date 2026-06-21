import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,       // Força a sessão a ficar salva
    autoRefreshToken: true,     // Atualiza o token sozinho se expirar
    detectSessionInUrl: true    // Evita conflitos de redirecionamento
  }
});