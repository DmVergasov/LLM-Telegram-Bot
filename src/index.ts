import { createBot } from './bot'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required. Set it in .env file.')
  process.exit(1)
}

const bot = createBot(token)

bot.catch((err) => {
  console.error('Bot error:', err)
})

bot.start({
  onStart: () => console.log('Bot is running...'),
  drop_pending_updates: true,
})
