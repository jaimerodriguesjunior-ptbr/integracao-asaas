import { NextRequest } from "next/server";

import { safeEqual, sha256 } from "@/lib/crypto";
import { getSupabaseClient } from "@/lib/supabase";

export type ApiClient = {
  id: string;
  client_key: string;
  client_secret_hash: string;
  name: string;
  webhook_url: string;
  active: boolean;
};

export async function authenticateApiClient(request: NextRequest): Promise<ApiClient> {
  const supabase = getSupabaseClient();
  const clientKey = request.headers.get("x-client-key");
  const clientSecret = request.headers.get("x-client-secret");

  if (!clientKey || !clientSecret) {
    throw new Error("Missing x-client-key or x-client-secret header.");
  }

  const { data, error } = await supabase
    .from("api_clients")
    .select("id, client_key, client_secret_hash, name, webhook_url, active")
    .eq("client_key", clientKey)
    .eq("active", true)
    .maybeSingle<ApiClient>();

  if (error) {
    throw new Error(`Failed to load API client: ${error.message}`);
  }

  if (!data) {
    throw new Error("Invalid API client.");
  }

  const providedHash = sha256(clientSecret);

  if (!safeEqual(providedHash, data.client_secret_hash)) {
    throw new Error("Invalid API client secret.");
  }

  return data;
}
