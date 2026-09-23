import { LibraryWorkspace } from "~/components/library-workspace";
import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  return <LibraryWorkspace />;
}
