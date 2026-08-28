/**
 * /api/mcp — Model Context Protocol surface (MCP-over-HTTP, JSON-RPC 2.0).
 *
 * This is the REAL runtime behind `qoder_mcp_config.json`. It exposes the same
 * operations the REST routes serve, so a Qoder workspace can bind them as MCP
 * tools. No capability is advertised that the app does not actually perform:
 * every tool delegates to the deterministic FlightResist engine.
 *
 *   GET  /api/mcp            → discovery manifest (server info + tool schemas)
 *   POST /api/mcp            → JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`
 *
 * Tool → engine mapping:
 *   get_current_trip    → currentTripResponse()
 *   trigger_disruption  → triggerDisruption(event)
 *   get_recovery_options→ currentTripResponse().analysis (shaped)
 *   confirm_recovery    → executeRecovery(proposal_id)   [human-approval gate]
 *   reset_session       → forceReset(providerMode)
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentTripResponse } from '@/lib/flightresist/api';
import { triggerDisruption, executeRecovery } from '@/lib/flightresist/pipeline';
import { forceReset } from '@/lib/flightresist/store';
import { getActiveProvider } from '@/lib/flightresist/providers';
import { CANONICAL_DISRUPTION, DELAY_DISRUPTION, ITINERARY } from '@/lib/flightresist/itinerary';
import type { DisruptionEvent } from '@/lib/flightresist/types';

export const dynamic = 'force-dynamic';

const SERVER_INFO = { name: 'flightresist', version: '2.0.0' } as const;
const PROTOCOL_VERSION = '2024-11-05';

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const TOOLS: ToolDef[] = [
  {
    name: 'get_current_trip',
    description:
      'Returns the active trip session: itinerary, state-machine state, risk score, provider mode, and execution ledger.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'trigger_disruption',
    description:
      'Simulates an inbound disruption for a flight on the active itinerary and starts the deterministic recovery analysis pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        flight_number: { type: 'string', enum: ['SQ856', 'CX520'] },
        event: { type: 'string', enum: ['CANCELLATION', 'DELAY'] },
        reason: { type: 'string' },
        delay_minutes: { type: 'number' },
      },
      required: ['flight_number', 'event'],
    },
  },
  {
    name: 'get_recovery_options',
    description:
      'Returns the deterministic analysis: candidate funnel, pruned summary, ranked options with multi-criteria scores, and the LLM explanation.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'confirm_recovery',
    description:
      'Human-approval gate: executes the approved proposal through the active provider (DemoProvider simulated, or AtlasSandboxProvider when live). Side-effecting — requires an explicit proposal_id.',
    inputSchema: {
      type: 'object',
      properties: { proposal_id: { type: 'string', enum: ['opt_a', 'opt_b', 'opt_c'] } },
      required: ['proposal_id'],
    },
  },
  {
    name: 'reset_session',
    description: 'Resets the demo session to NORMAL. The execution ledger is preserved.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

/** ---- Tool implementations (delegate to the engine) ---- */

async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_current_trip':
      return currentTripResponse();

    case 'trigger_disruption': {
      const flightNumber = String(args.flight_number ?? CANONICAL_DISRUPTION.flightNumber).toUpperCase();
      const leg = ITINERARY.legs.find((l) => l.flightNumber.toUpperCase() === flightNumber);
      if (!leg) {
        throw new Error(
          `Flight ${flightNumber} is not part of itinerary ${ITINERARY.tripId}. Available: ${ITINERARY.legs
            .map((l) => l.flightNumber)
            .join(', ')}`,
        );
      }
      const event = (String(args.event ?? 'CANCELLATION').toUpperCase() as DisruptionEvent['event']);
      const isDelay = event === 'DELAY';
      const delayMinutes = isDelay
        ? Math.max(5, Math.min(600, Number(args.delay_minutes ?? 45)))
        : undefined;
      const disruption: DisruptionEvent = {
        flightNumber: leg.flightNumber,
        event,
        reason: (args.reason as string) ?? (isDelay ? DELAY_DISRUPTION.reason : CANONICAL_DISRUPTION.reason),
        detectedAtIso: new Date().toISOString(),
        severity: isDelay ? 'HIGH' : 'CRITICAL',
        delayMinutes,
        detail:
          leg.flightNumber === CANONICAL_DISRUPTION.flightNumber && !isDelay
            ? CANONICAL_DISRUPTION.detail
            : isDelay
              ? `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) delayed +${delayMinutes}m — arrival slips; downstream buffers compress.`
              : `${leg.flightNumber} (${leg.from} ${leg.depIso} → ${leg.to}) cancelled — downstream connections on this trip are impacted.`,
      };
      return triggerDisruption(disruption);
    }

    case 'get_recovery_options': {
      const trip = await currentTripResponse();
      if (!trip.analysis) {
        return {
          status: trip.state === 'NORMAL' ? 'NO_DISRUPTION' : 'ANALYZING',
          state: trip.state,
          note:
            trip.state === 'NORMAL'
              ? 'No disruption triggered yet. Call trigger_disruption first.'
              : 'Analysis in progress.',
        };
      }
      const a = trip.analysis;
      return {
        status: 'RECOVERY_OPTIONS_READY',
        state: trip.state,
        trip_id: trip.trip_id,
        risk_score: trip.risk_score,
        total_candidates: a.constraintResult.totalCandidates,
        pruned_summary: a.constraintResult.prunedSummary,
        funnel: a.constraintResult.funnel,
        options: a.options.map((o) => ({
          id: o.id,
          label: o.label,
          routing: o.candidate.label,
          fare_diff: o.metrics.fareDiffUsd,
          delay_hours: o.metrics.delayHours,
          risk_score: o.residualRisk,
          recovery_score: o.recoveryScore,
          status: o.status,
          makes_meeting: o.metrics.makesMeeting,
        })),
        recommended_id: a.recommendedId,
        explanation: a.explanation,
        analysis_time_ms: a.totalAnalysisMs,
      };
    }

    case 'confirm_recovery': {
      const proposalId = String(args.proposal_id ?? '');
      if (!proposalId) throw new Error('proposal_id is required');
      const result = await executeRecovery(proposalId);
      return {
        status: result.status,
        provider_mode: result.providerMode,
        proposal_id: result.proposalId,
        order_id: result.orderId,
        pnr: result.pnr,
        demo_reference: result.demoReference,
        state: result.state,
        execution_time_ms: result.executionTimeMs,
        steps: result.steps,
        error: result.error,
      };
    }

    case 'reset_session': {
      const { info } = await getActiveProvider();
      await forceReset(info.mode);
      const trip = await currentTripResponse();
      return { status: 'RESET', state: trip.state, ledger: trip.ledger };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** ---- JSON-RPC helpers ---- */

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: unknown, code: number, message: string, httpStatus = 200) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status: httpStatus });
}

/** GET → human/agent-readable discovery manifest. */
export async function GET() {
  const { info } = await getActiveProvider();
  return NextResponse.json({
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: SERVER_INFO,
    transport: 'http',
    active_provider_mode: info.mode,
    tools: TOOLS,
  });
}

/** POST → JSON-RPC 2.0 (initialize | tools/list | tools/call). */
export async function POST(req: NextRequest) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const { id = null, method, params = {} } = body;

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: {} },
        });

      case 'tools/list':
        return rpcResult(id, { tools: TOOLS });

      case 'tools/call': {
        const toolName = String((params as { name?: string }).name ?? '');
        const args = ((params as { arguments?: Record<string, unknown> }).arguments ?? {}) as Record<
          string,
          unknown
        >;
        if (!TOOLS.some((t) => t.name === toolName)) {
          return rpcError(id, -32602, `Unknown tool: ${toolName}`);
        }
        try {
          const data = await runTool(toolName, args);
          return rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: false,
          });
        } catch (toolErr) {
          const message = toolErr instanceof Error ? toolErr.message : 'Tool execution failed';
          return rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
            isError: true,
          });
        }
      }

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[api/mcp]', err);
    return rpcError(id, -32603, message);
  }
}
