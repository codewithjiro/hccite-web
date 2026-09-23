import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { lookupCrossrefDoi, searchCrossrefTitle } from "~/server/discovery/providers/crossref";
import { getErrorResponse, ProviderError } from "~/server/discovery/providers/shared";

const schema = z.object({ mode: z.enum(["doi", "title"]), q: z.string().trim().min(1).max(500) });
export async function GET(request: Request) {
  await requireUserId();
  const params = new URL(request.url).searchParams;
  const parsed = schema.safeParse({ mode: params.get("mode"), q: params.get("q") });
  if (!parsed.success) return NextResponse.json({ error: { provider: "crossref", code: "invalid_input", message: "Enter a DOI or title to look up.", retryable: false } }, { status: 400 });
  try {
    if (parsed.data.mode === "doi") return NextResponse.json(await lookupCrossrefDoi(parsed.data.q));
    return NextResponse.json(await searchCrossrefTitle(parsed.data.q));
  } catch (error) {
    const body = getErrorResponse(error);
    const code = error instanceof ProviderError ? error.code : "unknown";
    const status = code === "invalid_input" ? 400 : code === "missing_credentials" ? 503 : code === "not_found" ? 404 : code === "unknown" ? 500 : 502;
    return NextResponse.json(body, { status });
  }
}
