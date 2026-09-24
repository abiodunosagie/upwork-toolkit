import { storage } from '#imports'
import isFunction from 'lodash/isFunction'
import merge from 'lodash/merge'

// Local storage (this browser only): the config holds the Telegram bot token
// and webhook URL, which must not be copied to other devices via sync.
const namespace = 'local:__MOBILE_NOTIFICATIONS'
const legacySyncNamespace = 'sync:__MOBILE_NOTIFICATIONS'

export const NTFY_DEFAULT_SERVER = 'https://ntfy.sh'

export type MobileProvider = 'telegram' | 'ntfy' | 'webhook'

/**
 * Mobile notification settings persisted in cloud storage.
 * Secrets (bot token, webhook URL) live here, in local storage only.
 */
export type MobileNotificationsConfig = {
  telegram: {
    enabled: boolean
    botToken: string
    chatId: string
  }
  ntfy: {
    enabled: boolean
    serverUrl: string
    topic: string
  }
  webhook: {
    enabled: boolean
    url: string
  }
}

export const getDefaultConfig = (): MobileNotificationsConfig => ({
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
  },
  ntfy: {
    enabled: false,
    serverUrl: NTFY_DEFAULT_SERVER,
    topic: '',
  },
  webhook: {
    enabled: false,
    url: '',
  },
})

const get = () =>
  storage.getItem<MobileNotificationsConfig>(namespace, {
    fallback: getDefaultConfig(),
  })

type ConfigUpdater = (
  previous: MobileNotificationsConfig
) => MobileNotificationsConfig

const save = async (
  arg: Partial<MobileNotificationsConfig> | ConfigUpdater
): Promise<MobileNotificationsConfig> => {
  const previous = await get()

  // Deep-merge so saving a single provider section doesn't wipe the others.
  const updated = isFunction(arg) ? arg(previous) : merge({}, previous, arg)

  await storage.setItem<MobileNotificationsConfig>(namespace, updated)
  return updated
}

const addEventListener = (
  callback: (
    newValue: MobileNotificationsConfig | null,
    oldValue: MobileNotificationsConfig | null
  ) => void
) => storage.watch<MobileNotificationsConfig>(namespace, callback)

/**
 * One-time move of a config saved by older versions in sync storage. Keeps an
 * existing local config if there is one, then deletes the synced copy so the
 * secrets stop replicating.
 */
const migrateFromSync = async (): Promise<void> => {
  const legacy = await storage.getItem<MobileNotificationsConfig>(
    legacySyncNamespace
  )
  if (!legacy) return

  const current = await storage.getItem<MobileNotificationsConfig>(namespace)
  if (!current) {
    await storage.setItem<MobileNotificationsConfig>(
      namespace,
      merge({}, getDefaultConfig(), legacy)
    )
  }
  await storage.removeItem(legacySyncNamespace)
}

export default {
  get,
  save,
  addEventListener,
  getDefaultConfig,
  migrateFromSync,
}
