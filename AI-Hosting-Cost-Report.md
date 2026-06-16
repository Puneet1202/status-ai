# AI Hosting & Cost Report — KEYSS Timesheet Assistant

**Prepared for:** Management review
**Subject:** Where to run the AI brain (model: `qwen3-30b`) — options, cost, privacy, and recommendation
**Note:** All prices are approximate (Jun 2026), in USD and INR (₹85 ≈ $1). Provider rates change over time.

---

## 1. How we measured the cost (the basis)

The cost of every option depends on how much the AI is used. Our real usage:

| Item | Value |
|---|---|
| Model | qwen3-30b (open-source, supports tool-calling) |
| Tokens per AI request | **~6,000 tokens** (≈ 5,000 input + 1,000 output) |
| AI requests per active user | **~20 requests / day** |

**Formula used:**
```
Requests/day   = users × 20
Tokens/month   = requests/day × 30 × 6,000
```

**Step-by-step build-up (Cloudflare, the recommended option):**

| Step | Value |
|---|---|
| Input tokens per request | 5,000 |
| Output tokens per request | 1,000 |
| Total tokens per request | 6,000 |
| Requests per user per day | 20 |
| Tokens per user per day | 120,000 |
| Tokens per user per month (×30) | 3,600,000 (3.6M) |
| **Cost per user per month** (3.0M × $0.051 + 0.6M × $0.34) | **~$0.36 = ₹30** |

So each user ≈ **₹30/month** on Cloudflare. Total = ₹30 × users (minus the free tier).

**Total on Cloudflare by team size (after the free 10,000 neurons/day):**

| Users | Requests/day | Tokens/month | Cost/month |
|---|---|---|---|
| 10 | 200 | 36M | ~₹0–150 (mostly free) |
| **20** | **400** | **72M** | **~₹400–500** |
| 50 | 1,000 | 180M | ~₹1,200 |
| 100 | 2,000 | 360M | ~₹2,700 |

> Cloudflare gives the first ~185–270 requests/day FREE, which is why a small team pays almost nothing. Cost grows in a straight line with usage. The same method applies to other providers using their rates (Section 5).
>
> Note: many simple actions (add/view/report) are handled by code without calling the AI, so real AI calls are often fewer — these numbers are a safe upper estimate.

---

## 2. Two ways to run AI (important concept)

1. **Ready API** — a company hosts the model; we just send requests and pay per use. No server to manage. (Cloudflare, DeepInfra, OpenAI, etc.)
2. **Rent a GPU + run our own** — we rent a graphics server (RunPod, Vast.ai) and install free software (**Ollama** or **vLLM**) on it. Fully private, unlimited use, but we manage it and pay for the GPU.

> **Ollama / vLLM are FREE software**, not a paid service — that is why they have no pricing page. Their "cost" = the machine they run on. **They cannot run on a normal laptop/CPU server (it times out); they need a GPU.**

---

## 3. Full comparison

| Service | Type | Speed | Free tier | Cost @ 20 users (approx) | Data private? | Verdict for us |
|---|---|---|---|---|---|---|
| **Cloudflare Workers AI** | Ready API | Slow-ish (3–4s) | ~185–270 calls/day | **~₹400–600/mo** | ✅ Yes (no training) | ✅ Cheapest + zero setup — **best value** |
| **DeepInfra** | Ready API | Fast | small trial credit | **~₹1,800/mo** | ✅ Yes | ✅ Cheap + fast, open models |
| **Together.ai** | Ready API | Fast | small trial credit | ~₹1,700–5,000/mo | ✅ Yes | Good, slightly costlier |
| **Fireworks.ai** | Ready API | Fast | small trial credit | ~₹1,700–5,000/mo | ✅ Yes | Similar to Together |
| **OpenAI — GPT-4o-mini** | Ready API | Fast | no | **~₹1,400/mo** | ✅ Yes (API not trained) | Very reliable, closed model |
| **OpenAI — GPT-4o (full)** | Ready API | Fast | no | ~₹23,000/mo | ✅ Yes | Top quality but expensive |
| **Anthropic — Claude Haiku 4.5** | Ready API | Fast | no | ~₹6,000–10,000/mo (caching helps) | ✅ Yes | Best tool-calling + prompt caching |
| **Google Gemini 2.0 Flash** | Ready API | Fast | **Free tier TRAINS on data** ❌ / paid is private | paid ~₹900/mo | ❌ Free / ✅ Paid | Cheap, but free tier not safe for company data |
| **OpenRouter — Nemotron (free)** | Ready API | Medium | **Fully FREE** | ₹0 | ❌ **No — logs & trains on data** | ❌ Privacy risk → **not for company data** |
| **OpenRouter — premium models** | Ready API | Fast | no | **very expensive — see §5** | ✅ (paid) | Only for special needs |
| **Groq** | Ready API | ⚡ Fastest (1.1s) | ~32 calls/day; 8K tokens/min | paid + tight limits | ✅ Yes | Fastest, but limit chokes with many users |
| **RunPod (Serverless, RTX 4090)** | Rent GPU (pay/sec) | Fast when warm; lag after idle | — | **~₹1,600–2,000/mo** | ✅ Yes (our server) | ✅ Fast + private, pay-per-use |
| **Vast.ai (RTX 4090, 24GB)** | Rent GPU (per hour) | Fast | — | ~₹22,000/mo if 24/7 | ✅ Yes | Costly if left on 24/7 |
| **Vast.ai (RTX 5090, 32GB)** | Rent GPU (per hour) | ⚡ Very fast | — | ~₹27,000/mo if 24/7 | ✅ Yes | For full-quality model + always-on |
| **Ollama / vLLM** | Free software (runs on a GPU) | Depends on the GPU | Free software | = cost of the GPU it runs on | ✅ Yes | Install on RunPod/Vast — not a standalone service |
| **DigitalOcean / Hetzner** | CPU servers | ❌ Unusable for AI | — | ₹1,300–3,000/mo | — | ❌ **No GPU → cannot run our AI.** Only for hosting the website |

---

## 4. Privacy — which are safe for company data

- ✅ **Safe (data NOT used for training):** Cloudflare, DeepInfra, Together, Fireworks, OpenAI (API), Claude (API), Gemini **paid**, and any GPU we rent ourselves (RunPod/Vast + Ollama/vLLM).
- ❌ **NOT safe (data is logged / used for training):**
  - **OpenRouter free models (e.g. Nemotron free)** — fully free, but their policy logs and trains on the data we send. Our timesheet data includes employee names and work details → **should not be sent here**.
  - **Google / Gemini FREE tier** — also trains on submitted data. (Gemini **paid** tier is private.)

> Conclusion: free is attractive, but for **company/employee data** we must pick a **private** option. The free-but-trains options are fine only for testing with dummy data.

---

## 5. Cost calculation per option (20 users ≈ 72M tokens/month)

| Option | Rate used | Monthly cost (approx) |
|---|---|---|
| Cloudflare | $0.051/M in, $0.34/M out (minus free) | ~$5–7 → **₹400–600** |
| DeepInfra | $0.20/M in, $0.80/M out | ~$22 → **₹1,800** |
| Gemini 2.0 Flash (paid) | $0.10/M in, $0.40/M out | ~$11 → **₹900** |
| OpenAI GPT-4o-mini | $0.15/M in, $0.60/M out | ~$16 → **₹1,400** |
| RunPod serverless (4090) | $0.00031/sec GPU time (≈400–500 calls/day) | ~$19–23 → **₹1,600–2,000** |
| Claude Haiku 4.5 | $1/M in, $5/M out (caching reduces a lot) | ~$66–120 → **₹6,000–10,000** |
| OpenAI GPT-4o (full) | $2.50/M in, $10/M out | ~$270 → **₹23,000** |
| **OpenRouter premium (per-request model)** | **~$0.0968 per request** | 12,000 × $0.0968 = ~$1,162 → **₹98,800 (very expensive)** |
| Vast.ai 4090 / 5090 (24/7) | $0.37 / $0.45 per hour | **₹22,000 / ₹27,000** |
| OpenRouter Nemotron (free) | $0 | **₹0 — but trains data ❌** |

> **RunPod note:** it is charged by GPU-time, so cost depends on requests/day — ~₹1,600 at 400 calls/day, ~₹2,000 at 500 calls/day, and ~₹3,900 ($45.83) at 1,000 calls/day (the calculator's default). For ~20 users (~400–500 calls/day) it is ~₹1,600–2,000/month.
>
> The **per-request priced premium models** (like some Google/large models on OpenRouter at ~$0.0968/request) become **extremely expensive at scale** — ~₹1 lakh/month for our usage — and are not suitable for a high-volume internal tool.
>
> *Rates verified via web search in Jun 2026 (OpenAI GPT-4o-mini $0.15/$0.60, GPT-4o $2.50/$10; Claude Haiku 4.5 $1/$5; DeepInfra Qwen3-30B $0.20/$0.80; Gemini 2.0 Flash $0.10/$0.40). Cloudflare/RunPod/Vast.ai rates from their live pages.*

---

## 6. How many users each option supports

| Option | Comfortable user range | Notes |
|---|---|---|
| Cloudflare (free) | ~9–13 users | Free 10K neurons/day ≈ 185–270 calls/day |
| Cloudflare (paid) | 20–100+ | Auto-scales, cost grows slowly (very cheap per call) |
| DeepInfra / Together / OpenAI | 20–500+ | Scale freely, pay per use |
| RunPod serverless (4090) | 20–100+ | Auto-scales GPU workers; vLLM serves many at once |
| One rented GPU (4090/5090, always-on) | 20–80 concurrent | Handles 5–6 (or more) at the same time without crashing |
| Groq (free) | 1–2 users only | 8K tokens/min limit blocks multiple users |

> **Will it crash if 5–6 people use it together?** No. Ready APIs and GPU servers (with vLLM) handle many simultaneous users by queuing/batching/scaling. Only Groq's per-minute limit is a problem for a team.

---

## 7. Recommendation

**Phase 1 — start now (cheapest, safe, no setup):**
- **Cloudflare Workers AI** — ~₹400–600/month, private (no training), runs immediately. Slightly slow (3–4s) but reliable; comfortably covers ~20 users.

**Phase 2 — when speed matters or users grow:**
- **DeepInfra** (~₹900–2,000/mo, faster) **or** **RunPod Serverless (RTX 4090 + vLLM)** (~₹1,600–2,000/mo, fast, fully private, pay-per-use).

**Phase 3 — only if we want top quality + always-instant for a large team:**
- Rent **RTX 5090 (32GB)** (~₹27,000/mo) and run our own model 24/7.

**Avoid for company data:**
- OpenRouter free models and Gemini free tier (they train on our data).
- Per-request premium models (₹~1 lakh/month at our scale).
- DigitalOcean / Hetzner CPU servers (cannot run the AI model at all).
- Groq for a team (per-minute limit blocks multiple users).

---

## 8. One-paragraph summary for management

> For a private, low-cost start, run the AI on **Cloudflare Workers AI (~₹500/month)** — it keeps our employee data private and needs zero setup. If we later need faster responses or more users, move to **DeepInfra or a rented RTX 4090 with vLLM (~₹2,000/month)**. Renting a dedicated GPU 24/7 (₹22,000–27,000/month) is only worth it for a large, always-busy team. We should **avoid OpenRouter's free models and Gemini's free tier** because they use our data for training, and **avoid CPU-only servers** (DigitalOcean/Hetzner) because they cannot run the AI model.

---
*Report generated as a planning aid. Costs are estimates based on ~20 users and ~6,000 tokens per AI request; actual figures depend on real usage and current provider pricing.*
