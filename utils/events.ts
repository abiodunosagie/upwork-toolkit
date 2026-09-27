import mitt from 'mitt'

export enum Event {
  DEBUG_MODE_TRIGGERED = 'debug_mode_triggered',
  UNSEEN_IDS_UPDATED = 'unseen_ids_updated',
}

type Events = {
  [Event.DEBUG_MODE_TRIGGERED]: void
  [Event.UNSEEN_IDS_UPDATED]: string[]
}

export const eventEmitter = mitt<Events>()
