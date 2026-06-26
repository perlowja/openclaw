//! Local spend ledger. Append-only JSONL, one record per model call. The
//! on-disk shape is intentionally identical to the companion Rust ledger
//! (snake_case fields, RFC3339 `ts_utc`) so a ledger written by either tool is
//! readable by the other. SQLite is a drop-in later via the same shape.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { dayKey, monthKey, weekKey, yearKey } from "./time.ts";

/** One persisted ledger record. Field names match the Rust serde layout. */
export interface LedgerEntry {
  /** RFC3339 / ISO-8601 timestamp (UTC). */
  ts_utc: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  /** Set when the post-call free-policy guard flagged this spend. */
  violation?: string;
}

export type Period = "day" | "week" | "month" | "year";

export function parsePeriod(s: string): Period | undefined {
  switch (s.toLowerCase()) {
    case "day":
    case "daily":
      return "day";
    case "week":
    case "weekly":
      return "week";
    case "month":
    case "monthly":
      return "month";
    case "year":
    case "yearly":
      return "year";
    default:
      return undefined;
  }
}

function periodBucket(period: Period, ts: Date): string {
  switch (period) {
    case "day":
      return dayKey(ts);
    case "week":
      return weekKey(ts);
    case "month":
      return monthKey(ts);
    case "year":
      return yearKey(ts);
  }
}

export interface Rollup {
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  calls: number;
}

function emptyRollup(): Rollup {
  return { cost_usd: 0, tokens_in: 0, tokens_out: 0, calls: 0 };
}

export class Ledger {
  constructor(private readonly path: string) {}

  /** Append one record as a single line (atomic under O_APPEND). */
  record(e: LedgerEntry): void {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(e)}\n`);
  }

  /**
   * All records. Per-line tolerant: a single mangled/half-written line (e.g.
   * from an interrupted append) is skipped rather than aborting the rollup.
   */
  entries(): LedgerEntry[] {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch {
      return [];
    }
    const out: LedgerEntry[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (t === "") continue;
      try {
        const e = JSON.parse(t) as LedgerEntry;
        if (e && typeof e.ts_utc === "string" && typeof e.model === "string") {
          out.push(e);
        }
      } catch {
        // skip malformed line
      }
    }
    return out;
  }

  /** Records within an optional `[since, until]` window (inclusive). */
  entriesIn(since?: Date, until?: Date): LedgerEntry[] {
    const lo = since?.getTime();
    const hi = until?.getTime();
    return this.entries().filter((e) => {
      const t = Date.parse(e.ts_utc);
      if (Number.isNaN(t)) return false;
      if (lo !== undefined && t < lo) return false;
      if (hi !== undefined && t > hi) return false;
      return true;
    });
  }

  /** Spend rolled up by period bucket within an optional window (sorted key). */
  rollup(period: Period, since?: Date, until?: Date): Map<string, Rollup> {
    const out = new Map<string, Rollup>();
    for (const e of this.entriesIn(since, until)) {
      const key = periodBucket(period, new Date(e.ts_utc));
      const r = out.get(key) ?? emptyRollup();
      r.cost_usd += e.cost_usd;
      r.tokens_in += e.tokens_in;
      r.tokens_out += e.tokens_out;
      r.calls += 1;
      out.set(key, r);
    }
    return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  /** Spend grouped by model within an optional window. */
  byModel(since?: Date, until?: Date): Map<string, Rollup> {
    const out = new Map<string, Rollup>();
    for (const e of this.entriesIn(since, until)) {
      const r = out.get(e.model) ?? emptyRollup();
      r.cost_usd += e.cost_usd;
      r.tokens_in += e.tokens_in;
      r.tokens_out += e.tokens_out;
      r.calls += 1;
      out.set(e.model, r);
    }
    return new Map([...out.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}
