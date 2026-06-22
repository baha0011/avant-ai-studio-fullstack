# Avant AI Studio — full-stack website

This is a full-stack mini website for **Avant AI Studio**.

It is not just a static landing page. The project includes:

- multi-page frontend;
- Ukrainian / English language switcher;
- Node.js + Express backend;
- SQLite database for leads;
- Google Sheets integration instead of CRM;
- Telegram notifications for administrators;
- simple admin panel for viewing leads and changing statuses.

## Project structure

```txt
avant-ai-studio-fullstack/
├── public/
│   ├── index.html
│   ├── services.html
│   ├── integrations.html
│   ├── process.html
│   ├── contact.html
│   ├── admin.html
│   └── assets/
│       ├── css/styles.css
│       └── js/app.js
├── src/
│   ├── server.js
│   ├── db.js
│   ├── googleSheets.js
│   ├── telegram.js
│   └── validators.js
├── data/
│   └── .gitkeep
├── package.json
├── .env.example
└── README.md
```

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```txt
http://localhost:3000
```

Admin panel:

```txt
http://localhost:3000/admin.html
```

## How lead flow works

1. User fills the form on `contact.html`.
2. Frontend sends `POST /api/leads`.
3. Express backend validates the request.
4. SQLite stores the lead in `data/avant.sqlite`.
5. Backend tries to append the lead to Google Sheets.
6. Backend tries to send a Telegram notification.
7. Admin can open `/admin.html` and see leads from the database.

Important: even if Google Sheets or Telegram fails, the lead is still saved in the database.

## API endpoints

### Health check

```http
GET /api/health
```

### Create lead

```http
POST /api/leads
Content-Type: application/json
```

Body:

```json
{
  "name": "Client Name",
  "contact": "@telegram_or_phone",
  "niche": "clinic",
  "message": "Need AI assistant for appointments",
  "language": "uk",
  "source": "website"
}
```

### List leads

Protected by `ADMIN_TOKEN`.

```http
GET /api/leads
X-Admin-Token: your_admin_token
```

### Change lead status

Protected by `ADMIN_TOKEN`.

```http
PATCH /api/leads/:id/status
X-Admin-Token: your_admin_token
Content-Type: application/json
```

Body:

```json
{
  "status": "in_progress"
}
```

Allowed statuses:

- `new`
- `in_progress`
- `closed`
- `cancelled`

## Environment variables

Create `.env` from `.env.example`.

```env
PORT=3000
NODE_ENV=development
PUBLIC_URL=http://localhost:3000
ADMIN_TOKEN=change-this-long-random-token
DATABASE_PATH=./data/avant.sqlite
```

## Telegram setup

1. Open Telegram.
2. Find `@BotFather`.
3. Create a new bot.
4. Copy the bot token.
5. Add the bot to your admin chat, group, or channel.
6. Get `chat_id`.
7. Update `.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:ABCDEF_your_bot_token
TELEGRAM_CHAT_ID=123456789
```

## Google Sheets setup

1. Create a Google Cloud project.
2. Enable Google Sheets API.
3. Create a Service Account.
4. Create a key in JSON format.
5. Copy `client_email` to `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
6. Copy `private_key` to `GOOGLE_PRIVATE_KEY`.
7. Create a Google Sheet.
8. Share the sheet with the service account email.
9. Copy the Sheet ID from the URL.
10. Update `.env`:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SHEET_TAB=Leads
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

Recommended Google Sheet columns:

```txt
Created At | Lead ID | Name | Contact | Niche | Message | Language | Source | Status
```

## What to replace before publishing

- Telegram placeholder: `@your_username`.
- Email: `hello@avantai.studio`.
- Phone: `+380 XX XXX XX XX`.
- Instagram / LinkedIn placeholder.
- `ADMIN_TOKEN` in `.env`.
- Google Sheets credentials.
- Telegram bot token and chat ID.
- Real domain and deployment settings.

## Deployment notes

For production you need:

- Node.js hosting: Render, Railway, Fly.io, VPS, DigitalOcean, Hetzner, etc.
- HTTPS domain.
- Persistent disk for SQLite or switch to PostgreSQL if hosting does not provide persistent storage.
- Environment variables configured on the server.

If you deploy to serverless hosting without persistent storage, SQLite is not ideal. In that case, use PostgreSQL, Supabase, Neon, or another external database.
