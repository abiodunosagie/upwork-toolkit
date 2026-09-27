import { format } from 'date-fns'
import { ErrorType } from './errors'
import type { Schedule } from './globalState'

// Seconds without keyboard or mouse input before Chrome reports the Mac as
// idle. Long enough that reading a job post does not pause alerts.
export const IDLE_DETECTION_SECONDS = 5 * 60

/**
 * How long job checks stop after a failed cycle. Any sign that Upwork is
 * pushing back (forbidden, rate limit, a captcha page, a logged-out session,
 * a server error) stops all requests for a while instead of retrying every
 * minute. A plain network error only means the Mac is offline, so the next
 * cycle may try again.
 */
export const PAUSE_AFTER_ERROR_MS = 30 * 60 * 1000

export const pauseMsFor = (errorType: ErrorType): number =>
  errorType === ErrorType.NETWORK_ERROR ? 0 : PAUSE_AFTER_ERROR_MS

export const isPaused = (pausedUntil: number | null, now: number) =>
  pausedUntil !== null && pausedUntil > now

/**
 * True when there is no schedule, or when `now` falls inside one of the
 * owner's working-hours windows.
 */
export const isWithinSchedule = (
  schedulingEnabled: boolean,
  schedules: Schedule[],
  now: Date
) => {
  if (!schedulingEnabled || schedules.length === 0) return true

  const day = now.getDay()
  const time = format(now, 'HH:mm:ss')

  return schedules.some(
    (schedule) =>
      schedule.days.includes(day) &&
      format(new Date(schedule.from), 'HH:mm:00') <= time &&
      format(new Date(schedule.to), 'HH:mm:59') >= time
  )
}
