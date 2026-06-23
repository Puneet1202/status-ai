# status-ai · MCP server (local test)

Tumhare existing AI tools (add/query/analyze timesheet, leaves, projects, tasks...)
ko **Model Context Protocol** par expose karta hai. Claude Desktop (ya koi bhi MCP
client) se seedha "log 9-11 api work" / "show my hours this week" bol sakte ho —
app baar-baar kholne ki zaroorat nahi, voice/multilanguage host LLM khud handle
karta hai, aur tumhara Cloudflare AI quota bachta hai.

> ⚠️ Ye **alag entrypoint** hai — existing backend (`chat.js`, controller, brain)
> ko chhua nahi gaya. Sirf `dispatchTool` + tools reuse hue hai.

## Kaise kaam karta hai
1. Tum apna **JWT token** deta ho (`MCP_AUTH_TOKEN`) — wahi company/website wala token.
2. Server usi se DB se **employeeId + permissions** resolve karta hai (same auth chain).
3. Har tool call **usi bande ke data** par scope — normal employee dusre ka data
   nahi dekh/likh sakta (existing permission system enforce hota hai, bypass nahi).

## Token kaha se laun? (local test)
Website pe login karo → browser DevTools → Application → Local Storage →
`auth_token` (ya `access_token`) ki value copy karo. Yahi `MCP_AUTH_TOKEN` hai.
> Note: JWT kuch ghante me expire hota hai → expire ho to naya copy kar lo.
> (Aage "Generate API key" button banega → long-lived token, baar-baar copy nahi.)

## Quick test (terminal)
```bash
cd backend
MCP_AUTH_TOKEN=<your-jwt> npm run mcp
```
Stderr pe `stdio server ready · tools: 14` aaye = chal gaya.

## Claude Desktop me connect
`claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`)
me ye add karo:

```json
{
  "mcpServers": {
    "status-ai": {
      "command": "node",
      "args": ["C:\\Users\\Puneet Kumar\\Desktop\\day2\\status_app\\backend\\mcp\\server.mjs"],
      "env": {
        "MCP_AUTH_TOKEN": "<your-jwt-token>",
        "DB_FILE": "keyss-status.prod.db"
      }
    }
  }
}
```
Claude Desktop restart → 🔌 me `status-ai` ke tools dikhenge. Try: *"log 9 to 11 api
work today"* ya *"show my hours this week"*.

## Env
| var | matlab |
|-----|--------|
| `MCP_AUTH_TOKEN` | user ka JWT (required) — isi se scope hota hai |
| `DB_FILE` | SQLite/D1 base (default `keyss-status.prod.db`) |
| `ACCESS_TOKEN_SECRET` | JWT verify secret (sir ke `JWT_SECRET` ke barabar) |
| `MCP_TZ` | "today" ke liye timezone (default Asia/Kolkata) |

## Abhi ki limitation (local test build)
- **stdio (local) only** — Claude Desktop ke liye. ChatGPT / remote ke liye baad me
  Cloudflare Workers remote-MCP deploy karenge (public URL + per-user token).
- Add flow seedha `dispatchTool` se jaata hai (overlap-overwrite confirm UI nahi);
  overlap hua to tool apna message dega — host LLM use dikha dega.
