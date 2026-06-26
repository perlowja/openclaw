# @openclaw/tokenomics

Host-neutral, local-first **LLM spend accounting** for coding tools.

- **ledger** — append-only JSONL spend ledger (one row per model call)
- **pricing** — public price-list catalog (`$/Mtok`) + avoided-spend baseline
- **report** — period + by-model rollups, free-vs-paid, avoided/counterfactual
- **render** — dependency-free terminal table + free-share bar
- **host-adapter** — neutral ingestion seam (pi / Claude Code / Codex / Cursor / OpenClaw)

The core has **no coding-tool dependency**. Every host normalizes its own
per-call usage into a `UsageEvent` and calls `ingest`; the report/render layers
then work identically regardless of host. Ledger + report shapes are snake_case
and wire-compatible with companion implementations.

## Install

```bash
pnpm add @openclaw/tokenomics
```

## Library

```ts
import {
  Ledger,
  PricingCatalog,
  buildReport,
  renderReport,
  HostAdapter,
} from "@openclaw/tokenomics";

// Record a call from a host (free path -> $0 automatically):
const adapter = new HostAdapter(`${process.env.HOME}/.tokenomics/ledger.jsonl`, "cursor", {
  pricing: PricingCatalog.load(`${process.env.HOME}/.tokenomics/pricing.json`),
  isFree: (model) => model.endsWith(":free"),
});
adapter.track({
  provider: "openrouter",
  model: "deepseek/deepseek-chat:free",
  tokensIn: 1200,
  tokensOut: 800,
});

// Report:
const ledger = new Ledger(`${process.env.HOME}/.tokenomics/ledger.jsonl`);
const pricing = PricingCatalog.load(`${process.env.HOME}/.tokenomics/pricing.json`);
const rep = buildReport({ ledger, pricing, since: new Date("2026-01-01"), until: new Date() });
console.log(renderReport(rep));
```

Subpath exports: `@openclaw/tokenomics/{ledger,pricing,report,render,host-adapter}`.

## CLI

```bash
tokenomics report [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--gran day|week|month|hour] [--json]
tokenomics spend  [--period day|week|month|year] [--json]
```

Paths default to `$TOKENOMICS_HOME` (`~/.tokenomics`): `ledger.jsonl` + `pricing.json`.

## Coding-tool skill

[`skills/tokenomics/SKILL.md`](skills/tokenomics/SKILL.md) is a portable skill
that teaches a coding agent to (1) report spend with this package and (2)
configure a free / open-weight model over any OpenAI-compatible endpoint as the
main inference provider. Install it into a tool's skills home (e.g.
`~/.claude/skills/`, `~/.cursor/skills-cursor/`, `~/.codex/prompts/`; opencode
reads `~/.claude/skills/` too).

## Provider configs

[`configs/`](configs) has ready-to-edit samples for pointing Claude Code, Cursor,
Codex, and opencode at a free / open-weight model over an OpenAI-compatible
endpoint. Replace the placeholders with your provider's base URL, model ids, and
an API-key env var. See [`configs/README.md`](configs/README.md).

## License

Apache-2.0 OR MIT.
