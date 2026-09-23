import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { citationStyleSchema, generateCitation } from "~/server/citation";
import { discoverySaveLocatorSchema } from "~/server/discovery/locator";
import { resolveDiscoveredResource } from "~/server/discovery/save";
import { getResource } from "~/server/repositories/resources";

const inputSchema = z.object({ style: citationStyleSchema, resourceId: z.string().uuid().optional(), locator: discoverySaveLocatorSchema.optional() }).strict().refine((v) => Boolean(v.resourceId) !== Boolean(v.locator));

export async function POST(request: Request) {
  await requireUserId();
  const body: unknown = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid citation request." }, { status: 400 });
  try {
    const resource = parsed.data.resourceId ? await getResource(parsed.data.resourceId) : await resolveDiscoveredResource(parsed.data.locator!);
    if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    return NextResponse.json(generateCitation(resource, parsed.data.style));
  } catch {
    return NextResponse.json({ error: "Citation metadata could not be retrieved. Retry shortly." }, { status: 502 });
  }
}
