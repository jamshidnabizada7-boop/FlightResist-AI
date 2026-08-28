'use client';

import { motion } from 'framer-motion';
import {
  Briefcase,
  CarTaxiFront,
  Clock,
  GitBranch,
  Hotel,
  Plane,
  AlertTriangle,
  ArrowDown,
} from 'lucide-react';
import type { TripImpactGraph, ImpactNode } from '@/lib/flightresist/types';

const NODE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FLIGHT: Plane,
  CONNECTION: GitBranch,
  ARRIVAL: Clock,
  HOTEL: Hotel,
  TRANSFER: CarTaxiFront,
  MEETING: Briefcase,
};

function NodeCard({ node, index }: { node: ImpactNode; index: number }) {
  const Icon = NODE_ICONS[node.kind] ?? Clock;
  const statusStyle =
    node.status === 'impacted'
      ? 'border-red-500/40 bg-red-500/[0.07]'
      : node.status === 'at-risk'
        ? 'border-orange-500/40 bg-orange-500/[0.06]'
        : 'border-emerald-500/40 bg-emerald-500/[0.06]';
  const iconStyle =
    node.status === 'impacted' ? 'text-red-400' : node.status === 'at-risk' ? 'text-orange-400' : 'text-emerald-400';
  const barColor =
    node.status === 'impacted' ? 'bg-red-500' : node.status === 'at-risk' ? 'bg-orange-400' : 'bg-emerald-400';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
      className={`rounded-lg border p-2.5 ${statusStyle}`}
      title={`Importance: ${Math.round(node.weight * 100)}% of trip value`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-900/80 ${iconStyle}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[12px] font-semibold text-zinc-200">{node.label}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-zinc-500">{node.detail}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <motion.div
                className={`h-full w-full origin-left rounded-full ${barColor}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: node.probability }}
                transition={{ delay: index * 0.07 + 0.15, duration: 0.5 }}
              />
            </div>
            <span className={`text-[10px] tabular-nums ${iconStyle}`}>
              {Math.round(node.probability * 100)}% affected
            </span>
            <span
              className={`rounded border px-1 py-px text-[11px] font-bold uppercase ${
                node.status === 'impacted'
                  ? 'border-red-500/40 text-red-400'
                  : node.status === 'at-risk'
                    ? 'border-orange-500/40 text-orange-300'
                    : 'border-emerald-500/40 text-emerald-400'
              }`}
            >
              {node.status}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface Props {
  graph: TripImpactGraph | null;
  residualMode: boolean;
}

export function ImpactGraphView({ graph, residualMode }: Props) {
  return (
    <section aria-labelledby="impact-graph-heading" className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-zinc-400">03 ·</span>
          <h2 id="impact-graph-heading" className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            {residualMode ? 'Remaining Risk' : 'Trip Impact'}
          </h2>
        </div>
        {graph && (
          <span className="text-[11px] text-zinc-500">
            {residualMode ? 'Remaining Risk' : 'Trip Impact Score'}:{' '}
            <span className={`font-mono tabular-nums ${graph.riskScore >= 60 ? 'text-red-400' : graph.riskScore >= 30 ? 'text-amber-300' : 'text-emerald-400'}`}>{graph.riskScore}/100</span>
          </span>
        )}
      </div>

      <div className="flex-1 p-4">
        {!graph ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
            <GitBranch className="h-8 w-8 text-zinc-500" />
            <p className="max-w-[240px] text-xs leading-relaxed text-zinc-400">
              When a disruption is detected, this shows how it affects each part of your trip —
              flight, connection, arrival, hotel, transfer, and meetings.
            </p>
          </div>
        ) : (
          <>
            {/* Phase 5: chain narration — what broke → what cascaded → what matters */}
            {graph.chainNarration && (
              <div className="mb-3 rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-400/80">Chain of events</span>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-snug text-zinc-400">
                  <span className="font-semibold text-red-300">What broke:</span> {graph.chainNarration.rootFailure}
                </p>
                {graph.chainNarration.cascade.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {graph.chainNarration.cascade.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-start gap-1">
                        <ArrowDown className="mt-0.5 h-2.5 w-2.5 shrink-0 text-orange-400/50" />
                        <span className="text-[10px] leading-snug text-zinc-500">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                  <span className="font-semibold text-amber-400/90">Biggest risk:</span> {graph.chainNarration.riskExplanation}
                </p>
              </div>
            )}
            <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">{graph.summary}</p>
            <div className="relative space-y-2">
              <div className="absolute bottom-3 left-[23px] top-3 w-px bg-gradient-to-b from-red-500/40 via-orange-500/30 to-amber-500/25" />
              {graph.nodes.map((n, i) => (
                <NodeCard key={n.id} node={n} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
