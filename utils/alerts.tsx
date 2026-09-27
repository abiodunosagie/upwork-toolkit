import { ReactNode } from 'react'
import { AlertProps, AlertTitleProps } from '@mui/material'

type RenderProps = {
  onInteracted?: () => void
}

export type Alert = {
  id: string
  title: ReactNode
  titleProps?: AlertTitleProps
  variant?: AlertProps['variant']
  severity: AlertProps['severity']
  renderBody: (props: RenderProps) => ReactNode
}

const all: Alert[] = []

export default all
