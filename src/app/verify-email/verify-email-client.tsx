"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "error";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`, {
          method: "GET",
        });

        if (res.ok) {
          setStatus("success");
          setMessage("Your email has been verified successfully.");
        } else {
          setStatus("error");
          setMessage("Invalid or expired verification link.");
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    }

    verify();
  }, [token]);

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
            Email Verification
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-6 text-center">
          {status === "loading" && (
            <>
              {/* Spinner */}
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-white font-semibold">Verifying your email…</p>
                <p className="text-zinc-500 text-sm">This will only take a moment.</p>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <svg
                  className="h-7 w-7 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-white font-semibold text-base">Email verified!</p>
                <p className="text-zinc-400 text-sm">
                  {message} You can now sign in to your account.
                </p>
              </div>
              <Link href="/login">
                <Button className="mt-2 h-11 px-8 bg-amber-500 hover:bg-amber-400 text-black font-semibold tracking-wide transition-colors">
                  Go to Sign In
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
                <svg
                  className="h-7 w-7 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-white font-semibold text-base">Verification failed</p>
                <p className="text-zinc-400 text-sm">{message}</p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="mt-2 h-11 px-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
                  Back to Sign In
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
