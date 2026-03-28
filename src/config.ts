export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'grok'

export interface ProviderConfig {
  name: string
  models: string[]
  defaultModel: string
}

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
    defaultModel: 'claude-sonnet-4-6',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
  },
  grok: {
    name: 'xAI Grok',
    models: ['grok-3', 'grok-3-mini', 'grok-2'],
    defaultModel: 'grok-3-mini',
  },
}

export function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export function getEnvOr(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}
