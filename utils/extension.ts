import packageJson from '@/package.json'

const debugEnabled = import.meta.env.MODE === 'development'
const version = packageJson.version

export enum Cycles {
  FETCH_JOBS = 'FETCH_JOBS',
}

export default {
  Cycles,
  debugEnabled,
  version,
}
