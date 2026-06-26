//! Model pricing catalog. Rates are realized `$ / 1M tokens` in the public
//! price-list shape (LiteLLM `input/output_cost_per_token`, OpenRouter
//! `pricing.prompt/completion`, scaled to per-Mtok). The catalog drives the
//! cost-counterfactual / avoided-spend headline in a report; per-call cost in
//! the ledger is the truth for what was actually paid.
//!
//! On-disk JSON shape matches the Rust `PricingCatalog` (snake_case) so a
//! catalog produced by the companion Rust CLI's `pricing` command loads unchanged.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface ModelPrice {
  /** Legacy blended rate (input+output) in USD per 1M tokens. Fallback only. */
  usd_per_mtok?: number;
  /** Per-component rates in USD per 1M tokens (take precedence when set). */
  input_usd_per_mtok?: number;
  output_usd_per_mtok?: number;
  cache_read_usd_per_mtok?: number;
  cache_write_usd_per_mtok?: number;
  reasoning_usd_per_mtok?: number;
  source?: string;
}

export interface PricingCatalogJson {
  generated?: string;
  window?: string;
  models?: Record<string, ModelPrice>;
  /** Frontier baseline `$ / 1M tok` for the avoided-spend estimate. */
  baseline_usd_per_mtok?: number;
  baseline_model?: string;
}

function priceIsPriced(p: ModelPrice): boolean {
  return (
    (p.usd_per_mtok ?? 0) > 0 || (p.input_usd_per_mtok ?? 0) > 0 || (p.output_usd_per_mtok ?? 0) > 0
  );
}

/** Cost in USD for an input/output token split (component rates, else blended). */
export function priceCostIo(p: ModelPrice, tokensIn: number, tokensOut: number): number {
  const inRate = p.input_usd_per_mtok ?? 0;
  const outRate = p.output_usd_per_mtok ?? 0;
  if (inRate > 0 || outRate > 0) {
    return (tokensIn * inRate + tokensOut * outRate) / 1_000_000;
  }
  return ((p.usd_per_mtok ?? 0) * (tokensIn + tokensOut)) / 1_000_000;
}

export class PricingCatalog {
  generated = "";
  window = "";
  models: Map<string, ModelPrice> = new Map();
  baselineUsdPerMtok = 0;
  baselineModel = "";

  /** Load, or an empty catalog if absent/corrupt (never fatal). */
  static load(path: string): PricingCatalog {
    const cat = new PricingCatalog();
    let raw: string;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      return cat;
    }
    try {
      const j = JSON.parse(raw) as PricingCatalogJson;
      cat.generated = j.generated ?? "";
      cat.window = j.window ?? "";
      cat.baselineUsdPerMtok = j.baseline_usd_per_mtok ?? 0;
      cat.baselineModel = j.baseline_model ?? "";
      for (const [k, v] of Object.entries(j.models ?? {})) {
        cat.models.set(k, v);
      }
    } catch (e) {
      process.stderr.write(
        `tokenomics: warning: pricing catalog ${path} unreadable (${String(e)}); using empty\n`,
      );
    }
    return cat;
  }

  toJSON(): PricingCatalogJson {
    return {
      generated: this.generated,
      window: this.window,
      models: Object.fromEntries(this.models),
      baseline_usd_per_mtok: this.baselineUsdPerMtok,
      baseline_model: this.baselineModel,
    };
  }

  /** Atomic write (temp + rename). */
  save(path: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.toJSON(), null, 2)}\n`);
    renameSync(tmp, path);
  }

  /**
   * Look up a model price, tolerating id vs display-name drift: exact, then
   * case-insensitive, then leaf/suffix match (`host/leaf` -> `leaf`).
   */
  lookup(model: string): ModelPrice | undefined {
    const exact = this.models.get(model);
    if (exact) return exact;
    const ml = model.toLowerCase();
    const leaf = ml.includes("/") ? ml.slice(ml.lastIndexOf("/") + 1) : ml;
    for (const [k, v] of this.models) {
      const kl = k.toLowerCase();
      if (kl === ml || kl === leaf || ml.endsWith(kl) || kl.endsWith(leaf)) {
        return v;
      }
    }
    return undefined;
  }

  /** Chargeback for a call. Unknown/unpriced model → $0 (never invent cost). */
  cost(model: string, tokensIn: number, tokensOut: number): number {
    const p = this.lookup(model);
    return p ? priceCostIo(p, tokensIn, tokensOut) : 0;
  }

  /** True when the model has a non-zero rate (a paid cloud model). */
  isBilled(model: string): boolean {
    const p = this.lookup(model);
    return p ? priceIsPriced(p) : false;
  }

  /** Avoided spend: `tokens` priced at the frontier baseline. */
  avoided(tokens: number): number {
    return (this.baselineUsdPerMtok * tokens) / 1_000_000;
  }
}
