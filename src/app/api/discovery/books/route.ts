import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { searchGoogleBooks } from "~/server/discovery/providers/google-books";
import { getErrorResponse, ProviderError } from "~/server/discovery/providers/shared";

const schema = z.object({ q: z.string().trim().min(2).max(500), startIndex: z.coerce.number().int().min(0).max(100_000), year: z.coerce.number().int().min(1000).max(new Date().getFullYear()).optional() });
export async function GET(request: Request) {
  await requireUserId();
  const params = new URL(request.url).searchParams;
  const parsed = schema.safeParse({ q: params.get("q"), startIndex: params.get("startIndex") ?? "0", year: params.has("year") ? params.get("year") : undefined });
  if (!parsed.success) return NextResponse.json({ error: { provider: "google_books", code: "invalid_input", message: "Enter at least two characters, a valid page, and a publication year from 1000 through the current year.", retryable: false } }, { status: 400 });
  try { return NextResponse.json(await searchGoogleBooks(parsed.data.q, parsed.data.startIndex, { year: parsed.data.year })); }
  catch (error) {
    const body = getErrorResponse(error);
    const code = error instanceof ProviderError ? error.code : "unknown";
    const status = code === "invalid_input" ? 400 : code === "missing_credentials" ? 503 : code === "not_found" ? 404 : code === "unknown" ? 500 : 502;
    return NextResponse.json(body, { status });
  }
}
