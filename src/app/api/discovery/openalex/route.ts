import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { searchOpenAlex } from "~/server/discovery/providers/openalex";
import { getErrorResponse, ProviderError } from "~/server/discovery/providers/shared";

const querySchema = z.object({ q: z.string().trim().min(2).max(500), page: z.coerce.number().int().min(1).max(500), yearFrom: z.coerce.number().int().min(1000).max(3000).optional(), openAccess: z.enum(["true", "false"]).optional() });
export async function GET(request: Request) {
  await requireUserId();
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ q: params.get("q"), page: params.get("page") ?? "1", yearFrom: params.get("yearFrom") ?? undefined, openAccess: params.get("openAccess") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: { provider: "openalex", code: "invalid_input", message: "Enter at least two characters and a valid page.", retryable: false } }, { status: 400 });
  try {
    const result = await searchOpenAlex(parsed.data.q, parsed.data.page, { yearFrom: parsed.data.yearFrom, openAccess: parsed.data.openAccess === undefined ? undefined : parsed.data.openAccess === "true" });
    return NextResponse.json(result);
  } catch (error) {
    const body = getErrorResponse(error);
    return NextResponse.json(body, { status: error instanceof ProviderError ? (error.code === "missing_credentials" || error.code === "invalid_credentials" ? 503 : error.code === "invalid_input" ? 400 : error.code === "not_found" ? 404 : 502) : 500 });
  }
}
