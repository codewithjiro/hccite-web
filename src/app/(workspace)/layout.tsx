import { WorkspaceShell } from "~/components/workspace-shell";
import { requireUserId } from "~/server/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
