"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Human-readable messages for next-auth OAuth error codes.
 * next-auth redirects failed OAuth attempts to the configured signIn
 * page (/login) with `?error=<code>` — these map those codes to copy
 * the user can actually act on.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Sign in with your original provider, or use email and password instead.",
  Callback:
    "The sign-in provider returned an error. Please try again.",
  AccessDenied:
    "Access was denied by the sign-in provider. Please try again.",
  Configuration:
    "There is a server configuration problem with this sign-in provider. Please contact support.",
  Verification:
    "The sign-in request has expired or is invalid. Please try again.",
  Default: "Sign-in failed. Please try again.",
};

function OAuthErrorContent() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  if (!oauthError) return null;

  const message =
    OAUTH_ERROR_MESSAGES[oauthError] ??
    `Sign-in failed (${oauthError}). Please try again.`;

  return (
    <div
      role="alert"
      className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400"
    >
      {message}
    </div>
  );
}

export function OAuthErrorAlert() {
  // useSearchParams must sit behind a Suspense boundary for statically
  // prerendered pages, otherwise `next build` fails.
  return (
    <Suspense fallback={null}>
      <OAuthErrorContent />
    </Suspense>
  );
}
