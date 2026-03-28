import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMProvider, LLMMessage } from './index'

export function createGeminiProvider(): LLMProvider {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')

  return {
    async chat(messages: LLMMessage[], model: string): Promise<string> {
      const genModel = genAI.getGenerativeModel({ model })

      const systemMsg = messages.find((m) => m.role === 'system')
      const chatMessages = messages.filter((m) => m.role !== 'system')

      const history = chatMessages.slice(0, -1).map((m) => {
        const parts: any[] = []
        if (m.images?.length) {
          for (const img of m.images) {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
          }
        }
        if (m.content) parts.push({ text: m.content })
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        }
      })

      // Gemini needs history to start with user and alternate
      const cleaned: typeof history = []
      for (const msg of history) {
        const last = cleaned[cleaned.length - 1]
        if (last && last.role === msg.role) {
          last.parts.push(...msg.parts)
        } else {
          cleaned.push({ ...msg, parts: [...msg.parts] })
        }
      }
      if (cleaned.length > 0 && cleaned[0].role !== 'user') {
        cleaned.unshift({ role: 'user', parts: [{ text: '...' }] })
      }

      const chat = genModel.startChat({
        history: cleaned,
        systemInstruction: systemMsg ? { role: 'user', parts: [{ text: systemMsg.content }] } : undefined,
      })

      const lastMsg = chatMessages[chatMessages.length - 1]
      const parts: any[] = []
      if (lastMsg?.images?.length) {
        for (const img of lastMsg.images) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
        }
      }
      if (lastMsg?.content) parts.push({ text: lastMsg.content })

      const result = await chat.sendMessage(parts)
      return result.response.text()
    },
  }
}
