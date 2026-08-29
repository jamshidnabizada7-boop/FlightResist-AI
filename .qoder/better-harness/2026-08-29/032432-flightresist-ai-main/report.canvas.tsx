import {
  Callout,
  H1,
  MetricsGrid,
  ReferencePanel,
  ReportSection,
  ReportShell,
  RiskCallout,
  Row,
  Stack,
  Table,
  Tag,
  Text,
  Timeline,
  type TableRowTone,
} from 'qoder/canvas';

const headerMetrics = [
  { label: 'Overall harness score', value: '4.2 / 5', tone: 'success' as const, description: 'Trust engineered; packaging lags' },
  { label: 'MCP tools', value: '5', tone: 'primary' as const, description: 'All delegate to the engine; 1 side-effecting, triple-gated' },
  { label: 'Executable assertions', value: '108+', tone: 'primary' as const, description: '91 safety + 17 MCP + golden flow + isolation' },
  { label: 'Status docs to triage', value: '11', tone: 'warning' as const, description: '~4.9k lines; no single current-state page' },
];

const scorecardRows: string[][] = [
  ['Skill hygiene & supply chain', '5.0', 'Hash-pinned official skill; self-bootstrapping uv → atlas-flight CLI; version-gated, never downgraded'],
  ['MCP integration', '5.0', 'Real JSON-RPC 2.0 runtime; tools delegate to the same engine as REST; booking tool triple-gated; 17/17 smoke'],
  ['Verification culture', '5.0', 'Every phase ends verify → document → validate → preserve golden demo; claims are runnable commands'],
  ['Agent safety engineering', '5.0', 'Approval gate + idempotency + synchronous lock + audit events; LLM prompt-locked with template fallback'],
  ['Documentation findability', '3.0', 'Excellent content, sprawled: 11 docs (~4.9k lines), time-skewed env snapshots, no current-state pointer'],
  ['Environment portability', '2.5', 'POSIX-only ops scripts; MCP config trusts localhost with no auth; Windows host runs the app but not the runbooks'],
  ['Continuous automation', '3.0', 'Cron watchdog held 10+ autonomous QA rounds; but nothing runs on push/PR'],
  ['First five minutes', '4.0', '30-second try-it in README, keyboard demo, presenter checklist; requires dev server + doc disambiguation'],
];

const scorecardTones: TableRowTone[] = ['success', 'success', 'success', 'success', 'warning', 'warning', 'warning', 'success'];

const practiceRows: string[][] = [
  ['Hash-pinned, self-bootstrapping skills', 'skills-lock.json SHA-256; SKILL.md installs uv then atlas-flight 0.3.12, never downgrades', 'Known capability version; the skill repairs its own toolchain mid-task'],
  ['Stop-the-turn checkpoints on money paths', 'SKILL.md: AUTHORIZATION / PRICE INCREASE / SEAT FALLBACK / PAYMENT; branch on code, never message', 'You can hand the agent a credit card without holding your breath'],
  ['MCP tools delegate to the engine', 'src/app/api/mcp/route.ts — "No tool has its own logic"; full flow smoke-tested via JSON-RPC only', 'The agent surface cannot drift from the app — one engine, two doors'],
  ['Capability honesty as discipline', '[ENV: DETERMINISTIC DEMO] badges; SIM-* refs; pnr: null; SUPPORTED / UNSUPPORTED / UNVERIFIED matrix', 'Docs are believable; the tool list tells the truth'],
  ['Phase plan as agent takeover contract', 'docs/QODER_UPGRADE_PLAN.md: 6 non-negotiable rules, acceptance criteria, STOP conditions, freeze', 'Prevents the rewrite-happy agent; succession, not rebuild'],
  ['Worklog as handover contract', 'worklog.md: 15 tasks + 10 phases; cron watchdog consumed it every 900s across 10+ rounds', 'Session-hopping agents behave as one continuous engineer'],
  ['Claims as commands', 'README "Verify every number yourself" — three one-liners; test:mcp wired in package.json', 'Believing the docs costs one terminal'],
  ['Deterministic engine authoritative', 'PHASE4_AGENTIC_VALIDATION.md matrix; 24 events actor-tagged; invalid API key changes zero numbers', 'You always know who decided — code, not a model\u2019s mood'],
  ['Safety invariants as adversarial tests', 'phase6-safety.mjs 91/91 (no approval → no transaction; double approval → one); session-isolation.mjs', 'Safety is a regression suite, not a README paragraph'],
  ['Deployment harness with honest runbooks', 'deploy/bootstrap.sh idempotent ECS + Caddy + TLS; vercel-login.cjs OAuth helper; .env.example warnings', 'Going live is a runbook, not archaeology'],
];

const insights = [
  'The safest agent design I have seen around money: checkpoints + state gate + idempotency + audit events, each independently testable.',
  'Claims come as commands — 91 + 17 + golden-flow assertions, one line each. "Not behind on engineering, behind on proof" is the transferable lesson.',
  'One engine, two doors: MCP delegates to the same functions as REST. The cheapest decision that makes an agent integration trustworthy.',
  'The worklog is the real invention: Task / Agent / Stage Summary / Next turns session-hopping agents into one continuous engineer.',
  'Honesty is load-bearing — the project documents its own past over-claims and how it fixed them. That is why the docs are believable.',
  'But I drown in 11 status docs with time-skewed snapshots; nothing tells me which page is current. One dated current-state page fixes it.',
  'The ops layer assumes POSIX; on Windows the app runs but the runbooks do not. Cross-platform scripts + an MCP auth token would open it up.',
  'Discipline lives in prompts, not pipelines: no CI runs the 100+ existing assertions. A 20-line workflow is the highest-leverage missing piece.',
  'The 613-line phase plan (rules, criteria, STOP conditions, freeze) is a reusable contract for any AI takeover of a working codebase.',
  'Deterministic-first agentic design pays off: agents orchestrate and explain, the engine computes, an invalid key provably changes nothing.',
];

const frictionRows: string[][] = [
  ['Doc sprawl, stale snapshots', '11 docs ~4.9k lines; Atlas "NOT FOUND" vs "AUTHORIZED" across docs — both true at different times', 'Newcomer cannot tell which page is current'],
  ['POSIX-only ops ergonomics', 'package.json start/db:* use env-prefix syntax; .zscripts + deploy target Ubuntu', 'Ops scripts unusable on Windows hosts'],
  ['No CI enforcement', 'No .github/workflows; only test:mcp wired', 'Bad commits pass silently until a watchdog round'],
  ['MCP endpoint trusts localhost', 'No auth token; cosmetic client header only', 'Unsafe if ever exposed remotely'],
  ['Golden-value test brittleness', 'Exact-value assertions; four documented false failures across phases', 'Triage tax when fixtures or timing change'],
  ['Dead weight', 'examples/websocket TS errors; mini-services scaffold; committed .vercel-tmp/login.log; duplicate db files', 'Confusion tax on what is load-bearing'],
  ['Bilingual skill copy', 'Chinese-first capability answer in SKILL.md', 'Unexpected language switch for English-only users'],
  ['Narrow demo scope', 'One itinerary, 42-candidate fixture; production ticketing blocked (disclosed)', 'Edges arrive fast if treated as a product'],
];

const frictionTones: TableRowTone[] = ['warning', 'warning', 'danger', 'danger', 'warning', 'warning', 'warning', 'warning'];

const adoptItems = [
  'Pin skills with hashes; let them self-bootstrap their CLI (skills-lock.json + SKILL.md)',
  'Write stop-the-turn checkpoints into any skill that can spend money or mutate state',
  'Make MCP tools delegate to the same functions as REST; smoke-test the flow through MCP only',
  'Advertise only verified capabilities; omit unsupported tools; badge the active environment',
  'Keep a running worklog and let a scheduled QA loop consume it as its contract',
  'Hand agents a phase plan: rules, acceptance criteria, STOP conditions, freeze directive',
  'Prompt-lock the LLM to a fact payload with template fallback; prove it survives an invalid key',
  'Guard approvals with idempotency + pre-await lock + audit events, encoded as tests',
];

const lineageEvents = [
  {
    id: 'l1',
    timestamp: 'MVP — Z.ai Code',
    title: 'Tasks 1–15: engine, cockpit, golden demo',
    description: 'Deterministic funnel 42→3, provider abstraction, SSE trace, Prisma ledger',
    state: 'completed' as const,
  },
  {
    id: 'l2',
    timestamp: 'Audit — Antigravity',
    title: '746-line 360° audit, zero code changes',
    description: 'Honest scorecard: strong engineering, missing proof (video, cloud, evidence packaging)',
    state: 'completed' as const,
  },
  {
    id: 'l3',
    timestamp: 'Phases 0–1 — Qoder',
    title: 'Takeover audit + Atlas capability discovery',
    description: 'Fake MCP trace found; real CLI surface verified; Sandbox booking reached TICKETED with a live PNR',
    state: 'completed' as const,
  },
  {
    id: 'l4',
    timestamp: 'Phases 2–4 — Qoder',
    title: 'Real MCP runtime, provider rewrite, agentic layer',
    description: '17/17 MCP smoke; actor-tagged trace; agents orchestrate, engine computes',
    state: 'completed' as const,
  },
  {
    id: 'l5',
    timestamp: 'Phases 5–10 — Qoder',
    title: 'Recovery intelligence, safety suite, release freeze',
    description: '91/91 safety assertions; why-engine; demo-mode perfection; frozen at commit 2398e87',
    state: 'completed' as const,
  },
  {
    id: 'l6',
    timestamp: 'Autonomous QA — watchdog',
    title: '10+ rounds every 900s against the worklog contract',
    description: 'Feature-freeze declared and held; false alarms root-caused, not papered over',
    state: 'current' as const,
    tone: 'success' as const,
  },
];

const evidenceItems = [
  { id: 'r1', label: 'skills-lock.json', description: 'Hash-pinned skill supply chain', kind: 'file' as const },
  { id: 'r2', label: '.agents/skills/atlas-flight-booking/SKILL.md', description: 'Checkpoint-gated, self-bootstrapping skill', kind: 'file' as const },
  { id: 'r3', label: 'src/app/api/mcp/route.ts', description: 'Real MCP-over-HTTP runtime', kind: 'file' as const },
  { id: 'r4', label: 'tests/phase6-safety.mjs', description: '91 safety assertions', kind: 'runbook' as const },
  { id: 'r5', label: 'tests/mcp-smoke.mjs', description: '17-check MCP golden flow', kind: 'runbook' as const },
  { id: 'r6', label: 'docs/QODER_UPGRADE_PLAN.md', description: 'Agent takeover contract (rules, phases, STOP conditions)', kind: 'doc' as const },
  { id: 'r7', label: 'worklog.md', description: 'Inter-agent handover contract', kind: 'doc' as const },
  { id: 'r8', label: 'QODER_EVIDENCE.md', description: 'One-page Qoder usage evidence with honest limits', kind: 'doc' as const },
];

function NumberedList({ items, tone }: { items: string[]; tone: 'neutral' | 'success' }) {
  return (
    <Stack gap="component">
      {items.map((item, index) => (
        <Row key={index} gap="inline" align="start">
          <Tag tone={tone} size="sm">{String(index + 1)}</Tag>
          <Text>{item}</Text>
        </Row>
      ))}
    </Stack>
  );
}

export default function FlightResistHarnessReview() {
  return (
    <ReportShell width="wide" ariaLabel="FlightResist AI harness practice review">
      <Stack gap="section">
        <header>
          <Stack gap="component">
            <H1>FlightResist AI 2.0 — Harness Practice Review</H1>
            <Text tone="secondary">
              Analyzed as a human who wants to use the platform: can I trust the agent, verify its claims, and run
              this without wasting my evening?
            </Text>
            <MetricsGrid variant="header" columns={4} items={headerMetrics} />
          </Stack>
        </header>

        <ReportSection title="Verdict" divided>
          <Stack gap="component">
            <Callout tone="success" title="Trust is engineered, not claimed">
              Every side-effecting agent path is gated, every claim maps to a runnable command, and honesty is treated
              as a feature. This is one of the most disciplined agent-harness codebases you will meet.
            </Callout>
            <RiskCallout
              level="medium"
              title="The gap is packaging, not practice"
              message="Fix three things before handing this to any human: (1) one dated current-state page to replace doc archaeology, (2) CI that runs the 100+ assertions that already exist, (3) cross-platform scripts plus an auth token on the MCP endpoint."
            />
          </Stack>
        </ReportSection>

        <ReportSection title="Harness scorecard" description="Eight dimensions, scored 0–5 from a user's perspective" divided>
          <Table
            headers={['Dimension', 'Score', 'Why']}
            rows={scorecardRows}
            rowTone={scorecardTones}
            density="compact"
          />
        </ReportSection>

        <ReportSection title="What the harness actually does" description="Ten practices, each with file-level evidence" divided>
          <Table
            headers={['Practice', 'Evidence', 'What it buys a human']}
            rows={practiceRows}
            density="compact"
          />
        </ReportSection>

        <ReportSection title="Insights — as a human who wants to use this platform" divided>
          <NumberedList items={insights} tone="neutral" />
        </ReportSection>

        <ReportSection title="Friction I hit" divided>
          <Table
            headers={['Friction', 'Evidence', 'Impact']}
            rows={frictionRows}
            rowTone={frictionTones}
            density="compact"
          />
        </ReportSection>

        <ReportSection title="What I'd copy tomorrow" divided>
          <NumberedList items={adoptItems} tone="success" />
        </ReportSection>

        <ReportSection title="Harness lineage" description="One codebase, four harnesses, documented handoffs" divided>
          <Timeline events={lineageEvents} />
        </ReportSection>

        <ReportSection title="Verify it yourself" description="Every conclusion above points at a file or a command" divided>
          <ReferencePanel title="Evidence index" items={evidenceItems} columns={2} />
        </ReportSection>

        <Text tone="tertiary" size="small">
          Static harness audit · generated 2026-08-29 · run 032432-flightresist-ai-main · retained findings in
          findings.json, render spec in canvas.json
        </Text>
      </Stack>
    </ReportShell>
  );
}
