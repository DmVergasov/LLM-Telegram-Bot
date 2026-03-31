import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, LLMMessage } from './index'

export function createAnthropicProvider(): LLMProvider {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  return {
    async chat(messages: LLMMessage[], model: string): Promise<string> {
      const systemMsg = messages.find((m) => m.role === 'system')
      const chatMessages = messages.filter((m) => m.role !== 'system')

      const formatted = chatMessages.map((m) => {
        if (m.images?.length) {
          const content: any[] = []
          for (const img of m.images) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.mimeType,
                data: img.base64,
              },
            })
          }
          if (m.content) content.push({ type: 'text', text: m.content })
          return { role: m.role as 'user' | 'assistant', content }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      })

      // Anthropic requires alternating user/assistant starting with user
      const merged: typeof formatted = []
      for (const msg of formatted) {
        const last = merged[merged.length - 1]
        if (last && last.role === msg.role) {
          // Merge contents
          const lastContent = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]
          const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }]
          last.content = [...lastContent, ...msgContent]
        } else {
          merged.push({ ...msg })
        }
      }
      if (merged.length === 0 || merged[0].role !== 'user') {
        merged.unshift({ role: 'user', content: '...' })
      }

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemMsg?.content,
        messages: merged,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          } as any,
        ],
      })

      return response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
    },
  }
}
