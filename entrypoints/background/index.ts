import { browser, defineBackground } from '#imports'
import claudeApi, { ClaudeRefusalError } from '@/api/claude'
import extension, { Cycles } from '@/utils/extension'
import stateStorage, { GlobalState } from '@/utils/globalState'
import claudeApiKeyStorage from '@/utils/claudeApiKey'
import mobileNotificationsStorage from '@/utils/mobileNotifications'
import runtime, { GenerateCoverLetterResponse } from '@/utils/runtime'
import { captureException } from '@/utils/sentry'
import { IDLE_DETECTION_SECONDS } from '@/utils/pacing'
import fetchJobs from './fetchJobs'

const ENABLED_SCRIPTS: {
  cycleName: Cycles
  delayInMinutes: number
  periodInMinutes: number
}[] = [
  {
    cycleName: extension.Cycles.FETCH_JOBS,
    delayInMinutes: extension.debugEnabled ? 5 / 60 : 0, // 5 seconds in dev
    // Once a minute, the pace of the original store extension. Faster polling
    // is what put the owner's account at risk on 2026-09-25.
    periodInMinutes: 1,
  },
]

// Cycles that older builds created and this build no longer runs. Alarms
// survive extension updates, so they are cleared explicitly.
const RETIRED_CYCLES = ['DAILY_REPORT']

const disableFetching = () => browser.alarms.clear(extension.Cycles.FETCH_JOBS)

const enableScripts = async () => {
  await Promise.all(RETIRED_CYCLES.map((name) => browser.alarms.clear(name)))
  const alarms = await browser.alarms.getAll()

  await Promise.all(
    ENABLED_SCRIPTS.map(async (script) => {
      const existing = alarms.find((alarm) => alarm.name === script.cycleName)

      // Alarms survive extension updates, so an alarm created with an older
      // period must be replaced for a new period to take effect.
      if (existing && existing.periodInMinutes !== script.periodInMinutes) {
        await browser.alarms.clear(script.cycleName)
      }

      if (!existing || existing.periodInMinutes !== script.periodInMinutes) {
        await browser.alarms.create(script.cycleName, {
          delayInMinutes: script.delayInMinutes,
          periodInMinutes: script.periodInMinutes,
        })
      }
    })
  )
}

export default defineBackground({
  type: 'module',
  main() {
    browser.idle.setDetectionInterval(IDLE_DETECTION_SECONDS)

    browser.action.onClicked.addListener(async () => {
      try {
        await browser.tabs.create({ url: 'options.html' })
      } catch (error) {
        captureException(error)
      }
    })

    browser.notifications.onClicked.addListener(async () => {
      try {
        if (await browser.windows.getCurrent()) {
          await browser.tabs.create({
            active: true,
            url: 'options.html',
          })
        } else {
          await browser.windows.create({
            focused: true,
            url: 'options.html',
          })
        }
      } catch {
        await browser.windows.create({
          focused: true,
          url: 'options.html',
        })
      }
    })

    browser.alarms.onAlarm.addListener(async (alarm) => {
      try {
        switch (alarm.name) {
          case extension.Cycles.FETCH_JOBS:
            return await fetchJobs()
        }
      } catch (error) {
        captureException(error)
      }
    })

    browser.runtime.onInstalled.addListener(async (details) => {
      try {
        if (
          details.reason === chrome.runtime.OnInstalledReason.INSTALL ||
          details.reason === chrome.runtime.OnInstalledReason.UPDATE
        ) {
          await enableScripts()
          await claudeApiKeyStorage.removeLegacyOpenAiKey()
          await mobileNotificationsStorage.migrateFromSync()
        }

        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
          // Erase outdated storage keys on update
          await stateStorage.save((previousState) =>
            Object.entries(stateStorage.getDefaultState()).reduce(
              (acc, [key, defaultValue]) => ({
                ...acc,
                [key]: previousState[key as keyof GlobalState] ?? defaultValue,
              }),
              { ...stateStorage.getDefaultState(), lastCycleError: null }
            )
          )
        }
      } catch (error) {
        captureException(error)
      }
    })

    // Only check Upwork while the owner is at the Mac: an away, locked or
    // sleeping Mac stops all requests until he is back.
    browser.idle.onStateChanged.addListener(async (state) => {
      try {
        if (state === 'active') {
          await enableScripts()
        } else {
          await disableFetching()
        }
      } catch (error) {
        captureException(error)
      }
    })

    browser.runtime.onStartup.addListener(async () => {
      try {
        await enableScripts()
      } catch (error) {
        captureException(error)
      }
    })

    browser.runtime.onMessage.addListener((message) => {
      if (runtime.isOpenPageMessage(message)) {
        const process = async () => {
          const currentWindow = await browser.windows.getLastFocused()

          try {
            await browser.tabs.create({
              url: message.url,
              active: true,
              windowId: currentWindow?.id,
            })
          } catch (error) {
            captureException(error)
          }
        }

        process()
      }
    })

    browser.runtime.onConnect.addListener((port) => {
      if (port.name !== runtime.Message.GENERATE_COVER_LETTER) {
        return
      }

      let connected = true
      const abortController = new AbortController()

      port.onDisconnect.addListener(() => {
        connected = false
        abortController.abort()
      })

      const post = (response: GenerateCoverLetterResponse) => {
        if (connected) {
          port.postMessage(response)
        }
      }

      port.onMessage.addListener(async (message) => {
        if (!runtime.isGenerateCoverLetterMessage(message)) {
          return
        }

        try {
          const apiKey = await claudeApiKeyStorage.get()

          if (!apiKey) {
            post({ type: 'error', error: 'NO_API_KEY' })
            return
          }

          await claudeApi.generateCoverLetter({
            apiKey,
            prompt: message.prompt,
            signal: abortController.signal,
            onChunk: (content) => post({ type: 'chunk', content }),
          })

          post({ type: 'done' })
        } catch (error) {
          // The user cancelled by closing the dialog, not an error worth reporting.
          if (abortController.signal.aborted) {
            return
          }

          // A refusal is expected model behaviour; only real failures go to Sentry.
          if (!(error instanceof ClaudeRefusalError)) {
            captureException(error)
          }
          post({ type: 'error', error: 'GENERATION_FAILED' })
        }
      })
    })
  },
})
