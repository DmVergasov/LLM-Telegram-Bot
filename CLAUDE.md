# Telegram LLM Bot

Telegram-бот с поддержкой нескольких LLM-провайдеров (OpenAI, Anthropic, Google Gemini).

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Telegram**: grammy
- **Database**: bun:sqlite (SQLite, WAL mode)
- **LLM SDKs**: openai, @anthropic-ai/sdk, @google/generative-ai

## Project Structure

```
src/
├── index.ts           — Entry point, starts the bot
├── bot.ts             — Bot handlers, commands, message routing
├── config.ts          — Provider configs, model lists, env helpers
├── db.ts              — SQLite schema, history & settings CRUD
└── providers/
    ├── index.ts       — Provider interface & factory
    ├── openai.ts      — OpenAI chat completions
    ├── anthropic.ts   — Anthropic messages API
    └── gemini.ts      — Google Generative AI
data/
└── bot.db             — SQLite database (auto-created)
```

## Commands

```
bun run start          — Run the bot
bun run dev            — Run with --watch (auto-restart on changes)
```

## Environment Variables (.env)

```
TELEGRAM_BOT_TOKEN     — Required
OPENAI_API_KEY         — For OpenAI provider
ANTHROPIC_API_KEY      — For Anthropic provider
GOOGLE_API_KEY         — For Gemini provider
DEFAULT_PROVIDER       — Default: openai
DEFAULT_MODEL          — Default: gpt-4o
```

## Bot Behavior

- **DM**: All messages go into one context. `/reset` clears it.
- **Groups**: Responds only when @mentioned or replied to. Context is built from the reply chain.
- Per-chat settings stored in SQLite (provider, model, history on/off, system prompt).

## Code Conventions

- No classes, functional style
- Provider interface: `{ chat(messages, model): Promise<string> }`
- Messages stored with telegram_message_id for reply chain traversal
- Anthropic/Gemini providers handle message format normalization internally
