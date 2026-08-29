#!/usr/bin/env node
// tests/e2e-runner.mjs
// Unified Master Test Runner for FlightResist AI 2.0 Opaque-Box Test Suite
// Executes all test tiers (Tier 1 Features, Tier 2 Boundaries, Tier 3 Pairwise, Tier 4 Scenarios)
// Emits TAP 13 compliant logs & ANSI summary table, exiting with code 0 on pass or 1 on failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIERS = [
  { id: 'tier1', name: 'Tier 1: Feature Test Suites (F1–F17)', dir: path.join(__dirname, 'tier1-features') },
  { id: 'tier2', name: 'Tier 2: Boundary & Edge Case Suites (B1–B17)', dir: path.join(__dirname, 'tier2-boundaries') },
  { id: 'tier3', name: 'Tier 3: Combinatorial Pairwise Interaction Matrix', dir: path.join(__dirname, 'tier3-pairwise') },
  { id: 'tier4', name: 'Tier 4: Real-World Enterprise Workload Scenarios (S1–S9)', dir: path.join(__dirname, 'tier4-scenarios') },
];

async function main() {
  const globalStart = performance.now();

  console.log('\n' + '='.repeat(80));
  console.log('  FLIGHTRESIST AI 2.0 — COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('  Specification: PROJECT.md (F1–F17) | TEST_INFRA.md (Tiers 1–4)');
  console.log('='.repeat(80) + '\n');
  console.log('TAP version 13');

  let testCounter = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const tierSummaries = [];

  for (const tier of TIERS) {
    if (!fs.existsSync(tier.dir)) continue;

    const files = fs.readdirSync(tier.dir).filter(f => f.endsWith('.test.mjs')).sort();
    console.log(`\n# ----------------------------------------------------------------------`);
    console.log(`# ${tier.name} (${files.length} suites)`);
    console.log(`# ----------------------------------------------------------------------`);

    let tierPassed = 0;
    let tierFailed = 0;
    const tierStart = performance.now();

    for (const file of files) {
      const filePath = path.join(tier.dir, file);
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

      try {
        const mod = await import(fileUrl);
        const suite = mod.default;

        if (!suite || typeof suite.run !== 'function') {
          console.error(`Bail out! Suite in ${file} does not export a valid TestSuite instance.`);
          process.exit(1);
        }

        const results = await suite.run();

        for (const res of results) {
          testCounter++;
          const durationStr = `${res.durationMs.toFixed(1)}ms`;

          if (res.status === 'pass') {
            totalPassed++;
            tierPassed++;
            console.log(`ok ${testCounter} - ${res.name} [${durationStr}]`);
          } else {
            totalFailed++;
            tierFailed++;
            console.log(`not ok ${testCounter} - ${res.name} [${durationStr}]`);
            console.log(`  ---`);
            console.log(`  message: ${res.error?.message || 'Unknown test failure'}`);
            if (res.error?.stack) {
              const stackLines = res.error.stack.split('\n').slice(1, 4).map(l => `    ${l.trim()}`).join('\n');
              console.log(`  stack: |\n${stackLines}`);
            }
            console.log(`  ...`);
          }
        }
      } catch (importErr) {
        testCounter++;
        totalFailed++;
        tierFailed++;
        console.log(`not ok ${testCounter} - Import Failure: ${file}`);
        console.log(`  ---`);
        console.log(`  message: ${importErr.message}`);
        console.log(`  ...`);
      }
    }

    const tierDurationMs = performance.now() - tierStart;
    tierSummaries.push({
      tier: tier.name,
      suites: files.length,
      passed: tierPassed,
      failed: tierFailed,
      total: tierPassed + tierFailed,
      durationMs: tierDurationMs,
    });
  }

  const totalDurationMs = performance.now() - globalStart;

  // -------------------------------------------------------------------------
  // ANSI Summary Report
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80));
  console.log('  TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n1..${testCounter}`);
  console.log(`\nTier Breakdown:`);
  tierSummaries.forEach(ts => {
    const statusIcon = ts.failed === 0 ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${statusIcon.padEnd(8)} ${ts.tier.padEnd(52)} ${String(ts.passed).padStart(3)}/${ts.total} tests (${ts.durationMs.toFixed(1)}ms)`);
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`Total Tests Executed : ${testCounter}`);
  console.log(`Total Passed         : ${totalPassed}`);
  console.log(`Total Failed         : ${totalFailed}`);
  console.log(`Total Execution Time : ${totalDurationMs.toFixed(1)}ms (${(totalDurationMs / 1000).toFixed(2)}s)`);
  console.log('-'.repeat(80));

  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! PLATFORM INTEGRITY VERIFIED (100% SUCCESS)\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${totalFailed} TEST(S) FAILED! Escalate defects or review test logic.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
