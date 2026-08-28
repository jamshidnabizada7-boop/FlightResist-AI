import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db, dbAvailable } from '@/lib/db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      /** OAuth / uploaded avatar URL (NextAuth stores it in `token.picture`). */
      image?: string | null;
      preferredMode: string;
      /** Whether the user's email has been verified (false until verified). */
      emailVerified: boolean;
      /** Account creation timestamp (ISO string), when known. */
      createdAt: string;
    };
  }
  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    preferredMode: string;
    emailVerified: boolean;
    createdAt: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    preferredMode: string;
    emailVerified: boolean;
    createdAt: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),

  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!dbAvailable()) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;
        if (!user.passwordHash) return null; // OAuth-only user, no password set

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          preferredMode: user.preferredMode,
          emailVerified: Boolean(user.emailVerified),
          createdAt: user.createdAt.toISOString(),
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.userId = user.id;
        // Credentials users come from `authorize` with every field set; OAuth
        // users come from the adapter (DB row) where field shapes can differ —
        // normalize so the token is always well-formed.
        token.preferredMode = user.preferredMode || 'DEMO';
        token.emailVerified = Boolean(user.emailVerified);
        token.createdAt = user.createdAt || new Date().toISOString();
        // OAuth emails are always verified by the provider (Google/GitHub).
        if (account?.type === 'oauth') {
          token.emailVerified = true;
        }
      }
      // Client-initiated session update — the header calls
      // `update({ preferredMode })` right after PATCH /api/user/mode succeeds,
      // so the new mode is merged into the JWT here and survives page reloads
      // for the rest of this login session (no re-login needed).
      if (trigger === 'update' && typeof session?.preferredMode === 'string') {
        const next = session.preferredMode.trim().toUpperCase();
        if (next === 'DEMO' || next === 'LIVE') {
          token.preferredMode = next;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // The JWT claim is frozen at sign-in; users who verify mid-session
      // (or legacy tokens without the claim) must not stay "Unverified"
      // until re-login. When the claim is falsy, re-check the DB — the
      // authoritative source — and heal the token for subsequent requests.
      let verified = Boolean(token.emailVerified);
      if (!verified && token.userId) {
        if (dbAvailable()) {
          try {
            const u = await db.user.findUnique({
              where: { id: token.userId },
              select: { emailVerified: true },
            });
            verified = Boolean(u?.emailVerified);
            if (verified) token.emailVerified = true; // heal the token
          } catch {
            /* DB error — fall back to the token claim below */
          }
        }
        // DB unavailable (e.g. Vercel SQLite) — keep the token claim.
      }

      session.user = {
        ...session.user,
        id: token.userId,
        preferredMode: token.preferredMode,
        image: token.picture || null,
        emailVerified: verified,
        createdAt: token.createdAt ?? '',
      };
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
