import { Job } from '@/api/upwork'
import { createContext } from 'react'
import jobStorage from '@/utils/jobs'
import globalState, { GlobalState } from '@/utils/globalState'

export type StorageInterface = {
  initialized: boolean
  jobs: Job[]
  globalState: GlobalState

  setJobs: typeof jobStorage.save
  setState: typeof globalState.save
}

const StorageContext = createContext<StorageInterface>({
  initialized: false,
  jobs: [],
  globalState: globalState.getDefaultState(),

  setJobs: Promise.resolve,
  setState: Promise.resolve,
})

export default StorageContext
