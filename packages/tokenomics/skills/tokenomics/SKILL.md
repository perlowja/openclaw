---
name: tokenomics
description: >-
  Report local LLM spend and token usage from the tokenomics ledger, and
  configure a coding tool to use a free or open-weight model over any
  OpenAI-compatible endpoint as its main inference provider. Use when the user
  asks about LLM cost, token usage, how much they spent, per-model breakdowns,
  free-vs-paid savings, avoided spend, or how to point Claude Code / Cursor /
  Codex / opencode at a free / self-hosted / OpenAI-compatible provider. Trigger
  keywords - tokenomics, spend, cost report, token usage, avoided spend, free
  models, base URL, OpenAI-compatible, configure provider.
allowed-tools: Bash, Read
---

# Tokenomics — local LLM spend reporting + free-provider setup

Two jobs: (1) report local LLM spend from the tokenomics ledger, and (2) point a
coding tool at a free / open-weight model over an OpenAI-compatible endpoint so
there's little spend to report.

## 1. Report spend / usage

`@openclaw/tokenomics` keeps an append-only JSONL ledger and prices it from a
public price-list catalog. Reports are local-first and offline.

```bash
# usage + by-model report with avoided-spend counterfactual
tokenomics report [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--gran day|week|month] [--json]

# raw spend rollups for a period
tokenomics spend  [--period day|week|month|year] [--json]
```

Paths default to `$TOKENOMICS_HOME` (`~/.tokenomics`): `ledger.jsonl` +
`pricing.json`. When the user asks "how much did I spend" / "by model" /
"how much did the free models save me", run `report` and summarize: total spent,
free-token share, avoided spend, and the top cost driver.

Hosts feed usage in via the neutral ingestion seam — translate each model call
into a `UsageEvent` and call `ingest` (or `HostAdapter.track`); free-path calls
record as `$0`. See `host-adapter` in the package.

## 2. Use a free / open-weight model as the main provider

Any OpenAI-compatible endpoint works (self-hosted vLLM / Ollama / LiteLLM, a
gateway, or a hosted free tier). Set a base URL + an API key from an env var,
then choose an open-weight coder as the default. Ready-to-edit samples live in
this package under [`configs/`](../../configs):

- `configs/claude-code.settings.json` — Claude Code
- `configs/cursor.md` — Cursor
- `configs/codex.config.toml` — Codex
- `configs/opencode.jsonc` — opencode

Replace the placeholders (`YOUR-OPENAI-COMPATIBLE-ENDPOINT`,
`your-vendor/your-model`, `$LLM_API_KEY`) with the user's provider values. Keep
the key in an env var, never in committed config.

> opencode note: some versions forward a per-model `options.extraBody` to the API
> as a literal parameter; if the gateway rejects unknown params you get HTTP 400
> ("Unsupported parameter(s): extraBody") and every model breaks. Omit it, or
> upgrade opencode to a build that spreads it into the request body.
