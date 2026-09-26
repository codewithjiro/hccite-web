import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { searchOpenAlex } from "~/server/discovery/providers/openalex";
import { getErrorResponse, ProviderError } from "~/server/discovery/providers/shared";

const yearSchema = z.coerce.number().int().min(1000).max(new Date().getFullYear()).optional();
const querySchema = z.object({ q: z.string().trim().min(2).max(500), page: z.coerce.number().int().min(1).max(500), yearFrom: yearSchema, yearTo: yearSchema, openAccess: z.enum(["true", "false"]).optional() }).refine(({ yearFrom, yearTo }) => yearFrom === undefined || yearTo === undefined || yearFrom <= yearTo);
export async function GET(request: Request) {
  await requireUserId();
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ q: params.get("q"), page: params.get("page") ?? "1", yearFrom: params.get("yearFrom") ?? undefined, yearTo: params.get("yearTo") ?? undefined, openAccess: params.get("openAccess") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: { provider: "openalex", code: "invalid_input", message: "Enter a valid search and a year range from 1000 through the current year.", retryable: false } }, { status: 400 });
  try {
    const result = await searchOpenAlex(parsed.data.q, parsed.data.page, { yearFrom: parsed.data.yearFrom, yearTo: parsed.data.yearTo, openAccess: parsed.data.openAccess === undefined ? undefined : parsed.data.openAccess === "true" });
    return NextResponse.json(result);
  } catch (error) {
    const body = getErrorResponse(error);
    return NextResponse.json(body, { status: error instanceof ProviderError ? (error.code === "missing_credentials" || error.code === "invalid_credentials" ? 503 : error.code === "invalid_input" ? 400 : error.code === "not_found" ? 404 : 502) : 500 });
  }
}
