import { NextRequest, NextResponse } from "next/server";

import { authenticateApiClient } from "@/lib/auth";
import { internalError, unauthorized } from "@/lib/http";
import { calculateStoreBillingSnapshotWithPayment, getClientStoreByExternalId } from "@/lib/store-billing";

type RouteContext = {
  params: Promise<{
    storeId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const client = await authenticateApiClient(request);
    const { storeId } = await context.params;
    const store = await getClientStoreByExternalId(client, storeId);

    if (!store) {
      return NextResponse.json(
        {
          status: "bloqueado",
          reason: "store_not_registered",
          shouldShowBillingReminder: false,
          shouldBlockNewOperations: true,
          blockScope: "new_operations_only"
        },
        { status: 404 }
      );
    }

    return NextResponse.json(await calculateStoreBillingSnapshotWithPayment(store));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("Missing x-client-key") || message.startsWith("Invalid API client")) {
      return unauthorized(message);
    }

    return internalError(message);
  }
}
