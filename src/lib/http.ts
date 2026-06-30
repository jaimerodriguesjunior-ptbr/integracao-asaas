import { NextResponse } from "next/server";

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function internalError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
