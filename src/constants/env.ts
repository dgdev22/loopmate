/**
 * Environment and Platform Detection Constants
 * 
 * Centralized configuration for determining when to hide donation/sponsor UI
 * to comply with various store policies and platform requirements.
 */

import { isStoreBuild, isStoreBuildSync } from '../lib/storeDetection'

/**
 * Platform information from Electron main process
 * This will be populated via IPC
 */
let platformInfo: {
  platform: string
  isDev: boolean
  isMas: boolean
} | null = null

/**
 * Initialize platform info from Electron main process
 * Call this once when the app starts
 */
export async function initPlatformInfo(): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.getPlatformInfo) {
    try {
      const result = await window.electronAPI.getPlatformInfo()
      platformInfo = {
        platform: result.platform,
        isDev: result.isDev,
        isMas: result.isMas,
      }
    } catch (error) {
      console.error('Failed to get platform info:', error)
      // Fallback to default values
      platformInfo = {
        platform: 'unknown',
        isDev: import.meta.env.DEV || false,
        isMas: false,
      }
    }
  } else {
    // Fallback when Electron API is not available (e.g., in tests)
    platformInfo = {
      platform: 'unknown',
      isDev: import.meta.env.DEV || false,
      isMas: false,
    }
  }
}

/**
 * Get current platform info (synchronous)
 * Returns cached value or fallback
 */
export function getPlatformInfo(): {
  platform: string
  isDev: boolean
  isMas: boolean
} {
  if (platformInfo) {
    return platformInfo
  }
  
  // Fallback
  return {
    platform: 'unknown',
    isDev: import.meta.env.DEV || false,
    isMas: false,
  }
}

/**
 * Check if donation/sponsor UI should be hidden
 * 
 * Returns true if any of the following conditions are met:
 * - Microsoft Store build (process.windowsStore === true)
 * - macOS platform (process.platform === 'darwin')
 * - Development mode (process.env.NODE_ENV === 'development' or isDev === true)
 * - Mac App Store build (process.mas === true)
 * 
 * @returns Promise<boolean> - true if donation UI should be hidden
 */
export async function shouldHideDonation(): Promise<boolean> {
  // Initialize platform info if not already done
  if (!platformInfo) {
    await initPlatformInfo()
  }

  const info = getPlatformInfo()

  // Check Microsoft Store build
  const isStore = await isStoreBuild()
  if (isStore) {
    return true
  }

  // Check macOS platform
  if (info.platform === 'darwin') {
    return true
  }

  // Check development mode
  if (info.isDev || import.meta.env.DEV) {
    return true
  }

  // Check Mac App Store build
  if (info.isMas) {
    return true
  }

  return false
}

/**
 * Synchronous version of shouldHideDonation
 * Uses cached values and environment variables only
 * 
 * @returns boolean - true if donation UI should be hidden
 */
export function shouldHideDonationSync(): boolean {
  // Check Microsoft Store build (sync)
  if (isStoreBuildSync()) {
    return true
  }

  const info = getPlatformInfo()

  // Check macOS platform
  if (info.platform === 'darwin') {
    return true
  }

  // Check development mode
  if (info.isDev || import.meta.env.DEV) {
    return true
  }

  // Check Mac App Store build
  if (info.isMas) {
    return true
  }

  return false
}

/**
 * Export as constant for direct use (will be updated after initPlatformInfo is called)
 * Use shouldHideDonation() or shouldHideDonationSync() for accurate results
 */
export const SHOULD_HIDE_DONATION = shouldHideDonationSync()
