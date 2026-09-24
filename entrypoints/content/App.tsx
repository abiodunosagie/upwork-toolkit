import { Event, eventEmitter } from '@/utils/events'
import { useEffect, useState } from 'react'
import ClaudeDialog from './ClaudeDialog'
import jobDetailsReader, { PageJobDetails } from './jobDetails'

const App = (props: {
  eventEmitter: typeof eventEmitter
  onInsert: (template: string) => void
}) => {
  const [showClaudeDialog, setShowClaudeDialog] = useState(false)
  const [jobDetails, setJobDetails] = useState<PageJobDetails | null>(null)

  const openClaudeDialog = () => setShowClaudeDialog(true)

  const jobTitle = jobDetails?.title
  const jobDescription = jobDetails?.description

  useEffect(() => {
    const readJobDetails = async () => {
      const details = await jobDetailsReader.getJobDetailsFromPage()

      if (!details) {
        return
      }

      setJobDetails(details)
      props.eventEmitter.emit(Event.JOB_DETAILS_RECEIVED, details)
    }

    readJobDetails()
  }, [])

  useEffect(() => {
    props.eventEmitter.on(Event.GENERATE_COVER_LETTER_CLICK, openClaudeDialog)

    return () => {
      props.eventEmitter.off(
        Event.GENERATE_COVER_LETTER_CLICK,
        openClaudeDialog
      )
    }
  }, [])

  return showClaudeDialog && jobTitle && jobDescription ? (
    <ClaudeDialog
      onClose={() => setShowClaudeDialog(false)}
      onInsert={(template) => {
        props.onInsert(template)
        setShowClaudeDialog(false)
      }}
      jobTitle={jobTitle}
      jobDescription={jobDescription}
    />
  ) : null
}

export default App
