import type { ChatMessage } from '../db'
import type { ProviderName } from '../config'
import { createOpenAIProvider } from './openai'
import { createAnthropicProvider } from './anthropic'
import { createGeminiProvider } from './gemini'
import { createGrokProvider } from './grok'

export interface ImageAttachment {
  base64: string
  mimeType: string
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: ImageAttachment[]
}

export interface LLMProvider {
  chat(messages: LLMMessage[], model: string): Promise<string>
}

const providers = new Map<ProviderName, LLMProvider>()

export function getProvider(name: ProviderName): LLMProvider {
  let provider = providers.get(name)
  if (provider) return provider

  switch (name) {
    case 'openai':
      provider = createOpenAIProvider()
      break
    case 'anthropic':
      provider = createAnthropicProvider()
      break
    case 'gemini':
      provider = createGeminiProvider()
      break
    case 'grok':
      provider = createGrokProvider()
      break
    default:
      throw new Error(`Unknown provider: ${name}`)
  }

  providers.set(name, provider)
  return provider
}
