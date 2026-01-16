import { ipcRenderer, contextBridge, IpcRendererEvent } from 'electron'

/**
 * SECURITY: Never expose ipcRenderer directly to the renderer process.
 * This creates a security vulnerability as it allows arbitrary IPC channel access.
 * 
 * Instead, we use contextBridge to expose only specific, validated APIs.
 * All IPC communication must go through the electronAPI object with predefined methods.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (...args) => ipcRenderer.invoke('dialog:open-file', ...args),
  getVideoDuration: (videoPath) => ipcRenderer.invoke('video:get-duration', videoPath),
  processVideo: (data) => ipcRenderer.invoke('video:process', data),
  createFromImage: (data) => ipcRenderer.invoke('video:create-from-image', data),
  concatVideos: (data) => ipcRenderer.invoke('video:concat', data),
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  getAppPath: () => ipcRenderer.invoke('app:get-path'),
  getImageDataUrl: (filePath: string) => ipcRenderer.invoke('file:get-image-data-url', filePath),
  getAudioDuration: (audioPath: string) => ipcRenderer.invoke('audio:get-duration', audioPath),
  onProgress: (callback) => {
    const handler = (_event: IpcRendererEvent, value: number) => callback(value)
    ipcRenderer.on('video:progress', handler)
    return () => ipcRenderer.removeListener('video:progress', handler)
  },
  showNotification: (data) => ipcRenderer.invoke('notification:show', data),
  cancelCurrentJob: () => ipcRenderer.invoke('job:cancel'),
  // Settings
  getLanguage: () => ipcRenderer.invoke('settings:get-language'),
  setLanguage: (data) => ipcRenderer.invoke('settings:set-language', data),
  clearAllData: () => ipcRenderer.invoke('settings:clear-all-data'),
  getTosAccepted: () => ipcRenderer.invoke('settings:get-tos-accepted'),
  setTosAccepted: (data) => ipcRenderer.invoke('settings:set-tos-accepted', data),
  getOnboardingCompleted: () => ipcRenderer.invoke('settings:get-onboarding-completed'),
  setOnboardingCompleted: (data) => ipcRenderer.invoke('settings:set-onboarding-completed', data),
  getFileExtensions: () => ipcRenderer.invoke('settings:get-file-extensions'),
  setFileExtensions: (data) => ipcRenderer.invoke('settings:set-file-extensions', data),
  getAudioQuality: () => ipcRenderer.invoke('settings:get-audio-quality'),
  setAudioQuality: (data) => ipcRenderer.invoke('settings:set-audio-quality', data),
  getFastMode: () => ipcRenderer.invoke('settings:get-fast-mode'),
  setFastMode: (data) => ipcRenderer.invoke('settings:set-fast-mode', data),
  getUIPreferences: () => ipcRenderer.invoke('settings:get-ui-preferences'),
  setUIPreferences: (data) => ipcRenderer.invoke('settings:set-ui-preferences', data),
  saveQueue: (data) => ipcRenderer.invoke('store:save-queue', data),
  getQueue: () => ipcRenderer.invoke('store:get-queue'),
  clearQueue: (data) => ipcRenderer.invoke('store:clear-queue', data),
  // External links
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  // Auto Updater
  onUpdateAvailable: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, info: { version: string; releaseDate?: string; releaseNotes?: string }) => callback(info)
    ipcRenderer.on('updater:update-available', handler)
    return () => ipcRenderer.removeListener('updater:update-available', handler)
  },
  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => {
    const handler = (_event: IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('updater:update-not-available', handler)
    return () => ipcRenderer.removeListener('updater:update-not-available', handler)
  },
  onUpdateDownloaded: (callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, info: { version: string; releaseDate?: string; releaseNotes?: string }) => callback(info)
    ipcRenderer.on('updater:update-downloaded', handler)
    return () => ipcRenderer.removeListener('updater:update-downloaded', handler)
  },
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    const handler = (_event: IpcRendererEvent, progress: { percent: number; transferred: number; total: number }) => callback(progress)
    ipcRenderer.on('updater:download-progress', handler)
    return () => ipcRenderer.removeListener('updater:download-progress', handler)
  },
  onUpdaterError: (callback: (error: { message: string; stack?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, error: { message: string; stack?: string }) => callback(error)
    ipcRenderer.on('updater:error', handler)
    return () => ipcRenderer.removeListener('updater:error', handler)
  },
  checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  // Logs & Support
  openLogFolder: () => ipcRenderer.invoke('logs:open-folder'),
  getLogPath: () => ipcRenderer.invoke('logs:get-path'),
  // Error events
  onAppError: (callback: (error: { type: string; message: string; stack?: string; errorId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, error: { type: string; message: string; stack?: string; errorId: string }) => callback(error)
    ipcRenderer.on('app:error', handler)
    return () => ipcRenderer.removeListener('app:error', handler)
  },
  // Renderer process logging (writes to same log file as main process)
  log: {
    info: (...args: unknown[]) => ipcRenderer.invoke('logger:log', 'info', args),
    error: (...args: unknown[]) => ipcRenderer.invoke('logger:log', 'error', args),
    warn: (...args: unknown[]) => ipcRenderer.invoke('logger:log', 'warn', args),
    debug: (...args: unknown[]) => ipcRenderer.invoke('logger:log', 'debug', args)
  }
})