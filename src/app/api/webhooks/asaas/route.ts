import { NextRequest, NextResponse } from "next/server";

import { getRequiredEnv } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { badRequest, unauthorized } from "@/lib/http";
import { getSupabaseClient } from "@/lib/supabase";

type AsaasWebhookBody = {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
  };
  paymentId?: string;
  id?: string;
};

function extractWebhookToken(request: NextRequest, body: unknown) {
  return (
    request.headers.get("asaas-access-token") ||
    request.headers.get("x-asaas-access-token") ||
    (body && typeof body === "object" && "token" in body && typeof body.token === "string" ? body.token : null)
  );
}

function extractPaymentId(body: AsaasWebhookBody) {
  return body.payment?.id || body.paymentId || body.id || null;
}

function extractStatus(body: AsaasWebhookBody) {
  return body.payment?.status || null;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  const body = (await request.json()) as AsaasWebhookBody;
  const webhookToken = extractWebhookToken(request, body);
  const expectedWebhookToken = getRequiredEnv("ASAAS_WEBHOOK_TOKEN");

  if (!webhookToken || !safeEqual(webhookToken, expectedWebhookToken)) {
    return unauthorized("Invalid Asaas webhook token.");
  }

  const paymentId = extractPaymentId(body);

  if (!paymentId) {
    return badRequest("Webhook payload does not include a payment id.");
  }

  const { data: billing, error: billingError } = await supabase
    .from("billings")
    .select("id, client_id, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (billingError) {
    return NextResponse.json({ error: billingError.message }, { status: 500 });
  }

  const eventType = body.event ?? "UNKNOWN";

  await supabase.from("billing_events").insert({
    billing_id: billing?.id ?? null,
    asaas_event_id: `${eventType}:${paymentId}`,
    event_type: eventType,
    payload: body
  });

  if (!billing) {
    return NextResponse.json({ ok: true, ignored: true, reason: "billing not found" }, { status: 202 });
  }

  const nextStatus = extractStatus(body);

  const { error: updateError } = await supabase
    .from("billings")
    .update({
      status: nextStatus ?? billing.status,
      last_webhook_at: new Date().toISOString(),
      asaas_response: body
    })
    .eq("id", billing.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: client, error: clientError } = await supabase
    .from("api_clients")
    .select("webhook_url")
    .eq("id", billing.client_id)
    .single();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const payloadToClient = {
    source: "nuvem-local-cobranca",
    event: eventType,
    billingId: billing.id,
    asaasPaymentId: paymentId,
    status: nextStatus
  };

  let deliveryStatus = "FAILED";
  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const clientResponse = await fetch(client.webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payloadToClient),
      cache: "no-store"
    });

    deliveryStatus = clientResponse.ok ? "DELIVERED" : "FAILED";
    statusCode = clientResponse.status;
    responseBody = await clientResponse.text();
  } catch (error) {
    responseBody = error instanceof Error ? error.message : "Unknown webhook delivery error";
  }

  await supabase.from("webhook_deliveries").insert({
    billing_id: billing.id,
    target_url: client.webhook_url,
    attempt: 1,
    delivery_status: deliveryStatus,
    status_code: statusCode,
    response_body: responseBody,
    request_payload: payloadToClient,
    delivered_at: deliveryStatus === "DELIVERED" ? new Date().toISOString() : null,
    next_retry_at: deliveryStatus === "DELIVERED" ? null : new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });

  return NextResponse.json({ ok: true, delivered: deliveryStatus === "DELIVERED" });
}
