# Cursor → OpenAI-compatible endpoint

Cursor can target any OpenAI-compatible API.

1. Settings → **Models** → **OpenAI API Key**.
2. Enable **Override base URL** and set:

   ```
   Base URL: https://YOUR-OPENAI-COMPATIBLE-ENDPOINT/v1
   API key:  $LLM_API_KEY
   ```

3. Under **Add model**, add your provider's model ids (e.g.
   `your-vendor/your-coder-model`) and verify them.
4. Disable the built-in billed models you don't want used, and set your
   open-weight coder as the active model.

> Cursor's agent works best with a strong coder model. Use a large open-weight
> coder as the default; keep a smaller model for quick edits.
