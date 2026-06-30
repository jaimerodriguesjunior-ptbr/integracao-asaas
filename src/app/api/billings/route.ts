import { NextRequest, NextResponse } from "next/server";

import { authenticateApiClient } from "@/lib/auth";
import { createBillingForClient, validateCreateBillingInput } from "@/lib/billings";
import { badRequest, internalError, unauthorized } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const client = await authenticateApiClient(request);
    const body = await request.json();
    const input = validateCreateBillingInput(body);
    const billing = await createBillingForClient(client, input);

    return NextResponse.json(billing, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("Missing x-client-key") || message.startsWith("Invalid API client")) {
      return unauthorized(message);
    }

    if (
      message.includes("Request body") ||
      message.includes("Provide customerId") ||
      message.includes("billingType") ||
      message.includes("tenant.") ||
      message.includes("amount") ||
      message.includes("dueDate") ||
      message.includes("customer.name")
    ) {
      return badRequest(message);
    }

    return internalError(message);
  }
}
