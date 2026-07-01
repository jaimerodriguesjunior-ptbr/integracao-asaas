import { NextRequest, NextResponse } from "next/server";

import { authenticateApiClient } from "@/lib/auth";
import { badRequest, internalError, unauthorized } from "@/lib/http";
import {
  calculateStoreBillingSnapshot,
  getClientStoreByExternalId,
  markStorePaidOneMonth
} from "@/lib/store-billing";

type RouteContext = {
  params: Promise<{
    storeId: string;
  }>;
};

async function readNotes(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  const body = (await request.json()) as { notes?: unknown };
  return typeof body.notes === "string" ? body.notes : null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const client = await authenticateApiClient(request);
    const { storeId } = await context.params;
    const store = await getClientStoreByExternalId(client, storeId);

    if (!store) {
      return badRequest("Store is not registered for this API client.");
    }

    const notes = await readNotes(request);
    const updatedStore = await markStorePaidOneMonth(store, notes);

    return NextResponse.json(calculateStoreBillingSnapshot(updatedStore));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.startsWith("Missing x-client-key") || message.startsWith("Invalid API client")) {
      return unauthorized(message);
    }

    return internalError(message);
  }
}
