# Deployment plan: Render Free + Supabase Free

Recommended MVP stack:

- Render Free Web Service for the Node.js app.
- Supabase Free for Postgres.
- Google Apps Script for Google Sheets duplication.
- Telegram Bot API for notifications.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy the project URL.
5. Copy the server-only database API credential from Project Settings.

Production environment variables:

```env
DATABASE_PROVIDER=supabase
SUPABASE_URL=your_project_url
SUPABASE_SERVER_KEY=your_server_only_value
```

## Render setup

Create a new Web Service from the GitHub repository.

Recommended settings:

```txt
Runtime: Node
Build command: npm install
Start command: npm start
Plan: Free
```

Set these values in Render Environment:

```env
NODE_ENV=production
PUBLIC_URL=https://your-render-app.onrender.com
ADMIN_TOKEN=your_long_random_admin_token
DATABASE_PROVIDER=supabase
SUPABASE_URL=your_project_url
SUPABASE_SERVER_KEY=your_server_only_value
GOOGLE_SHEETS_ENABLED=true
GOOGLE_APPS_SCRIPT_URL=your_apps_script_web_app_url
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Notes

- Do not commit `.env` to GitHub.
- Keep server-only Supabase credentials only in Render environment variables.
- Keep `admin.html` unlinked from public navigation.
- Use a long random `ADMIN_TOKEN` in production.

## Test order

1. Create Supabase project and run schema.
2. Create Render Web Service.
3. Add environment variables.
4. Test `/api/health`.
5. Submit a test lead from `/contact.html`.
6. Confirm lead appears in Supabase, Telegram, and Google Sheets.
