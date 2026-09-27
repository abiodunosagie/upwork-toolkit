import { Job } from '@/api/upwork'
import jobStorage from '@/utils/jobs'
import { GlobalState } from '@/utils/globalState'
import globalState from '@/utils/globalState'
import { ReactNode, useEffect, useState } from 'react'
import Storage, { StorageInterface } from '@/contexts/storage'
type Props = {
  children: ReactNode | ReactNode[]
}

const StorageProvider = (props: Props) => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [initialized, setInitialized] = useState(false)
  const [state, setState] = useState<GlobalState>(globalState.getDefaultState)

  const exposedApi: StorageInterface = {
    jobs,
    initialized,
    globalState: state,
    setJobs: jobStorage.save,
    setState: globalState.save,
  }

  useEffect(() => {
    const initializeStorage = async () => {
      const [freshState, freshJobs] = await Promise.all([
        globalState.get(),
        jobStorage.getAll(),
      ])

      setJobs(freshJobs ?? [])
      setState(freshState)

      jobStorage.addEventListener((newJobs) => setJobs(newJobs ?? []))
      globalState.addEventListener((newState) =>
        setState(newState ?? globalState.getDefaultState())
      )

      setInitialized(true)
    }

    initializeStorage()
  }, [])

  return initialized ? (
    <Storage.Provider value={exposedApi}>{props.children}</Storage.Provider>
  ) : null
}

export default StorageProvider
