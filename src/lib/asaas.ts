import { getRequiredEnv } from "@/lib/env";

type AsaasCustomerPayload = {
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

type CreateBillingPayload = {
  customerId?: string;
  customer?: AsaasCustomerPayload;
  billingType: "BOLETO" | "PIX" | "UNDEFINED";
  amount: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
};

async function asaasFetch<T>(path: string, init: RequestInit): Promise<T> {
  const asaasApiUrl = getRequiredEnv("ASAAS_API_URL");
  const asaasApiKey = getRequiredEnv("ASAAS_API_KEY");

  const response = await fetch(`${asaasApiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: asaasApiKey,
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  const data = (await response.json()) as T & {
    errors?: Array<{ code: string; description: string }>;
  };

  if (!response.ok) {
    const message = data.errors?.map((item) => `${item.code}: ${item.description}`).join("; ");
    throw new Error(message || `Asaas request failed with status ${response.status}`);
  }

  return data;
}

export async function createAsaasCustomer(payload: AsaasCustomerPayload) {
  return asaasFetch<{ id: string; name: string }>("/customers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createAsaasBilling(payload: CreateBillingPayload) {
  const customerId = payload.customerId || (payload.customer ? (await createAsaasCustomer(payload.customer)).id : null);

  if (!customerId) {
    throw new Error("Missing customerId or customer payload.");
  }

  return asaasFetch<{
    id: string;
    status: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    pixTransaction?: {
      qrCode?: string;
      payload?: string;
    };
  }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: payload.billingType,
      value: payload.amount,
      dueDate: payload.dueDate,
      description: payload.description,
      externalReference: payload.externalReference
    })
  });
}
