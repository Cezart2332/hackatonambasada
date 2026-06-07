# Warm Leads

B2B platform for local producers and HoReCa venues in Dobrogea (React + Express + FastAPI + PostgreSQL).

## Quick start (Docker)

```bash
cp .env.example .env
# Fill in secrets (OPEN_ROUTER_KEY, UNIPILE_API_KEY, INTERNAL_API_TOKEN, etc.)

docker compose up
```

Services:

| Service       | URL (host)              | Notes                          |
|---------------|-------------------------|--------------------------------|
| Frontend      | http://localhost:5173   | Not exposed via Cloudflare     |
| Backend API   | http://localhost:3001   | Target for Unipile webhooks    |
| AI service    | http://localhost:8000   | Internal + host-mapped         |
| PostgreSQL    | localhost:5433          |                                |

## Environment (Unipile + tunnel)

```env
UNIPILE_API_KEY=
UNIPILE_BASE_URL=https://api.unipile.com/v2
UNIPILE_WEBHOOK_SECRET=
CLOUDFLARE_TUNNEL_URL=
APP_URL=http://backend:3001
INTERNAL_API_TOKEN=your-shared-secret
```

- `APP_URL` — Node backend URL (Python AI service calls back here to send messages).
- `INTERNAL_API_TOKEN` — shared secret between `ai-service` and Node (`X-Internal-Token` header).

## Google sign-in (Better Auth)

Add to `.env`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BETTER_AUTH_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth client:

| Setting | Value |
|---------|--------|
| **Authorized JavaScript origins** | `http://localhost:5173`, `http://localhost:3001` |
| **Authorized redirect URIs** | `http://localhost:3001/api/auth/callback/google` |

Restart backend after changing env:

```bash
docker compose restart backend
```

The login screen shows **Continuă cu Google**. First-time Google users are created automatically; they still complete producer/venue onboarding in the app.

## Cloudflare Tunnel (Unipile webhooks)

Unipile must reach your backend over HTTPS. In development, `cloudflared` creates a temporary public URL that forwards to the **backend container** on the Docker network (`http://backend:3001`), not `localhost`.

### Start stack

```bash
docker compose up
```

### Get the public tunnel URL

```bash
docker compose logs -f cloudflared
```

Look for a line like:

```txt
https://something-random.trycloudflare.com
```

Copy that base URL into `.env`:

```env
CLOUDFLARE_TUNNEL_URL=https://something-random.trycloudflare.com
```

### Configure Unipile

In the [Unipile dashboard](https://dashboard.unipile.com), set the webhook URL to:

```txt
https://something-random.trycloudflare.com/api/webhooks/unipile
```

<!-- TODO: replace `something-random` with the URL from `docker compose logs cloudflared` -->

Also set `UNIPILE_API_KEY` and `UNIPILE_WEBHOOK_SECRET` in `.env`.

The tunnel URL changes each time `cloudflared` restarts (quick tunnel mode). Update Unipile when it changes.

## Unipile account connection

Users connect WhatsApp or Gmail via Hosted Auth (your Unipile account + API key). No separate Unipile login for end users.

### Connect WhatsApp (authenticated)

```http
POST /api/integrations/unipile/connect
Content-Type: application/json
Cookie: <session>

{
  "provider": "whatsapp"
}
```

Response:

```json
{ "url": "https://..." }
```

Open the URL in the browser to complete OAuth. Unipile sends a webhook with `state`/`name` = `userId` to link the account.

## AI lead outreach (draft / send)

Default mode is **`draft`** — AI composes the message but does **not** send. Use `mode: "send"` only after user approval.

### Draft (no send)

```http
POST /api/ai/lead-outreach
Content-Type: application/json
Cookie: <session>

{
  "leadName": "Andrei",
  "companyName": "Restaurant Dobrogea",
  "phone": "+407xxxxxxxx",
  "context": "Producător local de miere vrea să propună colaborare B2B cu restaurantul.",
  "preferredChannel": "whatsapp",
  "mode": "draft"
}
```

### Send (requires connected WhatsApp/Gmail integration)

```http
POST /api/ai/lead-outreach
Content-Type: application/json
Cookie: <session>

{
  "leadName": "Andrei",
  "companyName": "Restaurant Dobrogea",
  "phone": "+407xxxxxxxx",
  "context": "Producător local de miere vrea să propună colaborare B2B cu restaurantul.",
  "preferredChannel": "whatsapp",
  "mode": "send"
}
```

## Test webhook locally

```bash
curl -X POST http://localhost:3001/api/webhooks/unipile \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"account.connected\",\"account_id\":\"acc_123\",\"state\":\"USER_ID_HERE\",\"provider\":\"WHATSAPP\"}"
```

Expected:

```json
{"received":true,"processed":true,"accountId":"acc_123","status":"CONNECTED"}
```

## Architecture notes

- Node owns Unipile credentials, `Integration` DB records, and webhooks: `server/src/modules/unipile/`.
- Python LangGraph outreach: `ai-service/app/agent/lead_outreach_graph.py`.
- Send tool calls Node: `POST /api/integrations/unipile/send` with `X-Internal-Token`.
- Only backend is tunneled; frontend stays on localhost.

## Local dev without Docker

```bash
# Terminal 1 — backend
cd server && npm install && npm run dev

# Terminal 2 — frontend
npm install && npm run dev

# Terminal 3 — AI service
cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload
```

For Unipile webhooks without Docker:

```bash
cloudflared tunnel --url http://localhost:3001
```
