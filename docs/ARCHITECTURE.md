# Agentic AI Timesheet — Architecture

This document describes the **request lifecycle** of the AI timesheet agent after the
production-hardening pass: a single LLM round-trip, sliding-window memory, a
plug-and-play tool registry, and parameterized DB access only (no LLM-generated SQL).

- **Frontend:** React (`AIChatbot.jsx`)
- **Edge runtime:** Hono on Cloudflare Workers
- **Model:** Workers AI — `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (native tool calling)
- **DB:** Cloudflare D1 (SQLite)

---

## 1. Request Lifecycle (sequence)

```mermaid
sequenceDiagram
    autonumber
    participant U as React · AIChatbot.jsx
    participant H as Hono · CORS + authMiddleware
    participant C as aiChatHandler (controller)
    participant A as aiChat (chat.js)
    participant P as cloudflare.js · askCloudflareAI
    participant W as Workers AI (Llama-70b)
    participant R as Tool Registry · dispatchTool
    participant D as D1 (SQLite)

    U->>H: POST /api/timesheet/ai/chat<br/>{ message, history[≤10], pendingAction, selectedProject }
    H->>H: JWT verify (HS256) → c.set('user')
    H->>C: authorized request

    alt pendingAction = DELETE_TIMESHEET AND user confirms
        C->>R: executeDelete(ctx, pendingAction)
        R->>D: DELETE ... WHERE id=? AND employee_id=?
        D-->>C: rows changed
        C-->>U: { reply: "… permanently deleted." }
    else normal turn
        C->>A: aiChat(env, userId, message, history)
        A->>A: buildSlidingWindow(history)  %% last N, char-budgeted
        A->>P: askCloudflareAI(systemPrompt, msg, window, getToolSchemas())
        P->>W: env.AI.run(model, payload)  [withTimeout 12s]
        W-->>P: tool_calls | text
        P-->>A: raw tool_calls object | trimmed string

        alt model chose a tool
            A-->>C: { action: { name, data } }
            C->>R: dispatchTool(name, data, ctx)
            R->>D: parameterized SQL (employee_id always bound)
            D-->>R: rows / write result
            R-->>C: { reply, data?, requiresConfirmation?, pendingAction? }
            C-->>U: JSON result
        else conversational
            A-->>C: { reply }
            C-->>U: { reply }
        end
    end

    Note over P,W: On WORKERS_AI_TIMEOUT → graceful<br/>"taking too long, please retry" (never hangs)
```

---

## 2. Decision Flow (routing + plug-and-play boundary)

```mermaid
flowchart TD
    Start([POST /ai/chat]) --> Auth{JWT valid?}
    Auth -- no --> R401[401 Unauthorized]
    Auth -- yes --> Confirm{pendingAction = DELETE<br/>and 'confirm'?}

    Confirm -- yes --> Exec[executeDelete → D1 DELETE] --> Done([reply])
    Confirm -- no --> Window[Build sliding window<br/>last 10 msgs, char-budgeted]

    Window --> LLM[[Single Workers AI call<br/>system prompt + tool schemas<br/>withTimeout 12s]]
    LLM -- timeout --> Graceful[reply: retry message] --> Done
    LLM --> Tool{tool_calls present?}

    Tool -- no --> Chat[Conversational reply] --> Done
    Tool -- yes --> Parse[safeParseArgs] --> Dispatch[[dispatchTool name,args,ctx]]

    subgraph REG["Tool Registry — the plug-and-play boundary (src/ai/tools/)"]
      direction LR
      Dispatch --> T1[add_timesheet_entries]
      Dispatch --> T2[get_timesheet_logs]
      Dispatch --> T3[delete_timesheet]
      Dispatch --> Tn["…add 10 more:<br/>leave_request, invoice_generate…<br/>1 file + 1 import, zero core edits"]
    end

    T1 --> DB[(D1 · parameterized)]
    T2 --> DB
    T3 --> DB
    Tn --> DB
    DB --> Done
```

---

## 3. Plug-and-Play: adding a tool

Everything the model sees and everything the runtime dispatches is **derived from one
array** in `src/ai/tools/index.js`. Adding capability is a closed, local change:

```mermaid
flowchart LR
    New["Create src/ai/tools/leaveRequest.tool.js<br/>export default { name, schema, handler }"]
      --> Reg["Add to MODULES in tools/index.js"]
    Reg --> S1["getToolSchemas() → model function schemas"]
    Reg --> S2["getToolDirectory() → system-prompt routing block"]
    Reg --> S3["dispatchTool() → runtime handler"]
    S1 & S2 & S3 --> Zero["✅ chat.js & controller UNCHANGED"]
```

**Contract for a tool module:**

| Export | Shape | Purpose |
|--------|-------|---------|
| `name` | `string` | Stable tool id (matches `schema.name`). |
| `schema` | `{ name, description, parameters }` | OpenAI/Llama function-calling schema. |
| `handler` | `async (ctx, args) => result` | Executes the action. `ctx = { db, user, env, selectedProject, today }`. Returns `{ reply, … }`, or `{ requiresConfirmation, pendingAction, reply }` for destructive ops. |

---

## 4. Key invariants (why this is safe & fast)

| Concern | Mechanism | Location |
|---------|-----------|----------|
| **No SQL injection / exfiltration** | Model never emits SQL. Every query is parameterized; `employee_id` is always bound to the JWT user. | `src/ai/tools/*.tool.js` |
| **Latency / timeout** | One LLM round-trip per turn (was up to 3). Hard 12s `withTimeout` on the model call → graceful fallback. | `chat.js`, `cloudflare.js` |
| **Token bloat** | Sliding window: last `MAX_HISTORY_MESSAGES` (10), evict-oldest until under `MAX_TOTAL_CHARS`. | `chat.js`, `ai-config.js` |
| **Memory** | Frontend forwards prior `{role,content}` turns; backend windows them into the prompt. | `AIChatbot.jsx`, `chat.js` |
| **Destructive safety** | Delete is two-phase: locate + confirm, then `executeDelete` on an explicit "confirm". | `deleteTimesheet.tool.js`, controller |
| **No year hardcode** | `isValidEntryDate()` validates real calendar dates; future dates clamp to today. | `tools/_helpers.js` |

---

## 5. Configuration knobs (`src/ai/ai-config.js`)

| Constant | Default | Effect |
|----------|---------|--------|
| `MAX_HISTORY_MESSAGES` | `10` | Conversational memory depth (≈5 turns). |
| `MAX_TOTAL_CHARS` | `52000` | Char budget for the windowed context. |
| `MAX_MESSAGE_CHARS` | `4000` | Single-message size cap. |
| `AI_TIMEOUT_MS` | `12000` | Hard ceiling on a Workers AI call. |
| `CHAT_MODEL` | `llama-3.3-70b…fp8-fast` | Routing + extraction model. |
