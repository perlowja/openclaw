# Using a free / low-cost model as your main inference provider

`@openclaw/tokenomics` measures spend; these configs help you _avoid_ it by
pointing your coding tool at a free or open-weight model over any
**OpenAI-compatible** endpoint.

Any endpoint that speaks the OpenAI `/v1/chat/completions` API works: a
self-hosted server (vLLM, Ollama, LiteLLM, llama.cpp), a gateway/proxy, or a
hosted free tier (e.g. OpenRouter's `:free` models). Set two things:

```
Base URL:  https://YOUR-OPENAI-COMPATIBLE-ENDPOINT/v1
API key:   $LLM_API_KEY        # keep the key in an env var, not in committed config
```

Pick a capable open-weight coder as the default and a small/fast one for cheap
turns. Then record usage with the tokenomics host-adapter so free-path work shows
up as `$0` and you can see the avoided spend.

| File                        | Tool        |
| --------------------------- | ----------- |
| `claude-code.settings.json` | Claude Code |
| `cursor.md`                 | Cursor      |
| `codex.config.toml`         | Codex       |
| `opencode.jsonc`            | opencode    |

Replace placeholders (`YOUR-OPENAI-COMPATIBLE-ENDPOINT`, `your-vendor/your-model`,
`$LLM_API_KEY`) with your provider's values.
