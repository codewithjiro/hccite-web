import type { Metadata } from "next";
import { AuthPreview } from "~/components/auth-preview";

export const metadata: Metadata = { title: "Create account" };
export default function SignUpPage() { return <AuthPreview mode="sign-up" />; }
