import { NextRequest, NextResponse } from "next/server";

import { authenticateApiClient } from "@/lib/auth";
import { badRequest, internalError, unauthorized } from "@/lib/http";
import { calculateStoreBillingSnapshotWithPayment, upsertClientStore, validateStoreUpsertInput } from "@/lib/store-billing";

export async function POST(request: NextRequest) {
  try {
    const client = await authenticateApiClient(request);
    const body = await request.json();
    const input = validateStoreUpsertInput(body);
    const store = await upsertClientStore(client, input);

    return NextResponse.json(await calculateStoreBillingSnapshotWithPayment(store), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("Missing x-client-key") || message.startsWith("Invalid API client")) {
      return unauthorized(message);
    }

    if (
      message.includes("Request body") ||
      message.includes("storeId") ||
      message.includes("storeName") ||
      message.includes("monthlyAmount") ||
      message.includes("graceDays")
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
}
