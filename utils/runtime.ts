export enum Message {
  OPEN_PAGE = 'OPEN_PAGE',
  PLAY_SOUND = 'PLAY_SOUND',
}

export type PlaySoundMessage = {
  volume: number
  type: Message.PLAY_SOUND
}

export type OpenPageMessage = {
  url: string
  type: Message.OPEN_PAGE
}

const isPlaySoundMessage = (message: any): message is PlaySoundMessage =>
  message && !isNaN(message.volume) && message.type === Message.PLAY_SOUND

const isOpenPageMessage = (message: any): message is OpenPageMessage =>
  message && message.type === Message.OPEN_PAGE

export default {
  isPlaySoundMessage,
  isOpenPageMessage,
  Message,
}
