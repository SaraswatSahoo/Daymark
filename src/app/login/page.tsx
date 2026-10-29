import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authEnabled } from "@/lib/auth-token";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/app/logo";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!authEnabled()) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="size-10" />
          <h1 className="font-display text-2xl font-semibold">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">Enter your password to continue.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
