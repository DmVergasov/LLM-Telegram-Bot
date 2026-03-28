import { Database } from 'bun:sqlite'
import { join } from 'path'
import type { ProviderName } from './config'

const DB_PATH = join(import.meta.dir, '..', 'data', 'bot.db')

// Ensure data directory exists
import { mkdirSync } from 'fs'
mkdirSync(join(import.meta.dir, '..', 'data'), { recursive: true })

const db = new Database(DB_PATH)
db.exec('PRAGMA journal_mode=WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    telegram_message_id INTEGER,
    reply_to_message_id INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_settings (
    chat_id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    history_enabled INTEGER NOT NULL DEFAULT 1,
    system_prompt TEXT DEFAULT NULL
  )
`)

db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at)`)

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatSettings {
  chat_id: number
  provider: ProviderName
  model: string
  history_enabled: boolean
  system_prompt: string | null
}

export function getSettings(chatId: number): ChatSettings {
  const row = db.query('SELECT * FROM chat_settings WHERE chat_id = ?').get(chatId) as any
  if (row) {
    return {
      chat_id: row.chat_id,
      provider: row.provider,
      model: row.model,
      history_enabled: !!row.history_enabled,
      system_prompt: row.system_prompt,
    }
  }
  const defaults: ChatSettings = {
    chat_id: chatId,
    provider: (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'anthropic',
    model: process.env.DEFAULT_MODEL ?? 'claude-haiku-4-5-20251001',
    history_enabled: false,
    system_prompt: null,
  }
  db.query(
    'INSERT INTO chat_settings (chat_id, provider, model, history_enabled, system_prompt) VALUES (?, ?, ?, ?, ?)',
  ).run(defaults.chat_id, defaults.provider, defaults.model, defaults.history_enabled ? 1 : 0, defaults.system_prompt)
  return defaults
}

export function updateSettings(chatId: number, updates: Partial<Omit<ChatSettings, 'chat_id'>>) {
  const current = getSettings(chatId)
  const merged = { ...current, ...updates }
  db.query(
    'UPDATE chat_settings SET provider = ?, model = ?, history_enabled = ?, system_prompt = ? WHERE chat_id = ?',
  ).run(merged.provider, merged.model, merged.history_enabled ? 1 : 0, merged.system_prompt, chatId)
}

export function addMessage(chatId: number, role: string, content: string, telegramMsgId?: number, replyToMsgId?: number) {
  db.query(
    'INSERT INTO messages (chat_id, role, content, telegram_message_id, reply_to_message_id) VALUES (?, ?, ?, ?, ?)',
  ).run(chatId, role, content, telegramMsgId ?? null, replyToMsgId ?? null)
}

export function getHistory(chatId: number, limit = 50): ChatMessage[] {
  const rows = db.query(
    'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(chatId, limit) as any[]
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }))
}

export function getReplyChain(chatId: number, telegramMsgId: number, maxDepth = 10): ChatMessage[] {
  const messages: ChatMessage[] = []
  let currentId: number | null = telegramMsgId

  for (let i = 0; i < maxDepth && currentId; i++) {
    const row = db.query(
      'SELECT role, content, reply_to_message_id FROM messages WHERE chat_id = ? AND telegram_message_id = ?',
    ).get(chatId, currentId) as any
    if (!row) break
    messages.unshift({ role: row.role, content: row.content })
    currentId = row.reply_to_message_id
  }

  return messages
}

export function clearHistory(chatId: number) {
  db.query('DELETE FROM messages WHERE chat_id = ?').run(chatId)
}

export { db }
