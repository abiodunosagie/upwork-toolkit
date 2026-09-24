import Anthropic from '@anthropic-ai/sdk'

// Sonnet 5: short writing task, faster first token and ~2.5x cheaper than Opus 5.
const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 16000

/** Claude declined the request; expected behaviour, not a crash to report. */
export class ClaudeRefusalError extends Error {}

/**
 * Streams a cover letter from the Claude Messages API using the user's own
 * API key. Each text token is delivered through `onChunk` as it arrives.
 *
 * Runs in the background service worker, so `dangerouslyAllowBrowser` is
 * required: the key is the user's own and never leaves their browser except
 * to api.anthropic.com. Server-side refusal fallbacks are enabled so a
 * declined request is retried on the fallback model inside the same call.
 */
const generateCoverLetter = async (props: {
  apiKey: string
  prompt: string
  signal?: AbortSignal
  onChunk: (chunk: string) => void
}): Promise<void> => {
  const client = new Anthropic({
    apiKey: props.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: props.prompt }],
    },
    { signal: props.signal }
  )

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      props.onChunk(event.delta.text)
    }
  }

  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    throw new ClaudeRefusalError('Claude declined to write this cover letter')
  }
}

export default { generateCoverLetter }
