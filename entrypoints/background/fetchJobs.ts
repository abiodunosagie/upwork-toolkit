import { browser } from '#imports'
import mobileNotificationsApi from '@/api/mobileNotifications'
import upworkApi, { Job } from '@/api/upwork'
import colors from '@/utils/colors'
import { ErrorType } from '@/utils/errors'
import extension from '@/utils/extension'
import stateStorage from '@/utils/globalState'
import jobStorage, { isFreshJob } from '@/utils/jobs'
import logger from '@/utils/logger'
import notifications from '@/utils/notifications'
import {
  IDLE_DETECTION_SECONDS,
  isPaused,
  isWithinSchedule,
  pauseMsFor,
} from '@/utils/pacing'
import { captureEvent, captureException } from '@/utils/sentry'
import { v4 } from 'uuid'

const getErrorType = (error: any): ErrorType => {
  switch (true) {
    case upworkApi.isServerError(error):
      return ErrorType.SERVER_ERROR
    case upworkApi.isUnauthenticatedError(error):
      return ErrorType.UNAUTHENTICATED
    case upworkApi.isNetworkError(error):
      return ErrorType.NETWORK_ERROR
    case upworkApi.isForbiddenError(error):
    case upworkApi.isRateLimitError(error):
      return ErrorType.FORBIDDEN
    default:
      return ErrorType.OTHER
  }
}

const MIN_CYCLE_GAP_MS = 40 * 1000

// Blocks a second cycle from overlapping a slow one. It expires after
// CYCLE_LOCK_TTL_MS so a cycle that never settles (for example a hung
// notification sound) can never stop job fetching for good.
const CYCLE_LOCK_TTL_MS = 90 * 1000
let cycleStartedAtMs: number | null = null

const fetchJobs = async () => {
  if (
    cycleStartedAtMs !== null &&
    Date.now() - cycleStartedAtMs < CYCLE_LOCK_TTL_MS
  ) {
    await logger.info([
      extension.Cycles.FETCH_JOBS,
      'Previous cycle still in flight, exiting...',
    ])
    return
  }

  if (cycleStartedAtMs !== null) {
    await logger.warn([
      extension.Cycles.FETCH_JOBS,
      'Previous cycle never finished, taking over the lock',
    ])
  }

  const startedAt = Date.now()
  cycleStartedAtMs = startedAt
  try {
    await runCycle()
  } finally {
    // Only release our own lock, not one a later cycle took over.
    if (cycleStartedAtMs === startedAt) cycleStartedAtMs = null
  }
}

const runCycle = async () => {
  const cycleId = v4().split('-').shift() as string
  const globalState = await stateStorage.get()

  // This check makes sure that background script doesn't run twice.
  // E.g. after system waking up. Kept below the 1 min alarm period so a
  // slightly early alarm is not skipped.
  if (globalState.lastCycleStartedAt + MIN_CYCLE_GAP_MS > Date.now()) {
    await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Another cycle is already running, exiting...',
    ])
    return
  }

  await stateStorage.save({ lastCycleStartedAt: Date.now() })

  if (!globalState.enabled) {
    await Promise.all([
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        'Extension is disabled, exiting...',
      ]),
      browser.action.setBadgeText({ text: 'OFF' }),
      browser.action.setBadgeBackgroundColor({ color: colors.orange }),
    ])
    return
  }

  // Second guard behind the idle listener: alarms survive browser restarts,
  // so a cycle can fire while the owner is away.
  if ((await browser.idle.queryState(IDLE_DETECTION_SECONDS)) !== 'active') {
    await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Owner is away, not checking Upwork...',
    ])
    return
  }

  if (isPaused(globalState.pausedUntil, Date.now())) {
    await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Paused after an Upwork error, not checking...',
    ])
    return
  }

  // Outside working hours no request is made at all, not just no alert.
  if (
    !isWithinSchedule(
      globalState.schedulingEnabled,
      globalState.schedules,
      new Date()
    )
  ) {
    return await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Outside of working hours, not checking Upwork...',
    ])
  }

  const oldBatch = await jobStorage.getAll()
  let newBatch: Job[] = []

  try {
    // One feed per cycle: the owner's chosen feed (My Feed carries his saved
    // searches).
    newBatch = await upworkApi.getJobs(globalState.feedType)
  } catch (error: any) {
    const errorType = getErrorType(error)
    const pauseMs = pauseMsFor(errorType)

    if (
      errorType === ErrorType.UNAUTHENTICATED &&
      globalState.lastCycleError !== ErrorType.UNAUTHENTICATED
    ) {
      await notifications.show({
        type: 'basic',
        iconUrl: 'empty-icon.png',
        title: 'Your Upwork session has ended.',
        message: 'Please login to keep extension working.',
      })
    }

    await Promise.all([
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        `${errorType}, exiting...`,
      ]),

      stateStorage.save({
        lastCycleError: errorType,
        pausedUntil: pauseMs > 0 ? Date.now() + pauseMs : null,
      }),

      errorType === ErrorType.OTHER &&
        !upworkApi.shouldIgnoreError(error) &&
        captureException(error),

      browser.action.setBadgeText({ text: 'ERR' }),
      browser.action.setBadgeBackgroundColor({ color: colors.error }),
    ])
    return
  }

  if (oldBatch && !Array.isArray(oldBatch)) {
    captureEvent({ message: 'oldBatch is not an array', extra: { oldBatch } })
  }

  const oldBatchIds = (Array.isArray(oldBatch) ? oldBatch : []).map(
    (job) => job.ciphertext
  )
  const knownIds = new Set([...oldBatchIds, ...(await jobStorage.getSeenIds())])

  const now = Date.now()
  const newJobs = newBatch.filter(
    (job) => !knownIds.has(job.ciphertext) && isFreshJob(job, now)
  )

  // Keep only jobs still inside the freshness window, so the list and the
  // agent focus on jobs that can still be applied to early.
  const newProcessedBatch = [
    ...newJobs.map((job) => ({ ...job, __isSeen: false })),
    ...(Array.isArray(oldBatch) ? oldBatch : []).filter((job) =>
      isFreshJob(job, now)
    ),
  ].slice(0, 50)

  const unseenJobs = newProcessedBatch.filter((job) => !job.__isSeen)
  const unseenCount = unseenJobs.length

  const hasNewUnseenJobs =
    unseenJobs.length > 0 &&
    unseenJobs.some((job) => !oldBatchIds.includes(job.ciphertext))

  await Promise.all([
    jobStorage.saveLastCycle({
      at: now,
      scanned: newBatch.length,
      fresh: newBatch.filter((job) => isFreshJob(job, now)).length,
    }),
    jobStorage.save(newProcessedBatch),
    jobStorage.rememberSeenIds(newJobs.map((job) => job.ciphertext)),
    stateStorage.save({ lastCycleError: null, pausedUntil: null }),

    browser.action.setBadgeText({ text: String(unseenCount || '') }),
    browser.action.setBadgeBackgroundColor({ color: colors.warning }),

    !hasNewUnseenJobs &&
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        'No new jobs, exiting...',
      ]),
  ])

  if (!hasNewUnseenJobs) return

  const [{ created, clearedAll }] = await Promise.all([
    notifications.show(
      {
        type: 'basic',
        iconUrl: 'empty-icon.png', // Bug, should not be required
        title: `You have ${unseenCount} new job${unseenCount > 1 ? 's' : ''}`,
        message: 'Click to apply!',
      },
      globalState.soundSettings
    ),
    // Also relay this cycle's new jobs to the user's phone (Telegram / ntfy /
    // webhook), if configured. Fire-and-forget: failures are swallowed and
    // never affect the desktop path.
    mobileNotificationsApi.send({ count: newJobs.length, jobs: newJobs }),
    logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      `New counter: ${unseenCount}. Notifying...`,
    ]),
  ])

  await logger.info([
    extension.Cycles.FETCH_JOBS,
    cycleId,
    `created: ${created} / clearedAll: ${clearedAll ? 'true' : 'false'}`,
  ])
}

export default fetchJobs
