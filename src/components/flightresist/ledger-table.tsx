'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, History, Plane } from 'lucide-react';
import { fmtDuration } from '@/lib/flightresist/format';
import type { LedgerEntry } from '@/lib/flightresist/types';

interface Props {
  ledger: LedgerEntry[];
}

export function LedgerTable({ ledger }: Props) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">09 ·</span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">Recovery Ledger</h2>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">
          {ledger.length} execution{ledger.length === 1 ? '' : 's'} · persisted
        </span>
      </div>

      <div className="p-4">
        {ledger.length === 0 ? (
          <div className="flex min-h-[80px] flex-col items-center justify-center gap-2 text-center">
            <Plane className="h-6 w-6 text-zinc-500" />
            <p className="text-[11px] text-zinc-400">
              No provider executions yet — completed recoveries are persisted here (SQLite via Prisma).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800/70 text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">Option</th>
                  <th className="pb-2 pr-4 font-semibold">Reference</th>
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Execution</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11.5px]">
                {ledger.map((entry, i) => (
                  <motion.tr
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-20px' }}
                    transition={{ delay: i * 0.05 }}
                    className={`border-b border-zinc-800/40 transition-colors last:border-0 hover:bg-zinc-900/50 ${
                      i === 0 ? 'bg-emerald-500/[0.04]' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-4 text-zinc-400 tabular-nums">
                      {ledger.length - i}
                      {i === 0 && (
                        <span className="ml-1.5 rounded bg-emerald-500/10 px-1 py-px font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                          latest
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-bold uppercase text-zinc-300">{entry.proposalId.replace('opt_', '')}</td>
                    <td className="py-2.5 pr-4 text-amber-300">{entry.reference ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-bold ${
                          entry.status === 'FAILED'
                            ? 'border-red-500/40 bg-red-500/10 text-red-400'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2.5 tabular-nums text-zinc-400">{fmtDuration(entry.executionTimeMs)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
