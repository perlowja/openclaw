//! @openclaw/tokenomics — local-first LLM spend accounting for OpenClaw.
//!
//! - time     : UTC bucketing helpers (day/week/month/hour, ISO week)
//! - ledger   : append-only JSONL spend ledger (one row per model call)
//! - pricing  : public price-list catalog ($/Mtok) + avoided-spend baseline
//! - report   : period + by-model rollups, free-vs-paid, avoided/counterfactual
//! - render   : terminal table + free-share bar
//! - host-adapter : neutral ingestion seam (pi / Claude Code / Codex / Cursor / OpenClaw)
//!
//! Host-neutral by design: the core has no coding-tool dependency. The ledger +
//! report shapes are wire-compatible (snake_case) with the companion Rust
//! cost-reporting CLI.

export * from "./time.ts";
export * from "./ledger.ts";
export * from "./pricing.ts";
export * from "./report.ts";
export * from "./render.ts";
export * from "./host-adapter.ts";
