import { createClient } from "@supabase/supabase-js";

import { getRequiredEnv } from "@/lib/env";

export function getSupabaseClient() {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getRequiredEnv("SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
