import OpenAI from 'openai'
import type { LLMProvider, LLMMessage } from './index'

export function createGrokProvider(): LLMProvider {
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  return {
    async chat(messages: LLMMessage[], model: string): Promise<string> {
      const formatted = messages.map((m) => {
        if (m.images?.length) {
          const content: any[] = []
          for (const img of m.images) {
            content.push({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            })
          }
          if (m.content) content.push({ type: 'text', text: m.content })
          return { role: m.role, content }
        }
        return { role: m.role, content: m.content }
      })

      const response = await client.chat.completions.create({
        model,
        messages: formatted as any,
        search_parameters: {
          mode: 'auto',
          sources: ['web', 'x'],
        },
      } as any)
      return response.choices[0]?.message?.content ?? ''
    },
  }
}
