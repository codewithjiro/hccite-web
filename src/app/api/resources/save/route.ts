import { NextResponse } from "next/server";
import { requireUserId } from "~/server/auth";
import { discoverySaveLocatorSchema } from "~/server/discovery/locator";
import { saveDiscoveredResource } from "~/server/discovery/save";
import { getErrorResponse, ProviderError } from "~/server/discovery/providers/shared";

export async function POST(request: Request) {
  await requireUserId();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const parsed = discoverySaveLocatorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { provider: null, code: "invalid_input", message: "Enter a valid provider locator with no extra metadata.", retryable: false } }, { status: 400 });
  try {
    return NextResponse.json(await saveDiscoveredResource(parsed.data));
  } catch (error) {
    if (error instanceof ProviderError) {
      const status = error.code === "invalid_input" ? 400 : error.code === "not_found" ? 404 : error.code === "missing_credentials" ? 503 : error.code === "unknown" ? 500 : 502;
      return NextResponse.json(getErrorResponse(error), { status });
    }
    return NextResponse.json({ error: "The Resource could not be saved." }, { status: 500 });
  }
}
