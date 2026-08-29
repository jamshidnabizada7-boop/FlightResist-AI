'use client';

/**
 * FlightResist AI 2.0 — session hook: REST + SSE wiring for the cockpit.
 *
 * Network resilience:
 *  - SSE reconnects with exponential backoff (1 s → 30 s max).
 *  - Tab visibility change triggers reconnection + data refresh.
 *  - Initial boot fetch has a 10 s abort timeout.
 *  - `connectionWarning` state exposed for UI banners.
 *
 * Session isolation: all requests are same-origin and carry the HttpOnly
 * `fr-session` cookie automatically (fetch defaults + explicit
 * `credentials: 'same-origin'`; EventSource sends same-origin cookies by
 * default), so each browser tab is scoped to its own server-side session.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentEvent,
  DisruptionEvent,
  ExecutionResult,
  Itinerary,
  LedgerEntry,
  LlmExplanation,
  ProviderInfo,
  RecoveryAnalysis,
  TripState,
} from '@/lib/flightresist/types';

export interface CurrentTrip {
  trip_id: string;
  state: TripState;
  itinerary: Itinerary;
  risk_score: number;
  provider_mode: string;
  provider: ProviderInfo;
  disruption: DisruptionEvent | null;
  analysis: RecoveryAnalysis | null;
  execution: ExecutionResult | null;
  ledger: LedgerEntry[];
  events: AgentEvent[];
  engine_version: string;
  /** Present when the user's LIVE preference could not be served for this
   *  read and the snapshot was built with the demo provider instead. */
  live_unavailable?: boolean;
  live_unavailable_reason?: string;
}

export interface SseStatus {
  connected: boolean;
  lastEventAt: number | null;
}

const MAX_BACKOFF = 30_000;

export function useFlightResist() {
  const [trip, setTrip] = useState<CurrentTrip | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [sse, setSse] = useState<SseStatus>({ connected: false, lastEventAt: null });
  const [busy, setBusy] = useState<{ trigger: boolean; confirm: boolean; reset: boolean }>({
    trigger: false,
    confirm: false,
    reset: false,
  });
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);

  const seenSeq = useRef<Set<number>>(new Set());
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const connectedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Keep connectedRef in sync with sse.connected
  useEffect(() => {
    connectedRef.current = sse.connected;
  }, [sse.connected]);

  const refresh = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch('/api/trip/current', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CurrentTrip;
      setTrip(data);
      setEvents((prev) => {
        if (data.events.length >= prev.length) {
          seenSeq.current = new Set(data.events.map((e) => e.seq));
          return data.events;
        }
        return prev;
      });
      // Live-mode degradation is not a network failure: the trip loaded, but
      // the user's LIVE preference could not be served. Say so instead of
      // pretending everything is fine (or failing the read).
      if (data.live_unavailable) {
        setConnectionWarning(data.live_unavailable_reason ?? 'Live mode unavailable — showing demo data.');
      } else {
        setConnectionWarning(null);
      }
    } catch (err) {
      console.error('[flightresist] refresh failed:', err);
      setConnectionWarning('Unable to load trip data — please check your connection.');
    }
  }, []);

  // --- SSE connect with exponential backoff ---
  const connect = useCallback(() => {
    // Tear down any previous source
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource('/api/recovery/stream');
    esRef.current = es;

    es.addEventListener('open', () => {
      setSse({ connected: true, lastEventAt: Date.now() });
      setConnectionWarning(null);
      backoffRef.current = 1000; // reset backoff on success
    });

    es.addEventListener('agent', (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as AgentEvent;
      setSse((s) => ({ ...s, connected: true, lastEventAt: Date.now() }));
      setEvents((prev) => {
        if (seenSeq.current.has(ev.seq)) return prev;
        seenSeq.current.add(ev.seq);
        return [...prev, ev];
      });
    });

    es.addEventListener('snapshot', (e) => {
      const snap = JSON.parse((e as MessageEvent).data) as { state: TripState; risk_score: number };
      setSse((s) => ({ ...s, connected: true, lastEventAt: Date.now() }));
      setTrip((prev) => (prev ? { ...prev, state: snap.state, risk_score: snap.risk_score } : prev));
      channelRef.current?.postMessage({ type: 'STATE_CHANGE', payload: { state: snap.state } });
      void refresh();
    });

    es.addEventListener('state', (e) => {
      const st = JSON.parse((e as MessageEvent).data) as { to: TripState };
      setSse((s) => ({ ...s, connected: true, lastEventAt: Date.now() }));
      setTrip((prev) => (prev ? { ...prev, state: st.to } : prev));
      channelRef.current?.postMessage({ type: 'STATE_CHANGE', payload: { state: st.to } });
    });

    es.addEventListener('reset', () => {
      seenSeq.current = new Set();
      setEvents([]);
      void refresh();
    });

    es.addEventListener('error', () => {
      es.close();
      esRef.current = null;
      setSse((s) => ({ ...s, connected: false }));
      setConnectionWarning('Connection lost — reconnecting…');

      if (!mountedRef.current) return;

      // Exponential backoff reconnect
      reconnectRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
        connect();
      }, backoffRef.current);
    });

    return es;
  }, [refresh]);

  // --- Main lifecycle: initial boot + SSE + cleanup ---
  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [refresh, connect]);

  // --- Cross-tab synchronization via BroadcastChannel ---
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return; // SSR/unsupported guard

    const channel = new BroadcastChannel('flightresist-sync');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'STATE_CHANGE' || type === 'EVENTS_UPDATE') {
        // Refresh trip data from server to sync with other tab
        void refresh();
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [refresh]);

  // --- Tab visibility re-sync ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!connectedRef.current) {
          // Cancel pending reconnect timer and connect immediately
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
          }
          backoffRef.current = 1000;
          connect();
        }
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connect, refresh]);

  const triggerDisruption = useCallback(
    async (scenario: 'cancellation' | 'delay' = 'cancellation', delayMinutes?: number): Promise<boolean> => {
      if (busy.trigger) return false; // Prevent double-click
      setBusy((b) => ({ ...b, trigger: true }));
      try {
        const res = await fetch('/api/disrupt/trigger', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(delayMinutes !== undefined ? { scenario, delay_minutes: delayMinutes } : { scenario }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          window.dispatchEvent(
            new CustomEvent('fr-toast', { detail: { title: 'Cannot trigger disruption', description: err.error ?? `HTTP ${res.status}` } }),
          );
          return false;
        }
        void refresh();
        return true;
      } catch {
        window.dispatchEvent(
          new CustomEvent('fr-toast', { detail: { title: 'Network error', description: 'Disruption trigger failed.' } }),
        );
        return false;
      } finally {
        // Minimum 2s cooldown to prevent rapid re-clicks
        setTimeout(() => setBusy((b) => ({ ...b, trigger: false })), 2000);
      }
    },
    [busy.trigger, refresh],
  );

  const confirmRecovery = useCallback(
    async (proposalId: string): Promise<ExecutionResult | null> => {
      if (busy.confirm) return null; // Prevent double-click
      setBusy((b) => ({ ...b, confirm: true }));
      try {
        const res = await fetch('/api/recovery/confirm', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal_id: proposalId }),
        });
        const data = (await res.json()) as {
          status: ExecutionResult['status'];
          provider_mode: ExecutionResult['providerMode'];
          proposal_id: string;
          order_id: string | null;
          pnr: string | null;
          demo_reference: string | null;
          fare_key: string | null;
          state: ExecutionResult['state'];
          execution_time_ms: number;
          steps: ExecutionResult['steps'];
          error: string | null;
          completed_at: string;
        };
        if (!res.ok) {
          window.dispatchEvent(
            new CustomEvent('fr-toast', { detail: { title: 'Execution rejected', description: data.error ?? `HTTP ${res.status}` } }),
          );
          return null;
        }
        const mapped: ExecutionResult = {
          status: data.status,
          providerMode: data.provider_mode,
          proposalId: data.proposal_id,
          orderId: data.order_id,
          pnr: data.pnr,
          demoReference: data.demo_reference,
          fareKey: data.fare_key,
          state: data.state,
          executionTimeMs: data.execution_time_ms,
          steps: data.steps ?? [],
          completedAtIso: data.completed_at,
          error: data.error,
        };
        void refresh();
        return mapped;
      } catch {
        window.dispatchEvent(
          new CustomEvent('fr-toast', { detail: { title: 'Network error', description: 'Recovery execution failed.' } }),
        );
        return null;
      } finally {
        // Minimum 2s cooldown to prevent rapid re-clicks
        setTimeout(() => setBusy((b) => ({ ...b, confirm: false })), 2000);
      }
    },
    [busy.confirm, refresh],
  );

  const resetSession = useCallback(async (): Promise<void> => {
    setBusy((b) => ({ ...b, reset: true }));
    try {
      await fetch('/api/session/reset', { method: 'POST', credentials: 'same-origin' });
      seenSeq.current = new Set();
      setEvents([]);
      await refresh();
      window.dispatchEvent(
        new CustomEvent('fr-toast', { detail: { title: 'Session reset', description: 'Sentinel re-armed — itinerary back to NORMAL.' } }),
      );
    } finally {
      setBusy((b) => ({ ...b, reset: false }));
    }
  }, [refresh]);

  return {
    trip,
    events,
    sse,
    busy,
    connectionWarning,
    triggerDisruption,
    confirmRecovery,
    resetSession,
    refresh,
  };
}
