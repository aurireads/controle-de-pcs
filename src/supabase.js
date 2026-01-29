import { createClient } from '@supabase/supabase-js'

// 1. Sua URL (que montamos agora com o ID da foto)
const supabaseUrl = 'https://fledirsomtehxwyvlung.supabase.co'

// 2. Sua Chave (Pegue na outra foto, onde diz "Publishable key" e começa com "sb_publishable...")
const supabaseKey = 'sb_publishable_H9jMWuSN0y10JFkf2qxfNA_bCkHABBY'

export const supabase = createClient(supabaseUrl, supabaseKey)