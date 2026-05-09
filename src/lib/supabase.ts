import { createClient } from '@supabase/supabase-js';

// Busca as variáveis de ambiente do arquivo .env
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Inicializa o cliente do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
