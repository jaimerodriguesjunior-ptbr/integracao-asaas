import { createAsaasBilling } from "@/lib/asaas";
import type { ApiClient } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export type CreateBillingInput = {
  customerId?: string;
  customer?: {
    name: string;
    cpfCnpj?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    externalReference?: string;
    notificationDisabled?: boolean;
  };
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  amount: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
};

export function validateCreateBillingInput(body: unknown): CreateBillingInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const input = body as Partial<CreateBillingInput>;

  if (!input.customerId && !input.customer) {
    throw new Error("Provide customerId or customer.");
  }

  if (input.customer && typeof input.customer.name !== "string") {
    throw new Error("customer.name is required when customer is provided.");
  }

  if (!input.billingType || !["BOLETO", "PIX", "UNDEFINED"].includes(input.billingType)) {
    throw new Error("billingType must be BOLETO, PIX or UNDEFINED.");
  }

  if (typeof input.amount !== "number" || input.amount <= 0) {
    throw new Error("amount must be a positive number.");
  }

  if (typeof input.dueDate !== "string") {
    throw new Error("dueDate must be a string in YYYY-MM-DD format.");
  }

  return input as CreateBillingInput;
}

export async function createBillingForClient(client: ApiClient, input: CreateBillingInput) {
  const supabase = getSupabaseClient();
  const asaasBilling = await createAsaasBilling(input);

  const billingRow = {
    client_id: client.id,
    asaas_payment_id: asaasBilling.id,
    external_reference: input.externalReference ?? null,
    status: asaasBilling.status,
    billing_type: input.billingType,
    amount: input.amount,
    due_date: input.dueDate,
    customer_name: input.customer?.name ?? null,
    customer_email: input.customer?.email ?? null,
    customer_phone: input.customer?.mobilePhone ?? input.customer?.phone ?? null,
    description: input.description ?? null,
    payload_original: input,
    asaas_response: asaasBilling
  };

  const { data, error } = await supabase
    .from("billings")
    .insert(billingRow)
    .select("id, asaas_payment_id, status")
    .single();

  if (error) {
    throw new Error(`Failed to persist billing: ${error.message}`);
  }

  return {
    billingId: data.id,
    asaasPaymentId: data.asaas_payment_id,
    status: data.status,
    invoiceUrl: asaasBilling.invoiceUrl ?? null,
    bankSlipUrl: asaasBilling.bankSlipUrl ?? null,
    pixQrCode: asaasBilling.pixTransaction?.qrCode ?? null,
    pixPayload: asaasBilling.pixTransaction?.payload ?? null
  };
}
