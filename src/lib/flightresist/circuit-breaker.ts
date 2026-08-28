/**
 * FlightResist AI 2.0 — Circuit Breaker
 *
 * Generic per-dependency circuit breaker used for provider failover:
 *   CLOSED     — calls pass through; consecutive failures accumulate.
 *   OPEN       — after `failureThreshold` consecutive failures, calls are
 *                rejected outright until `cooldownMs` elapses.
 *   HALF_OPEN  — after the cooldown, probe calls are allowed again; enough
 *                consecutive successes close the circuit, a failure re-opens it.
 *
 * The Atlas provider is wrapped with a breaker instance (see providers/index.ts):
 * while its circuit is OPEN, provider selection fails over to DemoProvider.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Failures before opening (default: 3) */
  failureThreshold?: number;
  /** ms before half-open (default: 30000) */
  cooldownMs?: number;
  /** Successes in half-open to close (default: 1) */
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;

  constructor(private name: string, options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 1;
  }

  get isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if cooldown has passed → transition to half-open
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  get currentState(): CircuitState {
    // Trigger the isOpen check for state transition
    void this.isOpen;
    return this.state;
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new Error(`Circuit breaker [${this.name}] is OPEN — request rejected`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      throw err;
    }
  }
}
