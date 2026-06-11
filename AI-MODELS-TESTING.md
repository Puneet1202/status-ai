# AI Models — Testing & Comparison (status-ai tool-calling brain)

> Goal: **best tool-calling, no hallucination, FREE first** (sir's priority).
> Test one-by-one by changing `.env` only — system is multi-provider, **no code change**.
> Switch model = edit `Backend/.env` → restart backend.

---

## 0. How switching works (.env only)

```env
AI_PROVIDER=<groq | openai | anthropic | gemini>
AI_MODEL=<model id>
# plus the key/base-url for that provider (see each section below)
```

- Ollama, OpenRouter, Cloudflare all speak the **OpenAI protocol**, so they reuse the
  `openai` provider via `OPENAI_BASE_URL`. Only `.env` changes.
- `OPENAI_API_KEY=ollama` is a dummy (Ollama needs no key, but the adapter requires one).

---

## 1. PRIORITY ORDER (free first)

| Priority | Where | Free? | Speed | Best for |
|---|---|---|---|---|
| 1️⃣ | **Local Ollama** | ✅ 100% free, no limit | 🐌 slow (CPU, no GPU) | Dev/testing now; own-server later = fast |
| 2️⃣ | **Groq** (current) | ✅ free (daily token cap) | ⚡ very fast | Free + good — currently active |
| 3️⃣ | **Cloudflare Workers AI** | 🟡 10k Neurons/day free, then paid | ⚡ fast | Production (D1 is here too) |
| 4️⃣ | **OpenRouter** | ❌ mostly paid (`:free` tags rate-limited) | ⚡ | Top models when client pays |

---

## 2. LOCAL — Ollama (test these first, all FREE)

Hardware: 16GB RAM, no GPU → max ~7-8B models. 70B impossible locally.
**Pull then test. ✅ = good tool calling, ❌ = avoid.**

| Model | Pull command | Size | Tool-calling | Status (fill after test) |
|---|---|---|---|---|
| **qwen3** ⭐ | `ollama pull qwen3` | ~6GB | Best small tool-caller | ⬜ |
| **lfm2.5** | `ollama pull lfm2.5` | ~5GB | Built for tool calling on consumer HW | ⬜ |
| **llama3.1** | `ollama pull llama3.1` | ~5GB | Official tool support | ⬜ |
| llama3 (already have) | — | 4.7GB | Older, weak tools | ⬜ |

**Avoid for tools:** deepseek-r1, gemma (good chat, weak tool-calls).

### .env for Ollama
```env
AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
AI_MODEL=qwen3
```

---

## 3. GROQ — currently active (FREE, fast)

| Model | AI_MODEL | Tool-calling |
|---|---|---|
| **gpt-oss-120b** (current) | `openai/gpt-oss-120b` | Strong ✅ |
| llama-3.3-70b | `llama-3.3-70b-versatile` | Solid |
| qwen | check console.groq.com | — |

### .env for Groq
```env
AI_PROVIDER=groq
GROQ_API_KEY=<groq key>
AI_MODEL=openai/gpt-oss-120b
```
Limits: console.groq.com/settings/limits (daily token cap not in API headers).

---

## 4. CLOUDFLARE Workers AI (free 10k Neurons/day, then paid)

Free allocation documented at: developers.cloudflare.com/workers-ai/platform/pricing
(10,000 Neurons/day free; then unit price e.g. $0.29/M in, $2.25/M out).

Tool-calling models (use "Copy ID" on the model card for exact id):

| Rank | Model | AI_MODEL (Copy ID) |
|---|---|---|
| 🥇 | kimi-k2.6 (tool-calling king) | `@cf/moonshotai/kimi-k2.6` * |
| 🥈 ⭐ | qwen3-30b-a3b (best speed+quality) | `@cf/qwen/qwen3-30b-a3b-fp8` * |
| 🥇 | gpt-oss-120b | `@cf/openai/gpt-oss-120b` * |
| 🥈 | nemotron-3-120b | `@cf/nvidia/nemotron-3-120b-a12b` * |
| 🥉 | llama-3.3-70b-fp8-fast | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |

\* verify exact id via the **Copy ID** button on the CF model card.

### .env for Cloudflare
```env
AI_PROVIDER=openai
OPENAI_BASE_URL=https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1
OPENAI_API_KEY=<cloudflare-api-token>
AI_MODEL=@cf/qwen/qwen3-30b-a3b-fp8
```

---

## 5. OPENROUTER (one key → all models; mostly PAID)

`(free)` tagged models = free but rate-limited + data may be used for training
(avoid real company data on free tier). Look for the **`T` badge = Tools support**.

| Tier | Model | AI_MODEL |
|---|---|---|
| 🥇 best tool-calling | Claude Sonnet | `anthropic/claude-sonnet-4` |
| 🥇 | GPT-4o | `openai/gpt-4o` |
| 🥈 free | Nemotron 3 Ultra (free) | `nvidia/nemotron-3-ultra:free` |
| 🥈 | minimax-m3 | check openrouter.ai/models |

### .env for OpenRouter
```env
AI_PROVIDER=openai
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=sk-or-...
AI_MODEL=nvidia/nemotron-3-ultra:free
```

---

## 6. Built-in anti-hallucination guards (already in code)

These protect even weaker models:
- `tool_choice: "required"` → model MUST call a tool, can't fake "✅ saved".
- `temperature: 0.1` → near-deterministic.
- `regex-first` extraction → deterministic parser primary for English.

---

## TEST CHECKLIST (per model)
- [ ] Adds timesheet with correct hours/labels (no wrong args)
- [ ] Queries/analyzes timesheet correctly
- [ ] getEmployeeInfo / listEmployees tools fire correctly
- [ ] No hallucinated "done" without an actual tool call
- [ ] Speed acceptable
- [ ] Verdict: KEEP / DROP
