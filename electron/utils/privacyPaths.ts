import os from 'node:os'
import path from 'node:path'

type Jsonish = null | boolean | number | string | Jsonish[] | { [k: string]: Jsonish }

/**
 * Replace the user's home directory prefix with "~" so electron-store doesn't
 * persist the OS account name in plain text. (Restore it on read.)
 *
 * Stored format always uses POSIX separators after "~/" for stability.
 */
export function collapseHomeInString(value: string): string {
  const home = os.homedir()
  if (!home) return value

  const normalizedHome = path.normalize(home)
  const normalizedValue = path.normalize(value)

  const isWin = process.platform === 'win32'
  const startsWithHome = isWin
    ? normalizedValue.toLowerCase().startsWith(normalizedHome.toLowerCase())
    : normalizedValue.startsWith(normalizedHome)

  if (!startsWithHome) return value

  if (normalizedValue.length === normalizedHome.length) return '~'

  const remainder = normalizedValue.slice(normalizedHome.length)
  // remainder starts with path.sep in normal cases
  const remainderPosix = remainder.split(path.sep).join('/')
  return `~${remainderPosix}`
}

export function expandHomeInString(value: string): string {
  if (!value.startsWith('~')) return value

  const home = os.homedir()
  if (!home) return value

  if (value === '~') return home

  const remainder = value.startsWith('~/') ? value.slice(2) : value.slice(1)
  const remainderNative = remainder.split('/').join(path.sep)
  return path.normalize(path.join(home, remainderNative))
}

export function collapseHomeInJson<T extends Jsonish>(data: T): T {
  return deepMapStrings(data, collapseHomeInString) as T
}

export function expandHomeInJson<T extends Jsonish>(data: T): T {
  return deepMapStrings(data, expandHomeInString) as T
}

function deepMapStrings(data: Jsonish, map: (s: string) => string): Jsonish {
  if (data === null) return data
  if (typeof data === 'string') return map(data)
  if (typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map((v) => deepMapStrings(v, map))

  const out: Record<string, Jsonish> = {}
  for (const [k, v] of Object.entries(data)) {
    out[k] = deepMapStrings(v, map)
  }
  return out
}



