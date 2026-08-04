import type { ApiClient } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { buildPixCopyPaste, buildPixQrCodeDataUrl, type PixSettings } from "@/lib/pix";
import { getSupabaseClient } from "@/lib/supabase";

export type StoreBillingStatus = "ativo" | "pendente" | "bloqueado" | "liberado" | "vip";

export type ClientStore = {
  id: string;
  client_id: string;
  store_id: string;
  store_name: string;
  store_document: string | null;
  monthly_amount: number;
  paid_until: string | null;
  grace_days: number;
  is_vip: boolean;
  manual_release_until: string | null;
  payment_qr_code: string | null;
  payment_copy_paste: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreBillingSnapshot = {
  store: ClientStore;
  status: StoreBillingStatus;
  effectiveAccessUntil: string | null;
  overdueSince: string | null;
  blockAfter: string | null;
  daysPastDue: number;
  daysUntilDue: number | null;
  paymentDueSoon: boolean;
  shouldShowBillingReminder: boolean;
  shouldBlockNewOperations: boolean;
  blockScope: "none" | "new_operations_only";
};

export type ClientStoreEvent = {
  id: string;
  client_store_id: string;
  event_type: string;
  previous_paid_until: string | null;
  next_paid_until: string | null;
  previous_release_until: string | null;
  next_release_until: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type StoreUpsertInput = {
  clientId?: string;
  storeId: string;
  storeName: string;
  storeDocument?: string | null;
  monthlyAmount?: number;
  paidUntil?: string | null;
  graceDays?: number;
  isVip?: boolean;
  manualReleaseUntil?: string | null;
  paymentQrCode?: string | null;
  paymentCopyPaste?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type GatewayPixSettings = PixSettings & {
  id: string;
  created_at: string;
  updated_at: string;
};

type PixSettingsUpsertInput = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  description?: string | null;
  txidPrefix?: string | null;
  active?: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function todayUtc() {
  return new Date(new Date().toISOString().slice(0, 10));
}

function parseDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string | null, days: number) {
  const base = parseDate(value) ?? todayUtc();
  base.setUTCDate(base.getUTCDate() + days);
  return formatDate(base);
}

function addMonths(value: string | null, months: number) {
  const base = parseDate(value) ?? todayUtc();
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return formatDate(target);
}

function isSameOrAfterToday(value: string | null) {
  const date = parseDate(value);
  return Boolean(date && date.getTime() >= todayUtc().getTime());
}

export function calculateStoreBillingSnapshot(store: ClientStore): StoreBillingSnapshot {
  const now = todayUtc();
  const paidUntil = parseDate(store.paid_until);
  const blockAfter = store.paid_until ? addDays(store.paid_until, store.grace_days) : null;
  const releaseIsValid = isSameOrAfterToday(store.manual_release_until);
  const paidIsValid = isSameOrAfterToday(store.paid_until);
  const isInsideGrace =
    Boolean(paidUntil) &&
    !paidIsValid &&
    Boolean(blockAfter) &&
    parseDate(blockAfter)!.getTime() >= now.getTime();

  let status: StoreBillingStatus = "pendente";

  if (store.is_vip) {
    status = "vip";
  } else if (releaseIsValid) {
    status = "liberado";
  } else if (paidIsValid) {
    status = "ativo";
  } else if (!store.paid_until) {
    status = "pendente";
  } else if (!isInsideGrace) {
    status = "bloqueado";
  }

  const daysPastDue = paidUntil ? Math.max(0, Math.floor((now.getTime() - paidUntil.getTime()) / DAY_IN_MS)) : 0;
  const daysUntilDue = paidUntil && paidIsValid ? Math.floor((paidUntil.getTime() - now.getTime()) / DAY_IN_MS) : null;
  const paymentDueSoon = status === "ativo" && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 2;
  const shouldBlockNewOperations = status === "bloqueado";

  return {
    store,
    status,
    effectiveAccessUntil:
      status === "vip" ? null : releaseIsValid ? store.manual_release_until : store.paid_until,
    overdueSince: paidUntil && !paidIsValid ? store.paid_until : null,
    blockAfter,
    daysPastDue,
    daysUntilDue,
    paymentDueSoon,
    shouldShowBillingReminder: paymentDueSoon || status === "pendente" || status === "bloqueado",
    shouldBlockNewOperations,
    blockScope: shouldBlockNewOperations ? "new_operations_only" : "none"
  };
}

export async function enrichStoreBillingSnapshotWithPayment(snapshot: StoreBillingSnapshot) {
  const pixSettings = await getGatewayPixSettings();
  const copyPaste =
    pixSettings
      ? buildPixCopyPaste({
          settings: pixSettings,
          amount: Number(snapshot.store.monthly_amount || 0),
          storeId: snapshot.store.store_id
        })
      : snapshot.store.payment_copy_paste;

  const qrCode = pixSettings ? await buildPixQrCodeDataUrl(copyPaste) : snapshot.store.payment_qr_code;

  return {
    ...snapshot,
    store: {
      ...snapshot.store,
      payment_copy_paste: copyPaste,
      payment_qr_code: qrCode
    }
  };
}

export async function calculateStoreBillingSnapshotWithPayment(store: ClientStore) {
  return enrichStoreBillingSnapshotWithPayment(calculateStoreBillingSnapshot(store));
}

export async function listClientStores() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("client_stores")
    .select("*, api_clients(name, client_key)")
    .order("store_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list stores: ${error.message}`);
  }

  return (data ?? []) as ClientStore[];
}

export async function listApiClients() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_clients")
    .select("id, client_key, name, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list API clients: ${error.message}`);
  }

  return data ?? [];
}

export async function getGatewayPixSettings() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("gateway_pix_settings")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<GatewayPixSettings>();

  if (error) {
    if (
      error.message.includes("gateway_pix_settings") ||
      error.message.includes("schema cache") ||
      error.code === "PGRST205"
    ) {
      return null;
    }

    throw new Error(`Failed to load Pix settings: ${error.message}`);
  }

  return data;
}

export async function upsertGatewayPixSettings(input: PixSettingsUpsertInput) {
  const supabase = getSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("gateway_pix_settings")
    .select("id")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (currentError) {
    throw new Error(`Failed to load current Pix settings: ${currentError.message}`);
  }

  const payload = {
    pix_key: input.pixKey,
    merchant_name: input.merchantName,
    merchant_city: input.merchantCity,
    description: input.description ?? null,
    txid_prefix: input.txidPrefix ?? null,
    active: input.active ?? true
  };

  const query = current
    ? supabase.from("gateway_pix_settings").update(payload).eq("id", current.id)
    : supabase.from("gateway_pix_settings").insert(payload);

  const { data, error } = await query.select("*").single<GatewayPixSettings>();

  if (error) {
    throw new Error(`Failed to save Pix settings: ${error.message}`);
  }

  const { error: clearPaymentError } = await supabase.from("client_stores").update({
    payment_copy_paste: null,
    payment_qr_code: null
  }).neq("id", "00000000-0000-0000-0000-000000000000");

  if (clearPaymentError) {
    throw new Error(`Failed to clear cached Pix data: ${clearPaymentError.message}`);
  }

  return data;
}

export async function createApiClient(input: {
  clientKey: string;
  clientSecret: string;
  name: string;
  webhookUrl: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_clients")
    .insert({
      client_key: input.clientKey,
      client_secret_hash: sha256(input.clientSecret),
      name: input.name,
      webhook_url: input.webhookUrl,
      active: true
    })
    .select("id, client_key, name, active")
    .single();

  if (error) {
    throw new Error(`Failed to create API client: ${error.message}`);
  }

  return data;
}

export async function listClientStoreEvents(storeIds: string[]) {
  if (!storeIds.length) {
    return [] as ClientStoreEvent[];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("client_store_events")
    .select("*")
    .in("client_store_id", storeIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list store events: ${error.message}`);
  }

  return (data ?? []) as ClientStoreEvent[];
}

export async function getClientStoreById(id: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("client_stores")
    .select("*")
    .eq("id", id)
    .maybeSingle<ClientStore>();

  if (error) {
    throw new Error(`Failed to load store: ${error.message}`);
  }

  return data;
}

export async function getClientStoreByExternalId(client: ApiClient, storeId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("client_stores")
    .select("*")
    .eq("client_id", client.id)
    .eq("store_id", storeId)
    .eq("active", true)
    .maybeSingle<ClientStore>();

  if (error) {
    throw new Error(`Failed to load store billing status: ${error.message}`);
  }

  return data;
}

export async function upsertClientStore(client: ApiClient, input: StoreUpsertInput) {
  return upsertClientStoreByClientId(client.id, input);
}

export async function upsertClientStoreByClientId(clientId: string, input: StoreUpsertInput) {
  const supabase = getSupabaseClient();
  const { data: previousStore } = await supabase
    .from("client_stores")
    .select("*")
    .eq("client_id", clientId)
    .eq("store_id", input.storeId)
    .maybeSingle<ClientStore>();

  const row = {
    client_id: clientId,
    store_id: input.storeId,
    store_name: input.storeName,
    store_document: input.storeDocument ?? null,
    monthly_amount: input.monthlyAmount ?? previousStore?.monthly_amount ?? 0,
    paid_until: input.paidUntil ?? previousStore?.paid_until ?? null,
    grace_days: input.graceDays ?? previousStore?.grace_days ?? 15,
    is_vip: input.isVip ?? previousStore?.is_vip ?? false,
    manual_release_until: input.manualReleaseUntil ?? previousStore?.manual_release_until ?? null,
    payment_qr_code: input.paymentQrCode ?? previousStore?.payment_qr_code ?? null,
    payment_copy_paste: input.paymentCopyPaste ?? previousStore?.payment_copy_paste ?? null,
    notes: input.notes ?? previousStore?.notes ?? null,
    active: input.active ?? previousStore?.active ?? true
  };

  const { data, error } = await supabase
    .from("client_stores")
    .upsert(row, { onConflict: "client_id,store_id" })
    .select("*")
    .single<ClientStore>();

  if (error) {
    throw new Error(`Failed to save store: ${error.message}`);
  }

  await supabase.from("client_store_events").insert({
    client_store_id: data.id,
    event_type: previousStore ? "store_updated" : "store_created",
    previous_paid_until: previousStore?.paid_until ?? null,
    next_paid_until: data.paid_until,
    previous_release_until: previousStore?.manual_release_until ?? null,
    next_release_until: data.manual_release_until,
    notes: data.notes ?? null,
    metadata: {
      monthly_amount: data.monthly_amount,
      grace_days: data.grace_days,
      is_vip: data.is_vip,
      active: data.active
    }
  });

  return data;
}

export async function markStorePaidOneMonth(store: ClientStore, notes?: string | null) {
  const supabase = getSupabaseClient();
  const nextPaidUntil = addMonths(store.paid_until, 1);

  const { data, error } = await supabase
    .from("client_stores")
    .update({
      paid_until: nextPaidUntil,
      notes: notes ?? store.notes,
      manual_release_until: null
    })
    .eq("id", store.id)
    .select("*")
    .single<ClientStore>();

  if (error) {
    throw new Error(`Failed to mark store as paid: ${error.message}`);
  }

  await supabase.from("client_store_events").insert({
    client_store_id: store.id,
    event_type: "paid_one_month",
    previous_paid_until: store.paid_until,
    next_paid_until: nextPaidUntil,
    previous_release_until: store.manual_release_until,
    next_release_until: null,
    notes: notes ?? null
  });

  return data;
}

export async function releaseStoreForThreeDays(store: ClientStore, notes?: string | null) {
  const supabase = getSupabaseClient();
  const baseReleaseUntil = isSameOrAfterToday(store.manual_release_until)
    ? store.manual_release_until
    : formatDate(todayUtc());
  const nextReleaseUntil = addDays(baseReleaseUntil, 3);

  const { data, error } = await supabase
    .from("client_stores")
    .update({
      manual_release_until: nextReleaseUntil,
      notes: notes ?? store.notes
    })
    .eq("id", store.id)
    .select("*")
    .single<ClientStore>();

  if (error) {
    throw new Error(`Failed to release store: ${error.message}`);
  }

  await supabase.from("client_store_events").insert({
    client_store_id: store.id,
    event_type: "manual_release_3_days",
    previous_paid_until: store.paid_until,
    next_paid_until: store.paid_until,
    previous_release_until: store.manual_release_until,
    next_release_until: nextReleaseUntil,
    notes: notes ?? null
  });

  return data;
}

export function validateStoreUpsertInput(body: unknown): StoreUpsertInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const input = body as Partial<StoreUpsertInput>;

  if (typeof input.storeId !== "string" || !input.storeId.trim()) {
    throw new Error("storeId is required.");
  }

  if (typeof input.storeName !== "string" || !input.storeName.trim()) {
    throw new Error("storeName is required.");
  }

  if (input.monthlyAmount !== undefined && (typeof input.monthlyAmount !== "number" || input.monthlyAmount < 0)) {
    throw new Error("monthlyAmount must be a positive number when provided.");
  }

  if (input.graceDays !== undefined && (!Number.isInteger(input.graceDays) || input.graceDays < 0)) {
    throw new Error("graceDays must be a positive integer when provided.");
  }

  return input as StoreUpsertInput;
}
