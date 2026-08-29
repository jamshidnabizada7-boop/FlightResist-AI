'use client';

import { ShieldCheck } from 'lucide-react';

interface Props {
  engineVersion: string;
}

export function SiteFooter({ engineVersion }: Props) {
  return (
    <footer className="relative mt-auto border-t border-border bg-zinc-950/95 backdrop-blur-sm sm:backdrop-blur-md">
      {/* amber hairline bookending the header heartbeat */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-amber-400 to-orange-600">
            <ShieldCheck className="h-3.5 w-3.5 text-neutral-950" />
          </div>
          <div className="text-center sm:text-left">
            <div className="text-[11px] font-bold text-zinc-300">
              FlightResist AI 2.0 — Autonomous Travel Recovery Intelligence
            </div>
            <div className="text-[10px] text-zinc-400">
              Alibaba Cloud × Atlas Agentic AI Hackathon 2026 · engine v{engineVersion}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {['Next.js 16', 'Qwen 2.5 (Alibaba Cloud)', 'Atlas Flights GDS', 'Qoder MCP Server', 'Deterministic Core', 'Prisma Ledger'].map(
            (t) => (
              <span
                key={t}
                className="rounded border border-zinc-800 bg-zinc-900/60 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400"
              >
                {t}
              </span>
            ),
          )}
        </div>
      </div>
    </footer>
  );
}
