import type { Metadata } from "next";
import { AuthPreview } from "~/components/auth-preview";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() { return <AuthPreview mode="sign-in" />; }
