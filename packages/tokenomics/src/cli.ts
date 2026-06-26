#!/usr/bin/env -S node --experimental-strip-types
//! Thin host-neutral CLI: `tokenomics report` and `tokenomics spend`.
//!
//! Reads a JSONL spend ledger + a JSON pricing catalog (paths overridable via
//! flags or $TOKENOMICS_HOME) and prints a report or a period rollup. Hosts can
//! call this directly or import the library; this binary has no host deps.

import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Ledger, parsePeriod, type Period } from "./ledger.ts";
import { PricingCatalog } from "./pricing.ts";
import { renderReport } from "./render.ts";
import { buildReport, parseGran } from "./report.ts";
import { parseDate } from "./time.ts";

function home(): string {
  return process.env.TOKENOMICS_HOME?.trim() || join(homedir(), ".tokenomics");
}

function usage(): string {
  return [
    "tokenomics — local-first LLM spend accounting",
    "",
    "Usage:",
    "  tokenomics report [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--gran day|week|month|hour] [--json]",
    "  tokenomics spend  [--period day|week|month|year] [--since …] [--until …] [--json]",
    "",
    "Options:",
    "  --ledger PATH    spend ledger JSONL  (default $TOKENOMICS_HOME/ledger.jsonl)",
    "  --pricing PATH   pricing catalog JSON(default $TOKENOMICS_HOME/pricing.json)",
    "  --label TEXT     human label for the window (report only)",
  ].join("\n");
}

function main(argv: string[]): number {
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(`${usage()}\n`);
    return cmd ? 0 : 1;
  }

  const { values } = parseArgs({
    args: argv.slice(1),
    options: {
      since: { type: "string" },
      until: { type: "string" },
      gran: { type: "string" },
      period: { type: "string" },
      ledger: { type: "string" },
      pricing: { type: "string" },
      label: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const ledgerPath = values.ledger ?? join(home(), "ledger.jsonl");
  const pricingPath = values.pricing ?? join(home(), "pricing.json");
  const ledger = new Ledger(ledgerPath);
  const pricing = PricingCatalog.load(pricingPath);

  const until = values.until ? parseDate(values.until, true) : new Date();
  const since = values.since
    ? parseDate(values.since)
    : new Date(until.getTime() - 30 * 86_400_000);

  if (cmd === "report") {
    const rep = buildReport({
      ledger,
      pricing,
      since,
      until,
      gran: parseGran(values.gran ?? "day"),
      period: values.label ?? "",
    });
    process.stdout.write(
      values.json ? `${JSON.stringify(rep, null, 2)}\n` : `${renderReport(rep)}\n`,
    );
    return 0;
  }

  if (cmd === "spend") {
    const period: Period = parsePeriod(values.period ?? "day") ?? "day";
    const rollup = ledger.rollup(period, since, until);
    if (values.json) {
      process.stdout.write(`${JSON.stringify(Object.fromEntries(rollup), null, 2)}\n`);
      return 0;
    }
    for (const [key, r] of rollup) {
      const cost = `$${r.cost_usd.toFixed(2)}`;
      process.stdout.write(`${key}  ${cost.padStart(10)}  ${r.calls} calls\n`);
    }
    return 0;
  }

  process.stderr.write(`tokenomics: unknown command ${JSON.stringify(cmd)}\n\n${usage()}\n`);
  return 1;
}

process.exit(main(process.argv.slice(2)));
