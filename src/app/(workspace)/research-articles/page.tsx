import { ComingSoon } from "~/components/coming-soon";
import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  return <ComingSoon path="/research-articles" />;
}
