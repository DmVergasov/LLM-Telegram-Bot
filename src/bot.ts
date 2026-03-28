import { Bot } from 'grammy'
import { PROVIDERS, type ProviderName } from './config'
import { getSettings, updateSettings, addMessage, getHistory, getReplyChain, clearHistory, type ChatMessage } from './db'
import { getProvider, type LLMMessage, type ImageAttachment } from './providers/index'

export function createBot(token: string) {
  const bot = new Bot(token)
  let botUsername = ''

  bot.api.getMe().then((me) => {
    botUsername = me.username ?? ''
    console.log(`Bot started as @${botUsername}`)
  })

  // --- Download photo helper ---

  async function downloadPhoto(fileId: string): Promise<ImageAttachment | null> {
    try {
      const file = await bot.api.getFile(fileId)
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
      const resp = await fetch(url)
      if (!resp.ok) return null
      const buffer = await resp.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const ext = file.file_path?.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      return { base64, mimeType }
    } catch (err) {
      console.error('Failed to download photo:', err)
      return null
    }
  }

  async function getPhotosFromMessage(msg: any): Promise<ImageAttachment[]> {
    const images: ImageAttachment[] = []
    if (msg.photo?.length) {
      // Telegram sends multiple sizes, take the largest
      const largest = msg.photo[msg.photo.length - 1]
      const img = await downloadPhoto(largest.file_id)
      if (img) images.push(img)
    }
    if (msg.document?.mime_type?.startsWith('image/')) {
      const img = await downloadPhoto(msg.document.file_id)
      if (img) images.push(img)
    }
    return images
  }

  // --- Commands ---

  bot.command('start', async (ctx) => {
    const settings = getSettings(ctx.chat.id)
    await ctx.reply(
      `Привет! Я LLM-бот.\n\n` +
      `Текущий провайдер: ${PROVIDERS[settings.provider].name}\n` +
      `Модель: ${settings.model}\n` +
      `История: ${settings.history_enabled ? 'вкл' : 'выкл'}\n\n` +
      `Команды:\n` +
      `/provider — выбрать провайдера\n` +
      `/model — выбрать модель\n` +
      `/history — вкл/выкл историю\n` +
      `/system — задать системный промпт\n` +
      `/reset — очистить историю\n` +
      `/settings — текущие настройки`,
    )
  })

  bot.command('settings', async (ctx) => {
    const s = getSettings(ctx.chat.id)
    await ctx.reply(
      `Провайдер: ${PROVIDERS[s.provider].name}\n` +
      `Модель: ${s.model}\n` +
      `История: ${s.history_enabled ? 'вкл' : 'выкл'}\n` +
      `Системный промпт: ${s.system_prompt ? s.system_prompt.slice(0, 100) + (s.system_prompt.length > 100 ? '...' : '') : '(не задан)'}`,
    )
  })

  bot.command('provider', async (ctx) => {
    const arg = ctx.match?.trim().toLowerCase()
    if (arg && arg in PROVIDERS) {
      const provider = arg as ProviderName
      const defaultModel = PROVIDERS[provider].defaultModel
      updateSettings(ctx.chat.id, { provider, model: defaultModel })
      await ctx.reply(`Провайдер: ${PROVIDERS[provider].name}\nМодель: ${defaultModel}`)
      return
    }
    const list = Object.entries(PROVIDERS)
      .map(([key, p]) => `• /provider ${key} — ${p.name}`)
      .join('\n')
    await ctx.reply(`Выбери провайдера:\n\n${list}`)
  })

  bot.command('model', async (ctx) => {
    const arg = ctx.match?.trim()
    const settings = getSettings(ctx.chat.id)

    if (arg) {
      updateSettings(ctx.chat.id, { model: arg })
      await ctx.reply(`Модель: ${arg}`)
      return
    }

    const models = PROVIDERS[settings.provider].models
    const list = models.map((m) => `• /model ${m}`).join('\n')
    await ctx.reply(`Текущая: ${settings.model}\n\nДоступные (${PROVIDERS[settings.provider].name}):\n${list}\n\nИли введи любое название модели.`)
  })

  bot.command('history', async (ctx) => {
    const arg = ctx.match?.trim().toLowerCase()
    const settings = getSettings(ctx.chat.id)

    if (arg === 'on' || arg === 'вкл') {
      updateSettings(ctx.chat.id, { history_enabled: true })
      await ctx.reply('История включена.')
    } else if (arg === 'off' || arg === 'выкл') {
      updateSettings(ctx.chat.id, { history_enabled: false })
      await ctx.reply('История выключена. Каждое сообщение — отдельный запрос.')
    } else {
      await ctx.reply(`История: ${settings.history_enabled ? 'вкл' : 'выкл'}\n\n/history on — включить\n/history off — выключить`)
    }
  })

  bot.command('system', async (ctx) => {
    const arg = ctx.match?.trim()
    if (!arg) {
      const s = getSettings(ctx.chat.id)
      await ctx.reply(s.system_prompt ? `Текущий:\n${s.system_prompt}\n\n/system <текст> — задать\n/system clear — убрать` : 'Системный промпт не задан.\n/system <текст> — задать')
      return
    }
    if (arg === 'clear') {
      updateSettings(ctx.chat.id, { system_prompt: null })
      await ctx.reply('Системный промпт убран.')
      return
    }
    updateSettings(ctx.chat.id, { system_prompt: arg })
    await ctx.reply('Системный промпт задан.')
  })

  bot.command('reset', async (ctx) => {
    clearHistory(ctx.chat.id)
    await ctx.reply('История очищена.')
  })

  // --- Message handling (text + photos) ---

  bot.on(['message:text', 'message:photo', 'message:document'], async (ctx) => {
    const chatId = ctx.chat.id
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'
    const text = ctx.message.text ?? ctx.message.caption ?? ''
    const messageId = ctx.message.message_id
    const replyToId = ctx.message.reply_to_message?.message_id

    console.log(`[msg] chat=${chatId} isGroup=${isGroup} msgId=${messageId} replyToId=${replyToId} hasPhoto=${'photo' in ctx.message} text="${text.slice(0, 80)}"`)

    // In groups: only respond if bot is mentioned or replied to
    if (isGroup) {
      const mentionsBot =
        text.includes(`@${botUsername}`) ||
        ctx.message.reply_to_message?.from?.id === bot.botInfo?.id

      if (!mentionsBot) {
        const settings = getSettings(chatId)
        if (settings.history_enabled) {
          const userName = ctx.from?.first_name ?? 'User'
          addMessage(chatId, 'user', `[${userName}]: ${text}`, messageId, replyToId)
        }
        return
      }
    }

    const settings = getSettings(chatId)

    // Clean bot mention from text
    const cleanText = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim()
    if (!cleanText && !('photo' in ctx.message) && !('document' in ctx.message)) return

    // Save user message
    addMessage(chatId, 'user', isGroup ? `[${ctx.from?.first_name ?? 'User'}]: ${cleanText || '[фото]'}` : (cleanText || '[фото]'), messageId, replyToId)

    // Download images from current message
    const currentImages = await getPhotosFromMessage(ctx.message)

    // Build message list
    const messages: LLMMessage[] = []

    const defaultSystemPrompt = 'Always respond in the same language as the user\'s message. If the user writes in Russian, respond in Russian. If in English, respond in English. Match the language exactly.'
    messages.push({ role: 'system', content: settings.system_prompt ? `${defaultSystemPrompt}\n\n${settings.system_prompt}` : defaultSystemPrompt })

    // Context from reply chain or history
    if (isGroup && replyToId) {
      // Try DB first
      const chain = getReplyChain(chatId, replyToId)
      if (chain.length > 0) {
        messages.push(...chain.map(m => ({ ...m, images: undefined })))
      }
      // Fallback: use replied-to message directly from Telegram
      if (ctx.message.reply_to_message) {
        const replyMsg = ctx.message.reply_to_message as any
        const replyText = replyMsg.text ?? replyMsg.caption ?? ''
        const replyImages = await getPhotosFromMessage(replyMsg)

        if ((replyText || replyImages.length) && chain.length === 0) {
          const isFromBot = replyMsg.from?.id === bot.botInfo?.id
          const authorName = replyMsg.from?.first_name ?? 'User'
          messages.push({
            role: isFromBot ? 'assistant' : 'user',
            content: isFromBot ? replyText : `[${authorName}]: ${replyText || '[фото]'}`,
            images: replyImages.length > 0 ? replyImages : undefined,
          })
        }
      }
    } else if (settings.history_enabled) {
      const history = getHistory(chatId)
      const pastMessages = history.slice(0, -1)
      messages.push(...pastMessages.map(m => ({ ...m, images: undefined })))
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: cleanText || 'Что на этом изображении?',
      images: currentImages.length > 0 ? currentImages : undefined,
    })

    // Send typing indicator
    await ctx.replyWithChatAction('typing')

    try {
      const provider = getProvider(settings.provider)
      const reply = await provider.chat(messages, settings.model)

      if (!reply) {
        await ctx.reply('Пустой ответ от модели.', { reply_to_message_id: messageId })
        return
      }

      const chunks = splitMessage(reply, 4096)
      for (const chunk of chunks) {
        let sent
        try {
          const formatted = toTelegramMd2(chunk)
          sent = await ctx.reply(formatted, {
            reply_to_message_id: isGroup ? messageId : undefined,
            parse_mode: 'MarkdownV2',
          })
        } catch {
          // Fallback to plain text if MarkdownV2 parsing fails
          sent = await ctx.reply(chunk, {
            reply_to_message_id: isGroup ? messageId : undefined,
          })
        }
        addMessage(chatId, 'assistant', chunk, sent.message_id, messageId)
      }
    } catch (err: any) {
      const errMsg = err?.message ?? String(err)
      console.error(`LLM error [${settings.provider}/${settings.model}]:`, errMsg)
      await ctx.reply(`Ошибка: ${errMsg.slice(0, 500)}`, { reply_to_message_id: messageId })
    }
  })

  return bot
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1')
}

function toTelegramMd2(text: string): string {
  // Split into code blocks / inline code / plain text
  const segments: Array<{ type: 'code' | 'text'; raw: string }> = []
  const codePattern = /(```[\s\S]*?```|`[^`\n]+`)/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = codePattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: 'text', raw: text.slice(lastIdx, m.index) })
    }
    segments.push({ type: 'code', raw: m[0] })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', raw: text.slice(lastIdx) })
  }

  return segments
    .map((seg) => {
      if (seg.type === 'code') return seg.raw

      let t = seg.raw

      // Convert markdown headers → bold markers
      t = t.replace(/^#{1,6}\s+(.+)$/gm, '**$1**')

      // Convert **bold** → *bold* (Telegram MarkdownV2 bold)
      const parts: string[] = []
      const boldRe = /\*\*(.+?)\*\*/gs
      let bLast = 0
      let bm: RegExpExecArray | null
      while ((bm = boldRe.exec(t)) !== null) {
        if (bm.index > bLast) parts.push(escapeMarkdownV2(t.slice(bLast, bm.index)))
        parts.push('*' + escapeMarkdownV2(bm[1]) + '*')
        bLast = bm.index + bm[0].length
      }
      if (bLast < t.length) parts.push(escapeMarkdownV2(t.slice(bLast)))

      return parts.join('')
    })
    .join('')
}

function splitMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }
    let splitAt = remaining.lastIndexOf('\n', limit)
    if (splitAt < limit * 0.3) splitAt = limit
    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).trimStart()
  }
  return chunks
}
