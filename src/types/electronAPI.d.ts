import type { Job } from './index.js'

export {}

declare global {
  interface Window {
    electronAPI?: {
      // Dialogs / file ops
      openFileDialog: (type?: 'video' | 'image' | 'audio', multiSelect?: boolean) => Promise<string | string[] | null>
      openFile: (filePath: string) => Promise<void>
      fileExists: (filePath: string) => Promise<boolean>
      getAppPath: () => Promise<string>
      isStoreBuild: () => Promise<{ isStoreBuild: boolean }>
      getPlatformInfo: () => Promise<{ platform: string; isDev: boolean; isMas: boolean }>
      getImageDataUrl: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>

      // Video / Audio
      getVideoDuration: (videoPath: string) => Promise<number>
      getAudioDuration: (audioPath: string) => Promise<number>
      processVideo: (data: { inputPath: string; iterations: number }) => Promise<string>
      createFromImage: (data: {
        imagePath: string
        audioPath: string | string[]
        enablePadding?: boolean
        paddingDuration?: number
        enableFadeOut?: boolean
        fadeOutDuration?: number
      }) => Promise<string>
      concatVideos: (data: {
        videoPaths: string[]
        enablePadding?: boolean
        paddingDuration?: number
        enableFadeOut?: boolean
        fadeOutDuration?: number
        enableFadeIn?: boolean
        useIntroOutro?: boolean
      }) => Promise<string>

      // Progress / cancel
      onProgress: (callback: (p: number) => void) => () => void
      cancelCurrentJob: () => Promise<void>

      // Settings
      getLanguage: () => Promise<{ language: string }>
      setLanguage: (data: { language: string }) => Promise<void>
      getOnboardingCompleted: () => Promise<{ hasCompletedOnboarding: boolean }>
      setOnboardingCompleted: (data: { completed: boolean }) => Promise<{ success: boolean }>
      getFileExtensions: () => Promise<{ image: string[]; video: string[]; audio: string[] }>
      setFileExtensions: (data: { image: string[]; video: string[]; audio: string[] }) => Promise<{ success: boolean }>
      getAudioQuality: () => Promise<{ quality: string }>
      setAudioQuality: (data: { quality: string }) => Promise<{ success: boolean }>
      getFastMode: () => Promise<{ fastMode: boolean }>
      setFastMode: (data: { fastMode: boolean }) => Promise<{ success: boolean }>

      // UI prefs (NEW)
      getUIPreferences: () => Promise<{
        imageMusic: {
          advancedOpen: boolean
          enableFadeOut: boolean
          fadeOutDuration: number
          enablePadding: boolean
          paddingDuration: number
        }
        concat: {
          advancedOpen: boolean
          enableFadeOut: boolean
          fadeOutDuration: number
          enablePadding: boolean
          paddingDuration: number
          enableFadeIn: boolean
        }
        loop: {
          advancedOpen: boolean
        }
      }>
      setUIPreferences: (data: {
        imageMusic: {
          advancedOpen: boolean
          enableFadeOut: boolean
          fadeOutDuration: number
          enablePadding: boolean
          paddingDuration: number
        }
        concat: {
          advancedOpen: boolean
          enableFadeOut: boolean
          fadeOutDuration: number
          enablePadding: boolean
          paddingDuration: number
          enableFadeIn: boolean
        }
        loop: {
          advancedOpen: boolean
        }
      }) => Promise<{ success: boolean }>

      // Queue persistence
      saveQueue: (data: { queue: Job[] }) => Promise<{ success: boolean }>
      getQueue: () => Promise<{ queue: Job[] }>
      clearQueue: (data: { clearCompleted?: boolean }) => Promise<{ success: boolean }>
      clearAllData: () => Promise<{ success: boolean }>

      // Notifications
      showNotification: (data: { title: string; body: string }) => Promise<void>

      // External links / logs
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
      openLogFolder: () => Promise<{ success: boolean; logPath?: string; error?: string }>

      // Auto updater
      onUpdateAvailable: (cb: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => () => void
      onUpdateNotAvailable: (cb: (info: { version: string }) => void) => () => void
      onUpdateDownloaded: (cb: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => () => void
      onDownloadProgress: (cb: (progress: { percent: number; transferred: number; total: number }) => void) => () => void
      onUpdaterError: (cb: (error: { message: string; stack?: string }) => void) => () => void
      checkForUpdates: () => Promise<{ success: boolean; reason?: string; error?: string }>
      downloadUpdate: () => Promise<{ success: boolean; reason?: string; error?: string }>
      quitAndInstall: () => Promise<{ success: boolean; reason?: string; error?: string }>

      // Error events
      onAppError: (cb: (error: { type: string; message: string; stack?: string; errorId: string }) => void) => () => void

      // Renderer logging
      log: {
        info: (...args: unknown[]) => Promise<void>
        error: (...args: unknown[]) => Promise<void>
        warn: (...args: unknown[]) => Promise<void>
        debug: (...args: unknown[]) => Promise<void>
      }
    }
  }
}


