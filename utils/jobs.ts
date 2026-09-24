import { storage } from '#imports'
import { Job } from '@/api/upwork'
import isFunction from 'lodash/isFunction'

const namespace = 'local:__JOBS'
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
