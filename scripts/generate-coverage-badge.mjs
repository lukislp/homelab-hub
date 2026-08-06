#!/usr/bin/env node
/**
 * Turn a vitest/@vitest-coverage-v8 coverage-summary.json into a shields.io "endpoint" badge
 * JSON. Reads total.lines.pct and writes it in the schema shields.io/endpoint expects, so the
 * README badge can point at the raw GitHub URL of the committed file - no external service
 * (same self-hosted-badge convention as this portfolio's piwatch/studylife repos).
 *
 * Usage: node scripts/generate-coverage-badge.mjs <coverage-summary.json> <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const THRESHOLDS = [
  [80, "brightgreen"],
  [60, "green"],
  [40, "yellow"],
  [20, "orange"],
];

function colorFor(pct) {
  for (const [threshold, color] of THRESHOLDS) {
    if (pct >= threshold) return color;
  }
  return "red";
}

function main() {
  const [, , summaryPath, outPath] = process.argv;
  if (!summaryPath || !outPath) {
    console.error("usage: generate-coverage-badge.mjs <coverage-summary.json> <out.json>");
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const pct = summary.total.lines.pct;

  const badge = {
    schemaVersion: 1,
    label: "coverage",
    message: `${pct.toFixed(0)}%`,
    color: colorFor(pct),
  };
  writeFileSync(outPath, JSON.stringify(badge));
}

main();
