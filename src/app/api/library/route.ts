import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "~/server/auth";
import { listSavedResources, updateSavedResource, removeSavedResource } from "~/server/repositories/resources";
import { addResourceToCollection, attachTag, createCollection, createTag, deleteCollection, deleteTag, getCollection, listCollections, listLibraryLinks, listTags, removeResourceFromCollection, removeTag, updateCollection } from "~/server/repositories/collections";
import { discoverySaveLocatorSchema } from "~/server/discovery/locator";
import { saveDiscoveredResource } from "~/server/discovery/save";

const id = z.string().uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("unsave"), savedResourceId: id }).strict(),
  z.object({ action: z.literal("updateSaved"), savedResourceId: id, readingStatus: z.enum(["unread", "reading", "read"]).optional(), notes: z.string().trim().max(10000).nullable().optional() }).strict(),
  z.object({ action: z.literal("createCollection"), name: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal("renameCollection"), collectionId: id, name: z.string().trim().min(1).max(160) }).strict(),
  z.object({ action: z.literal("deleteCollection"), collectionId: id }).strict(),
  z.object({ action: z.literal("addCollection"), collectionId: id, resourceId: id }).strict(),
  z.object({ action: z.literal("removeCollection"), collectionId: id, resourceId: id }).strict(),
  z.object({ action: z.literal("createTag"), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("deleteTag"), tagId: id }).strict(),
  z.object({ action: z.literal("attachTag"), savedResourceId: id, tagId: id }).strict(),
  z.object({ action: z.literal("removeTag"), savedResourceId: id, tagId: id }).strict(),
  z.object({ action: z.literal("saveToCollection"), collectionId: id, locator: discoverySaveLocatorSchema }).strict(),
]);

export async function GET() {
  await requireUserId();
  const [saved, collections, tags, links] = await Promise.all([listSavedResources(), listCollections(), listTags(), listLibraryLinks()]);
  return NextResponse.json({ saved, collections, tags, ...links });
}

export async function POST(request: Request) {
  await requireUserId();
  const body: unknown = await request.json().catch(() => null);
  const parsed = input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the supplied fields and try again." }, { status: 400 });
  const v = parsed.data;
  if (v.action === "updateSaved" && v.readingStatus === undefined && v.notes === undefined) return NextResponse.json({ error: "Choose a status or enter a note." }, { status: 400 });
  try {
    let result: unknown;
    switch (v.action) {
      case "unsave": result = await removeSavedResource(v.savedResourceId); break;
      case "updateSaved": result = await updateSavedResource(v.savedResourceId, { ...(v.readingStatus !== undefined && { readingStatus: v.readingStatus }), ...(v.notes !== undefined && { notes: v.notes }) }); break;
      case "createCollection": result = await createCollection({ name: v.name }); break;
      case "renameCollection": result = await updateCollection(v.collectionId, { name: v.name }); break;
      case "deleteCollection": result = await deleteCollection(v.collectionId); break;
      case "addCollection": result = await addResourceToCollection(v.collectionId, v.resourceId); break;
      case "removeCollection": result = await removeResourceFromCollection(v.collectionId, v.resourceId); break;
      case "createTag": result = await createTag({ name: v.name }); break;
      case "deleteTag": result = await deleteTag(v.tagId); break;
      case "attachTag": result = await attachTag(v.savedResourceId, v.tagId); break;
      case "removeTag": result = await removeTag(v.savedResourceId, v.tagId); break;
      case "saveToCollection": {
        await getCollection(v.collectionId);
        const saved = await saveDiscoveredResource(v.locator);
        result = await addResourceToCollection(v.collectionId, saved.resource.id);
        break;
      }
    }
    if (result === null || result === false) return NextResponse.json({ error: "The requested item was not found." }, { status: 404 });
    return NextResponse.json({ ok: true, result: result ?? null });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return NextResponse.json({ error: "The requested item was not found." }, { status: 404 });
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "That name is already in use." }, { status: 409 });
    return NextResponse.json({ error: "The library request could not be completed." }, { status: 500 });
  }
}
