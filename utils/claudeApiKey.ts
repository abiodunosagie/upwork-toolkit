import { storage } from '#imports'

// Kept in local storage (this browser only), not sync storage, so the key is
// never copied to other devices through the browser account.
const namespace = 'local:__CLAUDE_API_KEY'

const get = () => storage.getItem<string>(namespace, { fallback: '' })

const save = async (value: string) => {
  await storage.setItem<string>(namespace, value)
  return value
}

const addEventListener = (
  callback: (newValue: string | null, oldValue: string | null) => void
) => storage.watch<string>(namespace, callback)

// Upstream kept an OpenAI key in sync storage. It is unused now; delete it so
// it stops replicating to the user's other devices.
const removeLegacyOpenAiKey = () => storage.removeItem('sync:__OPENAI_API_KEY')

export default { get, save, addEventListener, removeLegacyOpenAiKey }
