import { redirect } from "next/navigation";
import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  redirect("/studies");
}
