import { storage } from '#imports'
import { Job } from '@/api/upwork'
import isFunction from 'lodash/isFunction'

const namespace = 'local:__JOBS'

/**
 * When the job went public. Upwork can publish or renew a job long after
 * createdOn, so createdOn alone makes fresh jobs look days old.
 */
export const jobPostedTime = (job: Job): number =>
  new Date(job.publishedOn ?? job.renewedOn ?? job.createdOn).getTime() || 0

/** Jobs older than this are dropped: the point is to apply among the first. */
export const MAX_JOB_AGE_MS = 10 * 60 * 1000

export const isFreshJob = (job: Job, now: number = Date.now()): boolean =>
  now - jobPostedTime(job) <= MAX_JOB_AGE_MS
const getAll = () => storage.getItem<Job[] | null>(namespace)

const save = async (arg: Job[] | ((jobs: Job[]) => Job[])): Promise<Job[]> => {
  const updatedState = isFunction(arg) ? arg((await getAll()) ?? []) : arg
  await storage.setItem(namespace, updatedState)
  return updatedState
}

const addEventListener = (
  callback: (newJobs: Job[] | null, oldJobs: Job[] | null) => void
) => storage.watch<Job[]>(namespace, callback)

// Ids of every job already announced, kept apart from the 50-job display
// cache. The cache evicts by insertion order, so without this list a job
// pushed out by a busy feed would be announced again when it reappears.
const seenNamespace = 'local:__SEEN_JOB_IDS'
const SEEN_IDS_LIMIT = 500

const getSeenIds = async (): Promise<string[]> =>
  (await storage.getItem<string[]>(seenNamespace)) ?? []

const rememberSeenIds = async (newIds: string[]): Promise<void> => {
  if (newIds.length === 0) return
  const known = await getSeenIds()
  await storage.setItem(
    seenNamespace,
    [...newIds, ...known.filter((id) => !newIds.includes(id))].slice(
      0,
      SEEN_IDS_LIMIT
    )
  )
}

export default { addEventListener, getAll, save, getSeenIds, rememberSeenIds }
