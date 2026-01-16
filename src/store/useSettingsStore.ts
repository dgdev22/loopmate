import { create } from 'zustand'

/**
 * Settings Store for managing user preferences
 * Uses Zustand for state management with electron-store persistence via IPC
 */

// Note: window.electronAPI is typed globally in src/types/electronAPI.d.ts

export interface FileExtensions {
  image: string[]
  video: string[]
  audio: string[]
}

export type AudioQualityPreset = 'low' | 'medium' | 'high' | 'studio'

export interface AudioQualityConfig {
  preset: AudioQualityPreset
  codec: string
  bitrate: string
  sampleRate: string
}

export const AUDIO_QUALITY_PRESETS: Record<AudioQualityPreset, AudioQualityConfig> = {
  low: {
    preset: 'low',
    codec: 'aac',
    bitrate: '128k',
    sampleRate: '44100'
  },
  medium: {
    preset: 'medium',
    codec: 'aac',
    bitrate: '192k',
    sampleRate: '44100'
  },
  high: {
    preset: 'high',
    codec: 'aac',
    bitrate: '256k',
    sampleRate: '48000'
  },
  studio: {
    preset: 'studio',
    codec: 'aac',
    bitrate: '320k',
    sampleRate: '48000'
  }
}

// Default settings constants
const DEFAULT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']
const DEFAULT_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv']
const DEFAULT_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus', '.aiff', '.aif', '.alac']
const DEFAULT_AUDIO_QUALITY: AudioQualityPreset = 'high'

const DEFAULT_FILE_EXTENSIONS: FileExtensions = {
  image: DEFAULT_IMAGE_EXTENSIONS,
  video: DEFAULT_VIDEO_EXTENSIONS,
  audio: DEFAULT_AUDIO_EXTENSIONS
}

export interface SettingsState {
  // State
  fileExtensions: FileExtensions
  audioQuality: AudioQualityPreset
  fastMode: boolean
  error: string | null
  isLoading: boolean

  // Actions
  loadSettings: () => Promise<void>
  loadFileExtensions: () => Promise<void>
  saveFileExtensions: (extensions: FileExtensions) => Promise<void>
  loadAudioQuality: () => Promise<void>
  saveAudioQuality: (quality: AudioQualityPreset) => Promise<void>
  loadFastMode: () => Promise<void>
  saveFastMode: (fastMode: boolean) => Promise<void>

  // Helpers
  getAudioQualityConfig: () => AudioQualityConfig
  resetToDefaults: () => Promise<void>
  clearError: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initial state
  fileExtensions: DEFAULT_FILE_EXTENSIONS,
  audioQuality: DEFAULT_AUDIO_QUALITY,
  fastMode: true, // Default to Fast Mode for best performance
  error: null,
  isLoading: false,

  /**
   * Load all settings from electron-store
   */
  loadSettings: async (): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([
        get().loadFileExtensions(),
        get().loadAudioQuality(),
        get().loadFastMode()
      ])
      set({ isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load settings'
      set({ error: errorMessage, isLoading: false })
      console.error('Failed to load settings:', error)
    }
  },

  /**
   * Load file extensions from electron-store
   */
  loadFileExtensions: async (): Promise<void> => {
    try {
      if (window.electronAPI?.getFileExtensions) {
        const extensions = await window.electronAPI.getFileExtensions()
        set({ fileExtensions: extensions })
      } else {
        console.warn('Electron API not available, using default file extensions')
      }
    } catch (error) {
      console.error('Failed to load file extensions:', error)
      // Fallback to defaults on error
      set({ fileExtensions: DEFAULT_FILE_EXTENSIONS })
      throw error
    }
  },

  /**
   * Save file extensions to electron-store
   */
  saveFileExtensions: async (extensions: FileExtensions): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      if (window.electronAPI?.setFileExtensions) {
        await window.electronAPI.setFileExtensions(extensions)
        set({ fileExtensions: extensions, isLoading: false })
      } else {
        throw new Error('Electron API not available')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save file extensions'
      set({ error: errorMessage, isLoading: false })
      console.error('Failed to save file extensions:', error)
      throw error
    }
  },

  /**
   * Load audio quality from electron-store
   */
  loadAudioQuality: async (): Promise<void> => {
    try {
      if (window.electronAPI?.getAudioQuality) {
        const result = await window.electronAPI.getAudioQuality()
        set({ audioQuality: result.quality })
      } else {
        console.warn('Electron API not available, using default audio quality')
      }
    } catch (error) {
      console.error('Failed to load audio quality:', error)
      // Fallback to default on error
      set({ audioQuality: DEFAULT_AUDIO_QUALITY })
      throw error
    }
  },

  /**
   * Save audio quality to electron-store
   */
  saveAudioQuality: async (quality: AudioQualityPreset): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      if (window.electronAPI?.setAudioQuality) {
        await window.electronAPI.setAudioQuality({ quality })
        set({ audioQuality: quality, isLoading: false })
      } else {
        throw new Error('Electron API not available')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save audio quality'
      set({ error: errorMessage, isLoading: false })
      console.error('Failed to save audio quality:', error)
      throw error
    }
  },

  /**
   * Load fast mode setting from electron-store
   */
  loadFastMode: async (): Promise<void> => {
    try {
      if (window.electronAPI?.getFastMode) {
        const result = await window.electronAPI.getFastMode()
        set({ fastMode: result.fastMode })
      } else {
        console.warn('Electron API not available, using default fast mode')
      }
    } catch (error) {
      console.error('Failed to load fast mode:', error)
      // Fallback to default on error
      set({ fastMode: true })
      throw error
    }
  },

  /**
   * Save fast mode setting to electron-store
   */
  saveFastMode: async (fastMode: boolean): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      if (window.electronAPI?.setFastMode) {
        await window.electronAPI.setFastMode({ fastMode })
        set({ fastMode, isLoading: false })
      } else {
        throw new Error('Electron API not available')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save fast mode'
      set({ error: errorMessage, isLoading: false })
      console.error('Failed to save fast mode:', error)
      throw error
    }
  },

  /**
   * Get the current audio quality configuration
   */
  getAudioQualityConfig: (): AudioQualityConfig => {
    return AUDIO_QUALITY_PRESETS[get().audioQuality]
  },

  /**
   * Reset all settings to default values
   */
  resetToDefaults: async (): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([
        get().saveFileExtensions(DEFAULT_FILE_EXTENSIONS),
        get().saveAudioQuality(DEFAULT_AUDIO_QUALITY),
        get().saveFastMode(true)
      ])
      set({ isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset settings'
      set({ error: errorMessage, isLoading: false })
      console.error('Failed to reset settings:', error)
      throw error
    }
  },

  /**
   * Clear error state
   */
  clearError: (): void => {
    set({ error: null })
  }
}))

// Selector hooks for optimized re-renders
export const useFileExtensions = () => useSettingsStore(state => state.fileExtensions)
export const useAudioQuality = () => useSettingsStore(state => state.audioQuality)
export const useAudioQualityConfig = () => useSettingsStore(state => state.getAudioQualityConfig())
export const useFastMode = () => useSettingsStore(state => state.fastMode)
export const useSettingsError = () => useSettingsStore(state => state.error)
export const useSettingsLoading = () => useSettingsStore(state => state.isLoading)