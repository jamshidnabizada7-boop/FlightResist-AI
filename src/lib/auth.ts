import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db, dbAvailable } from '@/lib/db';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
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
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.preferredMode = user.preferredMode;
        token.emailVerified = Boolean(user.emailVerified);
        token.createdAt = user.createdAt;
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
