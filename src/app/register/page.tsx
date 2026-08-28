"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Please enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });

      if (res.status === 409) {
        setError("Email already registered.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      {/* Subtle background glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 30%, rgba(245,158,11,0.4) 0%, transparent 60%)",
        }}
      />

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-sm shadow-2xl shadow-black/40">
        {/* Branding */}
        <CardHeader className="items-center text-center gap-3">
          <div className="mb-1 flex items-center justify-center">
            <svg
              width="44"
              height="44"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M24 4 L40 12 L40 24 C40 34 33 42 24 44 C15 42 8 34 8 24 L8 12 Z"
                fill="rgba(245,158,11,0.12)"
                stroke="#f59e0b"
                strokeWidth="2"
              />
              <path d="M27 14 L20 26 L25 26 L21 34 L28 22 L23 22 Z" fill="#f59e0b" />
            </svg>
          </div>
          <CardTitle className="text-xl font-bold tracking-widest text-white uppercase">
            FlightResist AI 2.0
          </CardTitle>
          <CardDescription className="text-zinc-400 text-sm">
            Create your account
          </CardDescription>
        </CardHeader>

        {success ? (
          <CardContent className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-white font-semibold text-base">Account created!</p>
              <p className="text-zinc-400 text-sm">
                Check your email for a verification link to activate your account.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go to Sign In
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-5">
              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className="text-zinc-300 text-xs uppercase tracking-wider">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-800/60 text-white placeholder:text-zinc-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-zinc-300 text-xs uppercase tracking-wider">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-800/60 text-white placeholder:text-zinc-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="text-zinc-300 text-xs uppercase tracking-wider">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-800/60 text-white placeholder:text-zinc-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword" className="text-zinc-300 text-xs uppercase tracking-wider">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className="h-11 border-zinc-700 bg-zinc-800/60 text-white placeholder:text-zinc-500 focus-visible:border-amber-500 focus-visible:ring-amber-500/30"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-black font-semibold tracking-wide transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-sm text-zinc-500">
                Already have an account?{" "}
                <Link href="/login" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
