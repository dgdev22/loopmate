import fs from 'node:fs'

export type SafeRmOptions = {
  recursive?: boolean
  maxRetries?: number
  retryDelayMs?: number
}

const DEFAULT_MAX_RETRIES = 6
const DEFAULT_RETRY_DELAY_MS = 150

/**
 * Windows frequently throws EBUSY/EPERM when antivirus/indexers still hold a handle.
 * Node's fs.rm{Sync} supports built-in retry options; we standardize on those.
 */
export function safeRmSync(targetPath: string, options: SafeRmOptions = {}): void {
  const { recursive = false, maxRetries = DEFAULT_MAX_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options
  try {
    fs.rmSync(targetPath, {
      force: true,
      recursive,
      maxRetries,
      retryDelay: retryDelayMs
    })
  } catch {
    // Best-effort cleanup. Ignore all errors (including ENOENT).
  }
}

export async function safeRm(targetPath: string, options: SafeRmOptions = {}): Promise<void> {
  const { recursive = false, maxRetries = DEFAULT_MAX_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options
  try {
    await fs.promises.rm(targetPath, {
      force: true,
      recursive,
      maxRetries,
      retryDelay: retryDelayMs
    })
  } catch {
    // Best-effort cleanup. Ignore all errors (including ENOENT).
  }
}



