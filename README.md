# LLM Telegram Bot

Telegram-бот с поддержкой нескольких LLM-провайдеров. Работает в личных сообщениях и групповых чатах.

## Провайдеры

| Провайдер | Модели по умолчанию | Доступные модели |
|-----------|-------------------|------------------|
| OpenAI | gpt-4o | gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o4-mini |
| Anthropic | claude-sonnet-4-6 | claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6 |
| Google Gemini | gemini-2.5-flash | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash |
| xAI Grok | grok-3-mini | grok-3, grok-3-mini, grok-2 |

## Возможности

- Переключение между провайдерами и моделями на лету
- История сообщений с хранением в локальной SQLite (через `bun:sqlite`)
- Понимание изображений (фото и документы-картинки)
- Цепочки ответов (reply chains) в группах
- Форматирование ответов в Telegram MarkdownV2
- Кастомные системные промпты для каждого чата

## Требования

- [Bun](https://bun.sh/) >= 1.0
- Telegram Bot Token (от [@BotFather](https://t.me/BotFather))
- API-ключ хотя бы одного провайдера

## Установка

```bash
git clone <repo-url>
cd LLM-Telegram-Bot
bun install
```

Создай файл `.env` на основе шаблона:

```bash
cp .env.example .env
```

Заполни ключи в `.env`:

```env
TELEGRAM_BOT_TOKEN=токен_от_botfather
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
XAI_API_KEY=xai-...
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
```

Не обязательно заполнять все ключи — только для тех провайдеров, которые будешь использовать.

## Запуск

```bash
bun run start
```

Для разработки с авто-перезагрузкой:

```bash
bun run dev
```

### Windows: фоновый запуск

```bash
# Запуск в фоне (через VBScript, без окна консоли)
wscript start.vbs

# Перезапуск
restart.bat

# Остановка
stop.bat
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и текущие настройки |
| `/provider <name>` | Переключить провайдера (openai, anthropic, gemini, grok) |
| `/model <name>` | Переключить модель |
| `/history on\|off` | Включить/выключить историю сообщений как контекст |
| `/system <text>` | Задать системный промпт |
| `/system clear` | Убрать системный промпт |
| `/reset` | Очистить историю сообщений |
| `/settings` | Показать текущие настройки |

## Работа в группах

Бот отвечает в группах только когда:
- Упомянут через `@username`
- Получает реплай на своё сообщение

Если история включена — бот запоминает сообщения всех участников для контекста.

## Структура проекта

```
src/
  index.ts          — точка входа
  bot.ts            — логика бота (команды, обработка сообщений, MarkdownV2)
  config.ts         — конфигурация провайдеров
  db.ts             — SQLite база (история, настройки чатов)
  providers/
    index.ts        — интерфейс провайдера
    openai.ts       — OpenAI
    anthropic.ts    — Anthropic
    gemini.ts       — Google Gemini
    grok.ts         — xAI Grok
data/
  bot.db            — SQLite база данных (создаётся автоматически)
  bot.log           — лог бота
```

## Данные

Все данные хранятся локально в `data/bot.db`:
- **messages** — история сообщений (chat_id, role, content, telegram_message_id, timestamps)
- **chat_settings** — настройки по каждому чату (провайдер, модель, история, системный промпт)
