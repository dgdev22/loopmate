import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useSettingsStore } from '../store/useSettingsStore'

// Mock electron API
global.window = {
  ...global.window,
  electronAPI: {},
} as Window & { electronAPI: Record<string, never> }

describe('useSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset store state if needed
  })

  describe('Store Structure', () => {
    it('should have loadSettings method', () => {
      useSettingsStore.getState()
      const store = useSettingsStore.getState()
      expect(store).toHaveProperty('loadSettings')
      expect(typeof store.loadSettings).toBe('function')
    })

    it('should not have analyticsConsent property', () => {
      const store = useSettingsStore.getState()
      expect(store).not.toHaveProperty('analyticsConsent')
    })

    it('should not have hasSeenConsentModal property', () => {
      const store = useSettingsStore.getState()
      expect(store).not.toHaveProperty('hasSeenConsentModal')
    })

    it('should not have setAnalyticsConsent method', () => {
      const store = useSettingsStore.getState()
      expect(store).not.toHaveProperty('setAnalyticsConsent')
    })

    it('should not have markConsentModalAsSeen method', () => {
      const store = useSettingsStore.getState()
      expect(store).not.toHaveProperty('markConsentModalAsSeen')
    })
  })

  describe('loadSettings', () => {
    it('should be callable without errors', async () => {
      const store = useSettingsStore.getState()
      await expect(store.loadSettings()).resolves.not.toThrow()
    })
  })
})

