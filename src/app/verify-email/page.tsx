import { Suspense } from "react";
import VerifyEmailClient from "./verify-email-client";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
          </div>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
