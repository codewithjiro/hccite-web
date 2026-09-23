import { DiscoveryWorkspace } from "~/components/discovery-workspace";
import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  return <DiscoveryWorkspace kind="articles" />;
}
