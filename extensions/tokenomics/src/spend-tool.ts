// Tokenomics NLQ tool: answers natural-language spend questions such as "what
// is my API spend" or "how much did I spend this week" by querying the local
// ledger report. Read-only; reuses the same report entrypoint the HTTP route
// serves, so tool answers and the `/api/diagnostics/tokenomics` route agree.
import { jsonResult } from "openclaw/plugin-sdk/provider-web-fetch";
import { Type, type Static } from "typebox";
import { renderReport } from "./render.js";
import type { Report } from "./report.js";

const DAY_MS = 86_400_000;

// Convenience windows for natural-language questions. Explicit `since`/`until`
// override these; omitting all three falls back to the report's default window.
const WINDOWS = ["today", "last_24h", "7d", "30d", "90d", "this_month", "all"] as const;
type WindowKey = (typeof WINDOWS)[number];
const GRANS = ["hour", "day", "week", "month"] as const;

// Flat string-enum schema (a `type:string` + `enum` list). Some providers
// reject the `anyOf` that `Type.Union([Type.Literal(...)])` emits, so model-
// facing tool params must stay flat enums (repo AGENTS.md tool-schema rule).
function optionalStringEnum<const T extends readonly string[]>(values: T, description: string) {
  return Type.Optional(Type.Unsafe<T[number]>({ type: "string", enum: [...values], description }));
}

export const SpendToolSchema = Type.Object(
  {
    window: optionalStringEnum(
      WINDOWS,
      'Time window: "today", "last_24h", "7d", "30d" (default), "90d", "this_month", or "all".',
    ),
    since: Type.Optional(
      Type.String({ description: "Start of window (ISO date/datetime). Overrides `window`." }),
    ),
    until: Type.Optional(
      Type.String({ description: "End of window (ISO date/datetime). Overrides `window`." }),
    ),
    granularity: optionalStringEnum(
      GRANS,
      "Time-bucket granularity for the breakdown (default: day).",
    ),
  },
  { additionalProperties: false },
);

export type SpendToolParams = Static<typeof SpendToolSchema>;

// Start-of-window (epoch ms) for a convenience window; `all`/unknown → undefined
// so the caller leaves `since` unset (report reads the full ledger / its default).
function windowStart(window: WindowKey, now: number): number | undefined {
  switch (window) {
    case "today": {
      const d = new Date(now);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    case "last_24h":
      return now - DAY_MS;
    case "7d":
      return now - 7 * DAY_MS;
    case "30d":
      return now - 30 * DAY_MS;
    case "90d":
      return now - 90 * DAY_MS;
    case "this_month": {
      const d = new Date(now);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    default:
      // "all" → widest window; leave `since` at the epoch so all history counts.
      return 0;
  }
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build the report query params from tool args (explicit bounds win over `window`). */
export function toReportParams(params: SpendToolParams, now: number): URLSearchParams {
  const search = new URLSearchParams();
  if (params.granularity) {
    search.set("gran", params.granularity);
  }
  if (params.since) {
    search.set("since", params.since);
  }
  if (params.until) {
    search.set("until", params.until);
  }
  // Derive bounds from `window` only when the caller gave no explicit ones.
  if (!params.since && !params.until && params.window) {
    const start = windowStart(params.window, now);
    if (start !== undefined) {
      search.set("since", new Date(start).toISOString());
    }
    search.set("until", new Date(now).toISOString());
  }
  return search;
}

/** One-line natural-language answer for "what is my API spend". */
export function summarize(report: Report): string {
  const freePct =
    report.total_tokens > 0 ? Math.round((report.free_tokens / report.total_tokens) * 100) : 0;
  const top = report.by_model
    .filter((row) => row.billed)
    .slice(0, 3)
    .map((row) => `${row.model} ${money(row.cost_usd)}`)
    .join(", ");
  const range = `${report.since.slice(0, 10)} → ${report.until.slice(0, 10)}`;
  const head = `Billed API spend ${money(report.total_cost_usd)} over ${range} (${report.total_calls.toLocaleString("en-US")} calls, ${report.total_tokens.toLocaleString("en-US")} tokens; ${freePct}% of tokens served free, avoiding ~${money(report.avoided_usd)}).`;
  return top ? `${head} Top paid models: ${top}.` : head;
}

/**
 * Build the `tokenomics_spend` agent tool. `report` is the plugin's tolerant
 * report entrypoint (same one the HTTP route uses), injected so the tool reads
 * the live ledger without re-opening it.
 */
export function createSpendTool(
  report: (params: URLSearchParams) => Report,
  now: () => number = Date.now,
) {
  return {
    name: "tokenomics_spend",
    label: "API Spend",
    description:
      "Report LLM/API spend from the local Tokenomics ledger. Answers questions like 'what is my API spend', 'how much did I spend this week', spend by model, and free-vs-paid breakdown. Read-only; no arguments needed for a default 30-day summary.",
    parameters: SpendToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const params = rawParams as SpendToolParams;
      const report_ = report(toReportParams(params, now()));
      return jsonResult({
        summary: summarize(report_),
        since: report_.since,
        until: report_.until,
        period: report_.period,
        total_cost_usd: report_.total_cost_usd,
        total_tokens: report_.total_tokens,
        total_calls: report_.total_calls,
        free_tokens: report_.free_tokens,
        billed_tokens: report_.billed_tokens,
        avoided_usd: report_.avoided_usd,
        by_model: report_.by_model,
        report_text: renderReport(report_),
      });
    },
  };
}
