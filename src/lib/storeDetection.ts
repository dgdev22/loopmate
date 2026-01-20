/**
 * Store Build Detection Utility
 * 
 * Detects if the app is running in Microsoft Store build.
 * This is used to hide donation/sponsor links to comply with Microsoft Store policies.
 */

let cachedStoreBuildStatus: boolean | null = null

/**
 * Checks if the app is running in Microsoft Store build
 * @returns Promise<boolean> - true if running in Microsoft Store, false otherwise
 */
export async function isStoreBuild(): Promise<boolean> {
  // Return cached value if available
  if (cachedStoreBuildStatus !== null) {
    return cachedStoreBuildStatus
  }

  // Check Vite environment variable (set during build)
  if (import.meta.env.VITE_IS_STORE_BUILD === 'true') {
    cachedStoreBuildStatus = true
    return true
  }

  // Check via Electron IPC (runtime check)
  if (typeof window !== 'undefined' && window.electronAPI?.isStoreBuild) {
    try {
      const result = await window.electronAPI.isStoreBuild()
      cachedStoreBuildStatus = result.isStoreBuild
      return result.isStoreBuild
    } catch (error) {
      console.error('Failed to check store build status:', error)
      cachedStoreBuildStatus = false
      return false
    }
  }

  cachedStoreBuildStatus = false
  return false
}

/**
 * Synchronous version - uses cached value or environment variable only
 * Use this for initial render checks, but prefer async version for accuracy
 */
export function isStoreBuildSync(): boolean {
  // Check Vite environment variable (set during build)
  if (import.meta.env.VITE_IS_STORE_BUILD === 'true') {
    return true
  }

  // Return cached value if available
  if (cachedStoreBuildStatus !== null) {
    return cachedStoreBuildStatus
  }

  return false
}
