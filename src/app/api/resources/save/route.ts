import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "~/server/auth";
import { saveResource, upsertDiscoveryResource } from "~/server/repositories/resources";
import { normalizedResourceSchema } from "~/server/discovery/normalization";

export async function POST(request: Request) {
  await requireUserId();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const parsed = normalizedResourceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Resource metadata is invalid or incomplete." }, { status: 400 });
  try {
    const result = await upsertDiscoveryResource(parsed.data);
    const saved = await saveResource({ resourceId: result.resource.id });
    return NextResponse.json({ resource: result.resource, saved: !!saved, reused: result.reused, ambiguous: result.ambiguous });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Resource metadata is invalid." }, { status: 400 });
    return NextResponse.json({ error: "The Resource could not be saved." }, { status: 500 });
  }
}
