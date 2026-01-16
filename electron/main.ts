import { app, BrowserWindow, ipcMain, dialog, Notification, shell, protocol } from 'electron'
import { autoUpdater } from 'electron-updater'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import ffmpeg from 'fluent-ffmpeg'
import Store from 'electron-store'
import { initializeLogger, log, logFilePath, logFileDir } from './utils/logger.js'
import { safeRm, safeRmSync } from './utils/fsSafe.js'
import { collapseHomeInJson, expandHomeInJson } from './utils/privacyPaths.js'
import {
  validateVideoFilePath,
  validateAudioFilePath,
  validateImageFilePath,
  validateFilePaths,
  validateUrl,
  sanitizeErrorMessage,
  validateNumericInput
} from './utils/security.js'
import { AppError, ErrorCode, serializeErrorForIPC } from './utils/errorCodes.js'
import { initializeFfmpeg } from './utils/ffmpeg/config.js'
import {
  validateAudioFile,
  cleanupTempFiles,
  getSafeOutputPath,
  concatenateAudios,
  extractFirstFrameAsThumbnail
} from './utils/ffmpeg/index.js'
import type { FfmpegMetadata } from './utils/ffmpeg/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined
const isPackaged = app.isPackaged

// 3. Initialize Logger (with console override and global error handlers)
let win: BrowserWindow | null = null

// Track last progress value to prevent progress from going backwards (monotonic increase)
let lastProgressValue = 0

function createJobTempDir(): string {
  const baseDir = path.join(app.getPath('temp'), 'loopmate')
  try {
    fs.mkdirSync(baseDir, { recursive: true })
  } catch {
    // Ignore
  }
  return fs.mkdtempSync(path.join(baseDir, 'job-'))
}

/**
 * Send progress to renderer with monotonic increase guarantee
 * Progress will never go backwards (prevents UI flicker)
 */
function sendProgress(value: number) {
  if (!win || win.isDestroyed()) return
  
  // Ensure progress never goes backwards
  const monotonicProgress = Math.max(lastProgressValue, Math.min(value, 100))
  
  // Only send if progress actually increased (avoid redundant updates)
  if (monotonicProgress > lastProgressValue || monotonicProgress === 100) {
    lastProgressValue = monotonicProgress
    win.webContents.send('video:progress', monotonicProgress)
  }
}

/**
 * Reset progress tracker (call at start of new job)
 */
function resetProgress() {
  lastProgressValue = 0
}

initializeLogger((error) => {
  // Send error to renderer if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:error', error)
  }
})

autoUpdater.logger = log
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

if (isDev) {
  log.info('Auto updater disabled in development mode')
}

const enableDevTools = process.env.ENABLE_DEVTOOLS === 'true' || 
                        process.env.PROFILE === 'dev' ||
                        process.env.NODE_ENV === 'development' ||
                        isDev

try {
  initializeFfmpeg()
} catch (error) {
  log.error('Failed to initialize FFmpeg:', error)
}

// Timestamp utility functions for YouTube timestamps
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '')
}

function generateTimestamps(filePaths: string[], durations: number[]): string {
  if (filePaths.length < 2) {
    return ''
  }

  const timestamps: string[] = []
  let cumulativeTime = 0

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i]
    const duration = durations[i]
    const fileName = path.basename(filePath)
    const fileNameWithoutExt = removeExtension(fileName)
    const timeString = formatTimestamp(cumulativeTime)

    timestamps.push(`${timeString} - ${fileNameWithoutExt}`)
    cumulativeTime += duration
  }

  return timestamps.join('\n')
}

function cleanupAudioTempFiles(
  tempMergedAudio: string | undefined,
  tempFadedFiles: string[]
): void {
  if (tempMergedAudio && fs.existsSync(tempMergedAudio)) {
    try {
      safeRmSync(tempMergedAudio)
    } catch (e) {
      log.error('Failed to delete temp merged audio file:', tempMergedAudio, e)
    }
  }
  cleanupTempFiles(tempFadedFiles, 'Faded audio files')
}

function generateErrorId(): string {
  const platform = process.platform === 'darwin' ? 'MAC' : 
                   process.platform === 'win32' ? 'WIN' : 
                   process.platform === 'linux' ? 'LINUX' : 'UNK'
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ERR_${platform}_${timestamp}_${random}`
}

process.env.APP_ROOT = path.join(__dirname, '..')

const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
interface Job {
  id: string
  type: string
  status: string
  progress: number
  name: string
  params: Record<string, unknown>
  result?: string
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  timestampText?: string
}

interface StoreSchema {
  queue?: Job[]
}
const store = new Store<StoreSchema>({
  defaults: {}
})

let splashWindow: BrowserWindow | null = null
let currentFfmpegCommand: ReturnType<typeof ffmpeg> | null = null

const SUPPORTED_LANGUAGES = ['en', 'ko', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'hi', 'ar', 'id', 'vi', 'th', 'it'] as const

const DEFAULT_VIDEO_WIDTH = 1920
const DEFAULT_VIDEO_HEIGHT = 1080
const DEFAULT_VIDEO_FPS = 30

// Audio Quality Presets
type AudioQualityPreset = 'low' | 'medium' | 'high' | 'studio'

interface AudioQualityConfig {
  codec: string
  bitrate: string
  sampleRate: string
}

const AUDIO_QUALITY_PRESETS: Record<AudioQualityPreset, AudioQualityConfig> = {
  low: {
    codec: 'aac',
    bitrate: '128k',
    sampleRate: '44100'
  },
  medium: {
    codec: 'aac',
    bitrate: '192k',
    sampleRate: '44100'
  },
  high: {
    codec: 'aac',
    bitrate: '256k',
    sampleRate: '48000'
  },
  studio: {
    codec: 'aac',
    bitrate: '320k',
    sampleRate: '48000'
  }
}

// Get audio quality config from store
function getAudioQualityConfig(): AudioQualityConfig {
  const quality = (store.get('settings.audioQuality', 'high') as AudioQualityPreset)
  return AUDIO_QUALITY_PRESETS[quality] || AUDIO_QUALITY_PRESETS.high
}

function setupAutoUpdater() {
  if (isDev) {
    log.info('Skipping auto updater setup in development mode')
    return
  }

  try {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...')
      win?.webContents.send('updater:checking-for-update')
    })

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version)
      win?.webContents.send('updater:update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info.version)
      win?.webContents.send('updater:update-not-available', {
        version: info.version
      })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent)
      log.info('Download progress:', percent + '%')
      win?.webContents.send('updater:download-progress', {
        percent,
        transferred: progressObj.transferred,
        total: progressObj.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version)
      win?.webContents.send('updater:update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      })
    })

    autoUpdater.on('error', (error) => {
      log.error('Auto updater error:', error)
      win?.webContents.send('updater:error', {
        message: error.message,
        stack: error.stack
      })
    })

    app.once('ready', () => {
      setTimeout(() => {
        if (!isDev && isPackaged) {
          log.info('Checking for updates...')
          autoUpdater.checkForUpdates().catch(err => {
            log.error('Failed to check for updates:', err)
          })
        }
      }, 5000)
    })
  } catch (error) {
    log.error('Failed to setup auto updater:', error)
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#020617',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const savedLanguage = (store.get('settings.language') as string | undefined) || 'en'
  
  const isDev = process.env.VITE_DEV_SERVER_URL !== undefined
  let splashPath: string
  let localesPath: string
  
  if (isDev) {
    splashPath = path.join(__dirname, '..', 'electron', 'splash.html')
    localesPath = path.join(__dirname, '..', 'src', 'locales')
  } else {
    const distPath = path.join(__dirname, 'splash.html')
    const altPath = path.join(__dirname, '..', 'electron', 'splash.html')
    
    if (fs.existsSync(distPath)) {
      splashPath = distPath
    } else if (fs.existsSync(altPath)) {
      splashPath = altPath
    } else {
      splashPath = path.join(process.resourcesPath || __dirname, 'electron', 'splash.html')
    }
    
    const possibleLocalesPaths = [
      path.join(process.resourcesPath || __dirname, '..', 'app.asar.unpacked', 'src', 'locales'),
      path.join(process.resourcesPath || __dirname, '..', 'app', 'src', 'locales'),
      path.join(__dirname, '..', 'src', 'locales'),
    ]
    
    localesPath = possibleLocalesPaths.find(p => fs.existsSync(p)) || possibleLocalesPaths[0]
  }
  
  let htmlContent = fs.readFileSync(splashPath, 'utf-8')
  
  try {
    const localeFile = path.join(localesPath, `${savedLanguage}.json`)
    if (fs.existsSync(localeFile)) {
      const localeData = JSON.parse(fs.readFileSync(localeFile, 'utf-8'))
      const tagline = localeData.app?.tagline || 'Create videos in 1 minute, even for beginners'
      const loadingText = localeData.splash?.loading || 'Loading...'
      
      htmlContent = htmlContent.replace(
        /<html lang="[^"]*">/,
        `<html lang="${savedLanguage}">`
      )
      
      htmlContent = htmlContent.replace(
        /<p class="tagline" id="tagline">.*?<\/p>/,
        `<p class="tagline" id="tagline">${tagline}</p>`
      )
      htmlContent = htmlContent.replace(
        /<p class="loading-text" id="loading-text">.*?<\/p>/,
        `<p class="loading-text" id="loading-text">${loadingText}</p>`
      )
    }
  } catch (error) {
    log.warn('Failed to load locale for splash screen:', error)
  }
  
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
  splashWindow.loadURL(dataUrl)
  
  splashWindow.center()
  
  return splashWindow
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // SECURITY: Critical security settings
      nodeIntegration: false, // Never enable nodeIntegration in renderer
      contextIsolation: true, // Isolate context between main and renderer
      sandbox: false, // Note: sandbox requires additional IPC setup
      webSecurity: true, // Enable web security features
      allowRunningInsecureContent: false, // Block insecure content
      experimentalFeatures: false, // Disable experimental features
    },
  })

  // Register window event handlers
  win.on('closed', () => {
    // Cleanup FFmpeg process when window closes
    if (currentFfmpegCommand) {
      try {
        currentFfmpegCommand.kill('SIGKILL')
        log.info('FFmpeg process killed on window close')
      } catch (error) {
        log.error('Failed to cleanup FFmpeg on window close:', error)
      } finally {
        currentFfmpegCommand = null
      }
    }
    win = null
  })

  if (enableDevTools) {
    win.webContents.openDevTools()
  }

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
    if (win && !win.isDestroyed()) {
      win.show()
    }
  })
}

ipcMain.handle('dialog:open-file', async (_event, type?: 'video' | 'image' | 'audio', multiSelect = false) => {
let filters: Electron.FileFilter[] = []

const imageExtensions = store.get('settings.fileExtensions.image', DEFAULT_IMAGE_EXTENSIONS) as string[]
const videoExtensions = store.get('settings.fileExtensions.video', DEFAULT_VIDEO_EXTENSIONS) as string[]
const audioExtensions = store.get('settings.fileExtensions.audio', DEFAULT_AUDIO_EXTENSIONS) as string[]

switch (type) {
case 'image':
    filters = [{ name: 'Images', extensions: imageExtensions.map(ext => ext.replace(/^\./, '')) }]
    break
case 'audio':
    filters = [{ name: 'Audio', extensions: audioExtensions.map(ext => ext.replace(/^\./, '')) }]
    break
case 'video':
    filters = [{ name: 'Videos', extensions: videoExtensions.map(ext => ext.replace(/^\./, '')) }]
    break

default:
    filters = [{ name: 'All Media', extensions: [...videoExtensions, ...audioExtensions, ...imageExtensions].map(ext => ext.replace(/^\./, '')).slice(0, 10) }]
}

const properties: Electron.OpenDialogOptions['properties'] = ['openFile']
if (multiSelect) {
properties.push('multiSelections')
}

const { canceled, filePaths } = await dialog.showOpenDialog({
properties: properties,
filters: filters
})

if (canceled) return null
  
return multiSelect ? filePaths : filePaths[0]
})

ipcMain.handle('notification:show', async (_event, { title, body }) => {
if (Notification.isSupported()) {
    new Notification({
      title,
      body
    }).show()
}
})

ipcMain.handle('job:cancel', async () => {
  try {
    if (currentFfmpegCommand) {
      try {
        currentFfmpegCommand.kill('SIGKILL')
        log.info('FFmpeg process cancelled by user')
      } catch (error) {
        log.error('Failed to kill FFmpeg process:', error)
      } finally {
        currentFfmpegCommand = null
      }
    }
    return { success: true }
  } catch (error) {
    log.error('Error cancelling job:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:open', async (_event, filePath: string) => {
try {
    await shell.openPath(filePath)
} catch (err) {
    log.error('Failed to open file:', err)
}
})

// Get image as base64 data URL
ipcMain.handle('file:get-image-data-url', async (_event, filePath: string) => {
  try {
    const normalizedPath = path.resolve(filePath)
    
    // Validate file exists
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`File not found: ${normalizedPath}`)
    }
    
    // Read file as buffer
    const imageBuffer = fs.readFileSync(normalizedPath)
    
    // Determine MIME type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    }
    const mimeType = mimeTypes[ext] || 'image/png'
    
    // Convert to base64 data URL
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    log.info('Converted image to data URL:', { filePath: normalizedPath, size: imageBuffer.length })
    
    return { success: true, dataUrl }
  } catch (error) {
    log.error('Failed to get image data URL:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('file:exists', async (_event, filePath: string) => {
try {
    const normalizedPath = path.resolve(filePath)
    return fs.existsSync(normalizedPath)
} catch (err) {
    return false
}
})

// Get app path (for accessing resources)
ipcMain.handle('app:get-path', async () => {
  try {
    return app.getAppPath()
  } catch (err) {
    log.error('Failed to get app path:', err)
    throw new Error('Failed to get app path')
  }
})

// Get audio duration
ipcMain.handle('audio:get-duration', async (_event, audioPath: string) => {
  try {
    const audioExtensions = store.get('settings.fileExtensions.audio', DEFAULT_AUDIO_EXTENSIONS) as string[]
    const validatedPath = validateAudioFilePath(audioPath, new Set(audioExtensions))
    const { getAudioDuration } = await import('./utils/ffmpeg/index.js')
    return await getAudioDuration(validatedPath)
  } catch (error) {
    log.error('Audio duration error:', error)
    const sanitizedError = sanitizeErrorMessage(error, 'Failed to get audio duration')
    throw new Error(sanitizedError)
  }
})

ipcMain.handle('logger:log', async (_event, level: string, args: unknown[]) => {
  try {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')
    
    switch (level) {
      case 'info':
        log.info(message)
        break
      case 'error':
        log.error(message)
        break
      case 'warn':
        log.warn(message)
        break
      case 'debug':
        log.debug(message)
        break
      default:
        log.info(message)
    }
  } catch (error) {
    // Logger error should not crash the app
    console.error('Logger IPC error:', error)
  }
})

ipcMain.handle('logs:open-folder', async () => {
  try {
    await shell.openPath(logFileDir)
    return { success: true, logPath: logFilePath }
  } catch (err) {
    log.error('Failed to open log folder:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('logs:get-path', async () => {
  try {
    return { success: true, logPath: logFilePath, logDir: logFileDir }
  } catch (err) {
    log.error('Failed to get log path:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('settings:get-language', async () => {
  const savedLanguage = store.get('settings.language') as string | undefined
  if (!savedLanguage) {
    const systemLocale = app.getLocale()
    
    const systemLang = systemLocale.split('-')[0].toLowerCase()
    const detectedLanguage = SUPPORTED_LANGUAGES.includes(systemLang as typeof SUPPORTED_LANGUAGES[number]) ? systemLang : 'en'
    
    store.set('settings.language', detectedLanguage)
    return {
      language: detectedLanguage
    }
  }
  
  return {
    language: savedLanguage
  }
})

ipcMain.handle('settings:set-language', async (_event, { language }: { language: string }) => {
  try {
    // Validate language is in supported list
    if (!SUPPORTED_LANGUAGES.includes(language as typeof SUPPORTED_LANGUAGES[number])) {
      log.warn(`Attempted to set unsupported language: ${language}`)
      throw new Error(`Unsupported language: ${language}. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`)
    }
    
    store.set('settings.language', language)
    return { success: true }
  } catch (error) {
    log.error('Failed to set language:', error)
    const sanitizedError = sanitizeErrorMessage(error, 'Failed to set language')
    throw new Error(sanitizedError)
  }
})

ipcMain.handle('settings:clear-all-data', async () => {
  try {
    store.clear()
    return { success: true }
  } catch (error) {
    log.error('Failed to clear all data:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('settings:get-tos-accepted', async () => {
return {
    hasAcceptedTerms: store.get('hasAcceptedTerms', false)
}
})

ipcMain.handle('settings:set-tos-accepted', async (_event, { accepted }: { accepted: boolean }) => {
store.set('hasAcceptedTerms', accepted)
return { success: true }
})

ipcMain.handle('settings:get-onboarding-completed', async () => {
return {
    hasCompletedOnboarding: store.get('hasCompletedOnboarding', false)
}
})

ipcMain.handle('settings:set-onboarding-completed', async (_event, { completed }: { completed: boolean }) => {
store.set('hasCompletedOnboarding', completed)
return { success: true }
})

const DEFAULT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']
const DEFAULT_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv']
const DEFAULT_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus', '.aiff', '.aif', '.alac']

ipcMain.handle('settings:get-file-extensions', async () => {
  return {
    image: store.get('settings.fileExtensions.image', DEFAULT_IMAGE_EXTENSIONS) as string[],
    video: store.get('settings.fileExtensions.video', DEFAULT_VIDEO_EXTENSIONS) as string[],
    audio: store.get('settings.fileExtensions.audio', DEFAULT_AUDIO_EXTENSIONS) as string[]
  }
})

ipcMain.handle('settings:set-file-extensions', async (_event, { image, video, audio }: { image: string[], video: string[], audio: string[] }) => {
  const validateExtensions = (exts: string[]): string[] => {
    return exts
      .map(ext => ext.trim().toLowerCase())
      .filter(ext => {
        if (!ext.startsWith('.')) {
          ext = '.' + ext
        }
        return /^\.\w+$/.test(ext)
      })
      .filter((ext, index, self) => self.indexOf(ext) === index) // Remove duplicates
  }

  const validatedImage = validateExtensions(image)
  const validatedVideo = validateExtensions(video)
  const validatedAudio = validateExtensions(audio)

  // At least one extension required
  if (validatedImage.length === 0 || validatedVideo.length === 0 || validatedAudio.length === 0) {
    throw new Error('At least one extension is required for each file type')
  }

  store.set('settings.fileExtensions.image', validatedImage)
  store.set('settings.fileExtensions.video', validatedVideo)
  store.set('settings.fileExtensions.audio', validatedAudio)

  return { success: true }
})

// Audio Quality Settings
ipcMain.handle('settings:get-audio-quality', async () => {
  return {
    quality: store.get('settings.audioQuality', 'high') as string
  }
})

ipcMain.handle('settings:set-audio-quality', async (_event, { quality }: { quality: string }) => {
  const VALID_QUALITIES = ['low', 'medium', 'high', 'studio']
  if (!VALID_QUALITIES.includes(quality)) {
    throw new Error(`Invalid audio quality: ${quality}. Valid options: ${VALID_QUALITIES.join(', ')}`)
  }
  
  store.set('settings.audioQuality', quality)
  return { success: true }
})

// Fast Mode Settings
ipcMain.handle('settings:get-fast-mode', async () => {
  return {
    fastMode: store.get('settings.fastMode', true) as boolean
  }
})

ipcMain.handle('settings:set-fast-mode', async (_event, { fastMode }: { fastMode: boolean }) => {
  if (typeof fastMode !== 'boolean') {
    throw new Error(`Invalid fast mode value: ${fastMode}. Must be a boolean.`)
  }
  
  store.set('settings.fastMode', fastMode)
  return { success: true }
})

// UI Preferences (Advanced options per tab + seconds)
const DEFAULT_UI_PREFERENCES = {
  imageMusic: {
    advancedOpen: false,
    enableFadeOut: false,
    fadeOutDuration: 2,
    enablePadding: false,
    paddingDuration: 3
  },
  concat: {
    advancedOpen: false,
    enableFadeOut: false,
    fadeOutDuration: 2,
    enablePadding: false,
    paddingDuration: 3,
    enableFadeIn: false
  },
  loop: {
    advancedOpen: false
  }
}

ipcMain.handle('settings:get-ui-preferences', async () => {
  const saved = store.get('settings.uiPreferences', DEFAULT_UI_PREFERENCES) as typeof DEFAULT_UI_PREFERENCES
  // Merge with defaults to handle missing fields
  return {
    imageMusic: { ...DEFAULT_UI_PREFERENCES.imageMusic, ...(saved?.imageMusic || {}) },
    concat: { ...DEFAULT_UI_PREFERENCES.concat, ...(saved?.concat || {}) },
    loop: { ...DEFAULT_UI_PREFERENCES.loop, ...(saved?.loop || {}) }
  }
})

ipcMain.handle('settings:set-ui-preferences', async (_event, prefs: Record<string, unknown>) => {
  // Basic validation + normalization (renderer is untrusted)
  const safe = {
    imageMusic: {
      advancedOpen: !!prefs?.imageMusic?.advancedOpen,
      enableFadeOut: !!prefs?.imageMusic?.enableFadeOut,
      fadeOutDuration: validateNumericInput(prefs?.imageMusic?.fadeOutDuration ?? 2, 0.5, 10, 'imageMusic.fadeOutDuration'),
      enablePadding: !!prefs?.imageMusic?.enablePadding,
      paddingDuration: validateNumericInput(prefs?.imageMusic?.paddingDuration ?? 3, 0, 60, 'imageMusic.paddingDuration')
    },
    concat: {
      advancedOpen: !!prefs?.concat?.advancedOpen,
      enableFadeOut: !!prefs?.concat?.enableFadeOut,
      fadeOutDuration: validateNumericInput(prefs?.concat?.fadeOutDuration ?? 2, 0.5, 10, 'concat.fadeOutDuration'),
      enablePadding: !!prefs?.concat?.enablePadding,
      paddingDuration: validateNumericInput(prefs?.concat?.paddingDuration ?? 3, 0, 60, 'concat.paddingDuration'),
      enableFadeIn: !!prefs?.concat?.enableFadeIn
    },
    loop: {
      advancedOpen: !!prefs?.loop?.advancedOpen
    }
  }

  store.set('settings.uiPreferences', safe)
  return { success: true }
})


// Save job queue
ipcMain.handle('store:save-queue', async (_event, { queue }: { queue: Job[] }) => {
// Privacy: remove OS account name from persisted paths (restore on read)
store.set('queue', collapseHomeInJson(queue))
return { success: true }
})

// Load job queue
ipcMain.handle('store:get-queue', async () => {
return {
    queue: expandHomeInJson(store.get('queue', []) as Job[])
}
})

// Clear job queue
ipcMain.handle('store:clear-queue', async (_event, { clearCompleted }: { clearCompleted?: boolean }) => {
if (clearCompleted) {
    const queue = store.get('queue', []) as Job[]
    const filtered = queue.filter(job => 
      job.status !== 'completed' && job.status !== 'failed' && job.status !== 'interrupted'
    )
    store.set('queue', filtered)
} else {
    store.delete('queue')
}
return { success: true }
})

// Open external link
// SECURITY: Validate URL before opening to prevent malicious URL execution
log.info('[IPC] Registering shell:open-external handler')
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  try {
    log.info('[IPC] shell:open-external called with URL:', url)
    // Validate URL format and protocol
    validateUrl(url)
    
    await shell.openExternal(url)
    log.info('[IPC] Successfully opened external URL')
    return { success: true }
  } catch (error) {
    log.error('Failed to open external URL:', error)
    // SECURITY: Don't expose internal error details to renderer
    const sanitizedError = sanitizeErrorMessage(error, 'Invalid URL or failed to open external link')
    return { success: false, error: sanitizedError }
  }
})
log.info('[IPC] Successfully registered shell:open-external handler')

// Auto Updater IPC handlers
ipcMain.handle('updater:check-for-updates', async () => {
if (isDev) {
    log.info('Update check skipped in development mode')
    return { success: false, reason: 'development-mode' }
}
try {
    await autoUpdater.checkForUpdates()
    return { success: true }
} catch (error) {
    log.error('Failed to check for updates:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
}
})

ipcMain.handle('updater:download-update', async () => {
if (isDev) {
    return { success: false, reason: 'development-mode' }
}
try {
    await autoUpdater.downloadUpdate()
    return { success: true }
} catch (error) {
    log.error('Failed to download update:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
}
})

ipcMain.handle('updater:quit-and-install', async () => {
if (isDev) {
    return { success: false, reason: 'development-mode' }
}
try {
    autoUpdater.quitAndInstall(false, true) // isSilent=false, isForceRunAfter=true
    return { success: true }
} catch (error) {
    log.error('Failed to quit and install:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
}
})

// Get video duration (in seconds)
// SECURITY: Validate file path to prevent Path Traversal attacks
ipcMain.handle('video:get-duration', async (_event, videoPath: string) => {
try {
    // Validate and normalize file path
    const videoExtensions = store.get('settings.fileExtensions.video', DEFAULT_VIDEO_EXTENSIONS) as string[]
    const validatedPath = validateVideoFilePath(videoPath, new Set(videoExtensions))
      
    return new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(validatedPath, (err, metadata) => {
        if (err) {
          log.error('FFprobe Error (Duration):', err)
          // SECURITY: Sanitize error message to prevent path disclosure
          const sanitizedError = sanitizeErrorMessage(err, 'Failed to get video duration')
          reject(new Error(sanitizedError))
          return
        }
        const duration = metadata.format.duration || 0
        resolve(duration)
      })
    })
} catch (error) {
    log.error('Video duration validation error:', error)
    const sanitizedError = sanitizeErrorMessage(error, 'Invalid video file path')
    throw new Error(sanitizedError)
}
})

ipcMain.handle('video:process', async (_event, { inputPath, iterations }) => {
  if (!win) return;
  
  // Reset progress tracker at start of new job
  resetProgress()
  
  try {
    const ext = path.extname(inputPath)
    const desiredPath = inputPath.replace(ext, `_looped_${iterations}x${ext}`)
    const outPath = getSafeOutputPath(desiredPath)

    return new Promise((resolve, reject) => {
      log.info('[FFmpeg] Starting video processing...')
      const command = ffmpeg(inputPath)
        .inputOptions([`-stream_loop ${iterations - 1}`])
        .outputOptions(['-c copy'])  // Fast processing (no re-encoding)
        .on('progress', (p) => {
          // Guardrail: limit to 0-99%
          const clampedProgress = Math.max(0, Math.min(Math.round(p.percent || 0), 99))
          sendProgress(clampedProgress)
        })
        .on('end', () => {
          currentFfmpegCommand = null
          sendProgress(100)
          resolve(outPath)
        })
        .on('error', (err) => {
          log.error('FFmpeg Error (Loop):', err)
          currentFfmpegCommand = null
          reject(err)
        })
        
      currentFfmpegCommand = command
      command.save(outPath)
    })
  } catch (error) {
    log.error('Video process error:', error)
    throw error
  }
})

ipcMain.handle('video:create-from-image', async (_event, { 
  imagePath, 
  audioPath, 
  enablePadding = false,
  paddingDuration = 3,
  enableFadeOut = true,
  fadeOutDuration = 2
}) => {
  let jobTempDir: string | undefined
  let tempMergedAudio: string | undefined = undefined
  const tempFadedFiles: string[] = [] // Temporary files (image/segment/merge etc.)

  try {
    if (!win) return
    
    // Reset progress tracker at start of new job
    resetProgress()

    // Temp workdir (cross-platform, OS-managed temp location)
    const workDir = (jobTempDir = createJobTempDir())
    
  // NOTE: enableFadeOut is only used for audio fade out.
  // Video fade in/out is not applied in image-based video creation.
  // (Even when there's no image, only black screen is provided without video fade)
  
  // If audioPath is an array, merge them first
const audioPaths = Array.isArray(audioPath) ? audioPath : [audioPath]
let finalAudioPath: string
let playlistTimestamps: string | undefined = undefined // YouTube timestamps (for playlist)

  // 🚀 PLAYLIST OPTIMIZATION: Check if we should use segmented encoding
  const { shouldUseSegmentedOptimization, createPlaylistWithSegments } = await import('./utils/ffmpeg/playlistOptimizer.js')
  
  // Check if segmented optimization should be used
  const useSegmentedOptimization = audioPaths.length > 1 && 
    (enablePadding || enableFadeOut) &&
    await shouldUseSegmentedOptimization(audioPaths, enableFadeOut, enablePadding)

  if (useSegmentedOptimization) {
    // 🚀🚀🚀 ULTRA-FAST PLAYLIST MODE: Segmented Encoding!
    log.info('[CreateFromImage] ⚡⚡⚡ Using SEGMENTED OPTIMIZATION for playlist!')
    log.info('[CreateFromImage] This will be 10-15x FASTER than traditional method!')
    log.info('[CreateFromImage] Tracks:', audioPaths.length)
    
    // Preprocess image first (if needed)
    let processedImagePath: string | null = imagePath
    if (imagePath && imagePath !== '') {
      const normalizedImagePath = path.resolve(imagePath)
      const videoWidth = store.get('settings.video.width', DEFAULT_VIDEO_WIDTH) as number
      const videoHeight = store.get('settings.video.height', DEFAULT_VIDEO_HEIGHT) as number
      
      // Create temp padded image
      const tempImagePath = path.join(workDir, `temp_padded_${Date.now()}.png`)
      tempFadedFiles.push(tempImagePath)
      
      log.info(`[CreateFromImage] Pre-processing image...`)
      await new Promise<void>((resolvePreprocess, rejectPreprocess) => {
        ffmpeg(normalizedImagePath)
          .videoFilters([
            `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease`,
            `pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2:black`
          ])
          .outputOptions(['-vframes', '1', '-f', 'image2', '-pix_fmt', 'yuv420p'])
          .on('end', () => resolvePreprocess())
          .on('error', (err) => rejectPreprocess(err))
          .save(tempImagePath)
      })
      
      processedImagePath = tempImagePath
    }
    
    // Use segmented optimization
    const firstAudioPath = audioPaths[0]
    const outPath = firstAudioPath.replace(path.extname(firstAudioPath), '.mp4')
    const safeOutPath = getSafeOutputPath(outPath)
    
    try {
      const result = await createPlaylistWithSegments({
        imagePath: processedImagePath || '',
        audioFiles: audioPaths,
        outputPath: safeOutPath,
        enablePadding,
        paddingDuration,
        enableFadeOut,
        fadeOutDuration,
        tempDir: workDir,
        onProgress: (progress) => {
          sendProgress(progress)
        }
      })
      
      // Generate YouTube timestamps
      const audioDurations: number[] = []
      for (const audioPath of audioPaths) {
        const validation = await validateAudioFile(path.resolve(audioPath))
        audioDurations.push(validation.duration)
      }
      playlistTimestamps = generateTimestamps(audioPaths, audioDurations)
      
      // Keep return type consistent with non-segmented path: JSON string
      return JSON.stringify({
        outputPath: result,
        timestamps: playlistTimestamps
      })
    } catch (error) {
      log.error('[CreateFromImage] Segmented optimization failed:', error)
      throw error
    }
  }
  
  // If multiple audio files, merge them first (OPTIMIZED: Use fast concat with stream copy)
if (audioPaths.length > 1) {
    const firstAudioPath = audioPaths[0]
    // Use .mp3 extension for better compatibility
    const mergedPath = path.join(
      workDir,
      `${path.basename(firstAudioPath, path.extname(firstAudioPath))}_playlist_${Date.now()}.mp3`
    )
    tempMergedAudio = mergedPath
    tempFadedFiles.push(mergedPath)
      
    // Get audio quality config
    const audioConfig = getAudioQualityConfig()
      
    log.info('[CreateFromImage] Concatenating', audioPaths.length, 'audio files...')
    log.info('[CreateFromImage] Settings:', {
      enablePadding,
      paddingDuration,
      enableFadeOut,
      fadeOutDuration,
      audioBitrate: audioConfig.bitrate,
      fastMode: !enablePadding && !enableFadeOut
    })
      
    // Use optimized concatenateAudios (stream copy when no effects)
    try {
      await concatenateAudios(audioPaths, mergedPath, {
        enablePadding,
        paddingDuration,
        enableFadeOut,
        fadeOutDuration,
        audioBitrate: audioConfig.bitrate,
        tempDir: workDir,
        onProgress: (progress) => {
          // Merge progress: 0-49%
          const mergeProgress = Math.min(Math.round(progress / 2), 49)
          sendProgress(mergeProgress)
        }
      })
      
      sendProgress(50) // Merge complete 50%
      log.info('[CreateFromImage] Audio concatenation completed')
    } catch (err) {
      log.error('[CreateFromImage] Audio concatenation failed:', err)
      
      // Enhanced error message for corrupted audio
      const errorMessage = err instanceof Error ? err.message : String(err)
          const isCorruptedAudio = 
        errorMessage.includes('channel element') ||
        errorMessage.includes('Number of bands') ||
        errorMessage.includes('Invalid data found') ||
        errorMessage.includes('Error while decoding') ||
        errorMessage.includes('Too large remapped id') ||
        errorMessage.includes('Not yet implemented in FFmpeg') ||
        errorMessage.includes('corrupted file')
          
          if (isCorruptedAudio) {
            const fileList = audioPaths.map((p, i) => `${i + 1}. ${path.basename(p)}`).join('\n')
        const enhancedMessage = `Corrupted audio file detected.\n\nSelected files:\n${fileList}\n\nSolutions:\n1. Re-download the file\n2. Open the file in an audio editing program (e.g., Audacity) and save it again\n3. Convert to WAV or MP3 format`
        const appError = new AppError(ErrorCode.AUDIO_MERGE_FAILED, enhancedMessage, err instanceof Error ? err : undefined)
        throw new Error(serializeErrorForIPC(appError, appError.code))
      }
      
      // Generic error
          const appError = new AppError(ErrorCode.AUDIO_MERGE_FAILED, errorMessage, err instanceof Error ? err : undefined)
      throw new Error(serializeErrorForIPC(appError, appError.code))
    }
      
    finalAudioPath = mergedPath
    
    // Collect durations for timestamp generation
    const audioDurations: number[] = []
    log.info('[CreateFromImage] Collecting audio durations for timestamps...')
    for (const audioPath of audioPaths) {
      const normalizedPath = path.resolve(audioPath)
      const validation = await validateAudioFile(normalizedPath)
      audioDurations.push(validation.duration)
    }
    
    // Generate YouTube timestamps for playlist
    log.info('[CreateFromImage] Generating YouTube timestamps for playlist...')
    playlistTimestamps = generateTimestamps(audioPaths, audioDurations)
    log.info('[CreateFromImage] Generated timestamps:', playlistTimestamps)
} else {
    // Single file: normalize path and validate
    finalAudioPath = path.resolve(audioPaths[0])
    const validation = await validateAudioFile(finalAudioPath)
      
    if (!validation.valid) {
      const error = new AppError(
        ErrorCode.AUDIO_CORRUPTED,
        `Processing failed due to corrupted file.\nProblematic file: ${path.basename(finalAudioPath)}`
      )
      return Promise.reject(new Error(serializeErrorForIPC(error, error.code)))
    }
}

const desiredPath = finalAudioPath.replace(path.extname(finalAudioPath), '.mp4')
const outPath = getSafeOutputPath(desiredPath)
    
  // CRITICAL: Await the Promise to ensure FFmpeg completes before finally block executes
  const result = await new Promise<string>((resolve, reject) => {
    // Get audio duration first (for progress calculation)
    // Normalize path to absolute path before passing
    const normalizedAudioPath = path.resolve(finalAudioPath)
    if (!fs.existsSync(normalizedAudioPath)) {
      const appError = new AppError(ErrorCode.AUDIO_NOT_FOUND, `Audio file not found: ${normalizedAudioPath}`)
      reject(new Error(serializeErrorForIPC(appError, appError.code)))
      return
    }
      
    ffmpeg.ffprobe(normalizedAudioPath, (err, metadata) => {
      if (err) {
        log.error('FFprobe Error:', err)
        log.error('Audio path:', normalizedAudioPath)
        log.error('Error details:', err.message)
          
        // If ffprobe fails, try to get duration directly with ffmpeg
        const tempCommand = ffmpeg(normalizedAudioPath)
        tempCommand.ffprobe((probeErr: Error | null, probeMetadata: FfmpegMetadata | undefined) => {
          if (probeErr) {
            log.error('FFmpeg probe also failed:', probeErr)
            log.error('CRITICAL: Cannot determine audio duration - ABORTING')
            const appError = new AppError(
              ErrorCode.AUDIO_VALIDATION_FAILED,
              `Audio file analysis failed: File may be corrupted or in an unsupported format.\nFile: ${path.basename(normalizedAudioPath)}`
            )
            reject(new Error(serializeErrorForIPC(appError, appError.code)))
            return
          }
          
          const audioDuration = probeMetadata.format.duration || 0
          
          if (audioDuration <= 0) {
            log.error('CRITICAL: Audio duration is 0 or negative!')
            const appError = new AppError(
              ErrorCode.AUDIO_VALIDATION_FAILED,
              `Invalid audio duration: ${audioDuration}s\nFile: ${path.basename(normalizedAudioPath)}`
            )
            reject(new Error(serializeErrorForIPC(appError, appError.code)))
            return
          }
          
          log.info(`[CreateFromImage] Audio duration: ${audioDuration}s (${Math.floor(audioDuration / 60)}m ${Math.floor(audioDuration % 60)}s)`)
          proceedWithVideoCreation(audioDuration)
        })
        return
      }

      const audioDuration = metadata.format.duration || 0 // Audio duration (seconds)
      
      if (audioDuration <= 0) {
        log.error('CRITICAL: Audio duration is 0 or negative!')
            const appError = new AppError(
              ErrorCode.AUDIO_VALIDATION_FAILED,
              `Invalid audio duration: ${audioDuration}s\nFile: ${path.basename(normalizedAudioPath)}`
            )
        reject(new Error(serializeErrorForIPC(appError, appError.code)))
        return
      }
      
      log.info(`[CreateFromImage] Audio duration: ${audioDuration}s (${Math.floor(audioDuration / 60)}m ${Math.floor(audioDuration % 60)}s)`)
      proceedWithVideoCreation(audioDuration)
    })
      
    const proceedWithVideoCreation = async (audioDuration: number) => {
        
      const command = ffmpeg()
        
      // If no image, create black background (1920x1080, 16:9 ratio)
      // NOTE: Video fade in/out is not applied in image-based video creation.
      // Audio fade out is only applied when there are multiple audio files.
      if (!imagePath || imagePath === '') {
        const videoWidth = store.get('settings.video.width', DEFAULT_VIDEO_WIDTH) as number
        const videoHeight = store.get('settings.video.height', DEFAULT_VIDEO_HEIGHT) as number
        
        // 🚀 FAST MODE: Create short black video segment and loop it
        log.info(`[CreateFromImage] 🚀 FAST MODE: Creating short black video segment...`)
        const tempBlackSegmentPath = path.join(workDir, `temp_black_segment_${Date.now()}.mp4`)
        tempFadedFiles.push(tempBlackSegmentPath) // Will be cleaned up later
        
        await new Promise<void>((resolveBlack, rejectBlack) => {
          ffmpeg()
            .input(`color=c=black:s=${videoWidth}x${videoHeight}:r=1`)
          .inputFormat('lavfi')
            .outputOptions([
              '-t', '1',              // 1 second duration
              '-c:v', 'libx264',      // Encode once
              '-preset', 'ultrafast', // Fast encoding
              '-pix_fmt', 'yuv420p',
              '-g', '1',              // Keyframe every frame
              '-movflags', '+faststart'
            ])
            .on('end', () => {
              log.info(`[CreateFromImage] ✅ Black video segment created (<1s)`)
              resolveBlack()
            })
            .on('error', (err) => {
              log.error(`[CreateFromImage] Black video segment creation failed:`, err)
              rejectBlack(err)
            })
            .save(tempBlackSegmentPath)
        })
        
        // Calculate exact loop count based on audio duration
        // CRITICAL: audioDuration must be > 0, otherwise we get infinite loop!
        if (audioDuration <= 0) {
          const appError = new AppError(
            ErrorCode.AUDIO_VALIDATION_FAILED,
            `Cannot determine audio duration (${audioDuration}s). Audio file may be corrupted.`
          )
          reject(new Error(serializeErrorForIPC(appError, appError.code)))
          return
        }
        
        // Loop count: -1 means loop (audioDuration - 1) times
        // Example: 480s audio, 1s video → loop 479 times = 480s total
        // IMPORTANT: audioDuration already includes padding if multiple audio files with padding enabled
        let loopCount = Math.max(1, Math.ceil(audioDuration) - 1)
        let videoDuration = loopCount + 1
        
        // Safety check: ensure video is at least as long as audio (with small tolerance for floating point)
        if (videoDuration < audioDuration - 0.1) {
          log.warn(`[CreateFromImage] ⚠️ Video duration (${videoDuration}s) is shorter than audio (${audioDuration.toFixed(2)}s), adjusting loop count`)
          loopCount = Math.max(1, Math.ceil(audioDuration))
          videoDuration = loopCount + 1
          log.info(`[CreateFromImage] 🚀 Adjusted loop count: ${loopCount} (total: ${videoDuration}s)`)
        } else {
          log.info(`[CreateFromImage] 🚀 Using -stream_loop ${loopCount} (audio: ${audioDuration.toFixed(2)}s, black segment: 1s, total: ${videoDuration}s)`)
        }
        
        command
          .input(tempBlackSegmentPath)
          .inputOptions(['-stream_loop', String(loopCount)]) // Exact loop count (not infinite!)
      } else {
        // 🚀 OPTIMIZATION: Pre-process image with padding (0.01 sec instead of processing every frame!)
        // If image exists, fit to 16:9 ratio (add black letterbox)
        // Validate path, normalize, and check file existence
        let normalizedImagePath: string
        try {
          const imageExtensions = store.get('settings.fileExtensions.image', DEFAULT_IMAGE_EXTENSIONS) as string[]
          normalizedImagePath = validateImageFilePath(imagePath, new Set(imageExtensions))
        } catch (error) {
          const appError = new AppError(
            ErrorCode.IMAGE_VALIDATION_FAILED,
            `Invalid image file path: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined
          )
          reject(new Error(serializeErrorForIPC(appError, appError.code)))
          return
        }
        if (!fs.existsSync(normalizedImagePath)) {
          const appError = new AppError(ErrorCode.IMAGE_NOT_FOUND, `Image file not found: ${normalizedImagePath}`)
          reject(new Error(serializeErrorForIPC(appError, appError.code)))
          return
        }
        
        const videoWidth = store.get('settings.video.width', DEFAULT_VIDEO_WIDTH) as number
        const videoHeight = store.get('settings.video.height', DEFAULT_VIDEO_HEIGHT) as number
        
        // 🚀 Pre-process image with padding (FAST!)
        const tempImagePath = path.join(workDir, `temp_padded_${Date.now()}.png`)
        tempFadedFiles.push(tempImagePath) // Will be cleaned up later
        
        log.info(`[CreateFromImage] 🚀 FAST MODE: Creating short video segment with stream copy strategy...`)
        
        // Step 1: Create padded image (only 1 frame! <0.1 sec)
        await new Promise<void>((resolvePreprocess, rejectPreprocess) => {
          ffmpeg(normalizedImagePath)
          .videoFilters([
              `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease`,
              `pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2:black`
            ])
            .outputOptions([
              '-vframes', '1',  // Only 1 frame!
              '-f', 'image2',
              '-pix_fmt', 'yuv420p'
            ])
            .on('end', () => {
              log.info(`[CreateFromImage] ✅ Step 1/3: Image preprocessed (<0.1s)`)
              resolvePreprocess()
            })
            .on('error', (err) => {
              log.error(`[CreateFromImage] Image preprocessing failed:`, err)
              rejectPreprocess(err)
            })
            .save(tempImagePath)
        })
        
        // Step 2: Create a short video segment (1 second, 1 FPS = 1 frame) from padded image
        const tempVideoSegmentPath = path.join(workDir, `temp_segment_${Date.now()}.mp4`)
        tempFadedFiles.push(tempVideoSegmentPath) // Will be cleaned up later
        
        log.info(`[CreateFromImage] Creating 1-second video segment...`)
        await new Promise<void>((resolveSegment, rejectSegment) => {
          ffmpeg(tempImagePath)
            .inputOptions(['-loop', '1'])
            .outputOptions([
              '-t', '1',              // 1 second duration
              '-r', '1',              // 1 FPS (only 1 frame)
              '-c:v', 'libx264',      // Encode once
              '-preset', 'ultrafast', // Fast encoding
              '-tune', 'stillimage',  // Optimize for still image
              '-pix_fmt', 'yuv420p',
              '-g', '1',              // Keyframe every frame
              '-movflags', '+faststart'
            ])
            .on('end', () => {
              log.info(`[CreateFromImage] ✅ Step 2/3: Video segment created (<1s)`)
              resolveSegment()
            })
            .on('error', (err) => {
              log.error(`[CreateFromImage] Video segment creation failed:`, err)
              rejectSegment(err)
            })
            .save(tempVideoSegmentPath)
        })
        
        // Step 3: Calculate exact loop count based on audio duration
        // CRITICAL: audioDuration must be > 0, otherwise we get infinite loop!
        if (audioDuration <= 0) {
          const appError = new AppError(
            ErrorCode.AUDIO_VALIDATION_FAILED,
            `Cannot determine audio duration (${audioDuration}s). Audio file may be corrupted.`
          )
          reject(new Error(serializeErrorForIPC(appError, appError.code)))
          return
        }
        
        // Loop count = ceil(audio duration) - 1 (because -stream_loop 0 means play once, 1 means play twice, etc.)
        // IMPORTANT: audioDuration already includes padding if multiple audio files with padding enabled
        let loopCount = Math.max(1, Math.ceil(audioDuration) - 1)
        let videoDuration = loopCount + 1
        
        // Safety check: ensure video is at least as long as audio (with small tolerance for floating point)
        if (videoDuration < audioDuration - 0.1) {
          log.warn(`[CreateFromImage] ⚠️ Video duration (${videoDuration}s) is shorter than audio (${audioDuration.toFixed(2)}s), adjusting loop count`)
          loopCount = Math.max(1, Math.ceil(audioDuration))
          videoDuration = loopCount + 1
          log.info(`[CreateFromImage] 🚀 Adjusted loop count: ${loopCount} (total: ${videoDuration}s)`)
        } else {
          log.info(`[CreateFromImage] 🚀 Using -stream_loop ${loopCount} (audio: ${audioDuration.toFixed(2)}s, segment: 1s, total: ${videoDuration}s)`)
        }
        
        command
          .input(tempVideoSegmentPath)
          .inputOptions(['-stream_loop', String(loopCount)]) // Exact loop count (not infinite!)
        // Will use -c:v copy later (no re-encoding!)
      }
        
      // Normalize audio file path as well
      const normalizedFinalAudioPath = path.resolve(finalAudioPath)
      const audioConfig = getAudioQualityConfig()
      command
        .input(normalizedFinalAudioPath)
        .outputOptions([
          '-c:v', 'copy',              // 🚀 STREAM COPY: No re-encoding! (10-30x faster!)
          '-c:a', audioConfig.codec,   // Audio codec
          '-b:a', audioConfig.bitrate, // Audio bitrate (user setting)
          '-ar', audioConfig.sampleRate, // Sample rate (user setting)
          '-shortest',                 // End video when audio ends
          '-movflags', '+faststart'    // 🚀 OPTIMIZATION: fast start
        ])
        .on('progress', (p) => {
          // Parse timemark to calculate actual progress
          if (audioDuration > 0 && p.timemark) {
            const timeParts = p.timemark.split(':')
            const currentSeconds = 
              parseInt(timeParts[0]) * 3600 + 
              parseInt(timeParts[1]) * 60 + 
              parseFloat(timeParts[2])
            const progressPercent = Math.round((currentSeconds / audioDuration) * 100)
              
            // If multiple audio files, start from 50% (0-50% used for merging)
            const baseProgress = audioPaths.length > 1 ? 50 : 0
            const rangeProgress = audioPaths.length > 1 ? 49 : 99 // 50-99% or 0-99%
            const adjustedProgress = baseProgress + Math.round((progressPercent / 100) * rangeProgress)
              
            // Guardrail: limit final progress
            const clampedProgress = Math.max(0, Math.min(adjustedProgress, 99))
            sendProgress(clampedProgress)
          }
        })
        .on('end', async () => {
          // Cleanup audio temp files (always execute)
          cleanupAudioTempFiles(tempMergedAudio, tempFadedFiles)
            
          currentFfmpegCommand = null
          sendProgress(100) // 100% on completion
          
          // Return output path and timestamps (if playlist)
          resolve(JSON.stringify({ 
            outputPath: outPath, 
            timestamps: playlistTimestamps 
          }))
        })
        .on('error', (err, stdout, stderr) => {
          log.error('FFmpeg Error:', err)
          log.error('FFmpeg stderr:', stderr)
          log.error('Audio path:', normalizedFinalAudioPath)
          log.error('Image path:', imagePath ? path.resolve(imagePath) : 'None')
          // Delete temp files even on error
          cleanupAudioTempFiles(tempMergedAudio, tempFadedFiles)
          currentFfmpegCommand = null
          const appError = new AppError(ErrorCode.VIDEO_PROCESSING_FAILED, `Video creation failed: ${err.message}\n${stderr || ''}`, err)
          reject(new Error(serializeErrorForIPC(appError, appError.code)))
        })
        
      currentFfmpegCommand = command
      command.save(outPath)
    }
  })
  
  // CRITICAL: Return result after Promise completes
  // This ensures finally block only runs after FFmpeg finishes
  return result
  } catch (error) {
    // Format error with code for IPC serialization
    if (error instanceof AppError) {
      const formattedError = serializeErrorForIPC(error, error.code)
      throw new Error(formattedError)
    }
    // If it's already a formatted error, re-throw as is
    if (error instanceof Error && error.message.includes('[ERROR_CODE:')) {
      throw error
    }
    // Unknown error - wrap with unknown code
    throw new Error(serializeErrorForIPC(error, ErrorCode.UNKNOWN_ERROR))
  } finally {
    // Always cleanup temp workdir/files (best-effort). Important for Windows EBUSY cases.
    // CRITICAL: This only runs after Promise completes (end or error event)
    try {
      for (const tempFile of tempFadedFiles) {
        await safeRm(tempFile)
      }
      if (tempMergedAudio && !tempFadedFiles.includes(tempMergedAudio)) {
        await safeRm(tempMergedAudio)
      }
      if (jobTempDir) {
        await safeRm(jobTempDir, { recursive: true })
      }
    } catch {
      // Ignore all cleanup errors
    }
  }
})

// Concatenate videos
ipcMain.handle('video:concat', async (_event, { 
  videoPaths, 
  enablePadding = false, 
  paddingDuration = 3,
  enableFadeOut = true,
  fadeOutDuration = 2,
  enableFadeIn = false
}) => {
if (!win) return
    
  // Reset progress tracker at start of new job
  resetProgress()
  
  let workDir: string | undefined
  try {
    workDir = createJobTempDir()
    // SECURITY: Validate all video file paths
    if (!videoPaths || videoPaths.length === 0) {
      throw new Error('At least 1 video is required')
    }
      
    const validatedVideoPaths = validateFilePaths(videoPaths, new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv']))
      
    // Validate numeric parameters
    // Validate padding and fade out duration (values are used implicitly in processing)
    if (enablePadding) {
      validateNumericInput(paddingDuration, 0, 60, 'paddingDuration')
    }
    if (enableFadeOut) {
      validateNumericInput(fadeOutDuration, 0, 10, 'fadeOutDuration')
    }
      
    const firstVideoPath = validatedVideoPaths[0]
    const tempDir = workDir
    // Collect temp files (including SmartConcat audio-resample intermediates) for cleanup
    const tempFiles: string[] = []
      
    // SMART CONCAT: Analyze video file specifications
    log.info('[SmartConcat] Starting analysis of video file specifications...')
    log.info(`[SmartConcat] Analyzing ${validatedVideoPaths.length} video file(s)`)
    
    // CRITICAL: Calculate hasEffects in outer scope so it's accessible in Promise block
    const hasEffects = enableFadeOut || enableFadeIn || enablePadding
    
    let analysisResult: AnalysisResult
    let useStreamCopy = false
    let audioResampledPaths: string[] | null = null
      
    try {
      analysisResult = await analyzeFileSpecs(validatedVideoPaths)
      log.info('[SmartConcat] Analysis completed:')
      log.info(formatAnalysisResult(analysisResult))
        
      // Determine if we can use stream copy
      // Use stream copy only if:
      // 1. All specs match
      // 2. No fade effects (fade requires re-encoding)
      // 3. No padding (padding requires re-encoding)
      // CRITICAL: If allMatch is true AND no effects are enabled, MUST use Fast Mode
      useStreamCopy = analysisResult.allMatch && !hasEffects

      // SMART CONCAT IMPROVEMENT:
      // If ONLY audio sample rate mismatches, avoid full re-encode:
      // - Resample audio to target sample rate (copy video)
      // - Then concat with -c copy
      // CRITICAL: Effects must be disabled for audio-only resample
      const canTryAudioOnlyResample =
        !useStreamCopy &&
        !hasEffects &&
        analysisResult.targetSpec !== null &&
        analysisResult.targetSpec.videoCodec === 'h264' &&
        analysisResult.targetSpec.audioCodec === 'aac'

      if (canTryAudioOnlyResample) {
        const target = analysisResult.targetSpec!

        // Check if mismatches are ONLY audio sample rate (other fields match within tolerances)
        const isOnlyAudioSampleRateMismatch = analysisResult.specs.every((spec) => {
          const resolutionMatch = spec.width === target.width && spec.height === target.height
          const videoCodecMatch = spec.videoCodec === target.videoCodec
          const audioCodecMatch = spec.audioCodec === target.audioCodec
          const pixelFormatMatch = spec.pixelFormat === target.pixelFormat
          const frameRateMatch = Math.abs(spec.frameRate - target.frameRate) <= 0.1
          const sampleRateMatch = Math.abs(spec.audioSampleRate - target.audioSampleRate) <= 100

          // Allow ONLY sample rate mismatch
          return resolutionMatch && videoCodecMatch && audioCodecMatch && pixelFormatMatch && frameRateMatch && (sampleRateMatch || spec.audioSampleRate > 0)
        }) && analysisResult.specs.some(s => Math.abs(s.audioSampleRate - target.audioSampleRate) > 100)

        if (isOnlyAudioSampleRateMismatch) {
          log.info('[SmartConcat] ✅ Detected audio sample-rate-only mismatch. Trying audio-only resample + stream copy concat.')

          const resampled: string[] = []
          for (let i = 0; i < validatedVideoPaths.length; i++) {
            const inputPath = path.resolve(validatedVideoPaths[i])
            const spec = analysisResult.specs[i]

            // If sample rate already matches, keep original file
            if (Math.abs(spec.audioSampleRate - target.audioSampleRate) <= 100) {
              resampled.push(inputPath)
              continue
            }

            const out = path.resolve(tempDir, `resampled_${i}_${path.basename(inputPath, path.extname(inputPath))}.mp4`)
            tempFiles.push(out)
            log.info('[SmartConcat] Resampling audio only:', {
              file: path.basename(inputPath),
              from: spec.audioSampleRate,
              to: target.audioSampleRate,
              out: path.basename(out)
            })

            await new Promise<void>((resolveResample, rejectResample) => {
              const cmd = ffmpeg(inputPath)
                .outputOptions([
                  // Copy video, re-encode audio to match sample rate
                  '-map', '0:v:0',
                  '-map', '0:a:0?',
                  '-c:v', 'copy',
                  '-c:a', 'aac',
                  '-b:a', '192k',
                  '-ar', String(Math.round(target.audioSampleRate)),
                  '-ac', '2',
                  '-movflags', '+faststart'
                ])
                .on('start', (cmdLine) => {
                  log.info(`[FFmpeg:SmartConcat:resample:${path.basename(out)}] ${cmdLine}`)
                })
                .on('end', () => resolveResample())
                .on('error', (err, _stdout, stderr) => {
                  log.error('[SmartConcat] Audio-only resample failed:', err)
                  log.error('[SmartConcat] FFmpeg stderr:', stderr)
                  rejectResample(err)
                })

              cmd.save(out)
            })

            resampled.push(out)
          }

          // Re-check specs after resampling; if it matches now, enable stream copy
          const post = await analyzeFileSpecs(resampled)
          if (post.allMatch) {
            audioResampledPaths = resampled
            useStreamCopy = true
            log.info('[SmartConcat] ⚡ Audio-only resample succeeded. Proceeding with FAST MODE concat (-c copy).')
          } else {
            log.warn('[SmartConcat] Audio-only resample did not fully normalize specs. Falling back to re-encode.')
            log.warn(formatAnalysisResult(post))
          }
        }
      }
      
      log.info(`[SmartConcat] 🚀 Fast Mode Check:`, {
        allMatch: analysisResult.allMatch,
        enableFadeOut,
        enableFadeIn,
        enablePadding,
        hasEffects,
        decision: useStreamCopy ? '✅ FAST MODE (Stream Copy)' : '❌ Slow Mode (Re-encoding)'
      })
        
      if (!useStreamCopy && analysisResult.requiresReencoding) {
        // Notify user about compatibility mode (optional - can be sent to renderer)
        log.info('[SmartConcat] ⚠️  Decision: Re-encoding (Compatibility Mode)')
        log.info('[SmartConcat] Reason: Mismatched specifications')
        win?.webContents.send('video:concat-mode', { 
          mode: 'compatibility', 
          message: 'Processing in compatibility mode (slower) due to different video specifications'
        })
      } else if (useStreamCopy) {
        log.info('[SmartConcat] ⚡ Decision: Stream Copy (Fast Mode - 1-5 seconds!)')
        log.info('[SmartConcat] Reason: All files match specifications, no effects enabled')
        win?.webContents.send('video:concat-mode', { 
          mode: 'fast', 
          message: 'Fast processing mode (stream copy)'
        })
      }
    } catch (error) {
      log.error('[SmartConcat] Failed to analyze video files, defaulting to re-encoding:', error)
      log.warn('[SmartConcat] Decision: Re-encoding (Fallback Mode)')
      log.warn('[SmartConcat] Reason: Analysis failed, using safe fallback')
      // On analysis failure, default to re-encoding for safety
      useStreamCopy = false
      // CRITICAL: Initialize analysisResult to avoid undefined errors in Promise block
      analysisResult = {
        allMatch: false,
        requiresReencoding: true,
        specs: [],
        targetSpec: null,
        mismatches: []
      } as AnalysisResult
    }
      
    const firstVideoPathOriginal = validatedVideoPaths[0]
  // Handle single file case
if (validatedVideoPaths.length === 1) {
    const singleVideoPath = path.resolve(firstVideoPath)
    if (!fs.existsSync(singleVideoPath)) {
      throw new Error(`Video file not found: ${singleVideoPath}`)
    }

    const desiredPath = singleVideoPath.replace(path.extname(singleVideoPath), '_processed.mp4')
    const outPath = getSafeOutputPath(desiredPath)

    // Simple conversion (re-encode to standard format)
    return new Promise((resolve, reject) => {
      log.info('[FFmpeg] Starting video processing...')
      const command = ffmpeg(singleVideoPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',  // 🚀 OPTIMIZATION: ultrafast preset
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart'
        ])
        .on('progress', (p) => {
          const clampedProgress = Math.max(0, Math.min(Math.round(p.percent || 0), 99))
          sendProgress(clampedProgress)
        })
        .on('end', () => {
          sendProgress(100)
      log.info('[FFmpeg] Processing completed (100%)')
          currentFfmpegCommand = null
          resolve(outPath)
        })
        .on('error', (err) => {
          log.error('FFmpeg Error (Single Video):', err)
          currentFfmpegCommand = null
          reject(err)
        })
        
      currentFfmpegCommand = command
      command.save(outPath)
    })
}

  // Multiple files: use existing logic
const desiredPath = firstVideoPath.replace(path.extname(firstVideoPath), '_merged.mp4')
const outPath = getSafeOutputPath(desiredPath)

  // Get first video format info (to process all videos and black screen in the same format)
const firstVideoResolved = path.resolve(firstVideoPath)
if (!fs.existsSync(firstVideoResolved)) {
    throw new Error(`First video file not found: ${firstVideoResolved}`)
}
    
const firstVideoMetadata = await new Promise<FfmpegMetadata>((resolve, reject) => {
    ffmpeg.ffprobe(firstVideoResolved, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      resolve(metadata)
    })
})
    
const firstVideoStream = firstVideoMetadata.streams.find((s) => s.codec_type === 'video')
const firstAudioStream = firstVideoMetadata.streams.find((s) => s.codec_type === 'audio')
// Use video stream dimensions or fallback to defaults
const targetWidth = firstVideoStream?.width || (store.get('settings.video.width', DEFAULT_VIDEO_WIDTH) as number)
const targetHeight = firstVideoStream?.height || (store.get('settings.video.height', DEFAULT_VIDEO_HEIGHT) as number)
// SECURITY: Avoid eval() - use safer parsing
const targetFps = (() => {
  if (firstVideoStream?.r_frame_rate) {
    const [num, den] = firstVideoStream.r_frame_rate.split('/').map(Number)
    return den && num ? num / den : DEFAULT_VIDEO_FPS
  }
  return DEFAULT_VIDEO_FPS
})()
const targetAudioSampleRate = firstAudioStream?.sample_rate || 44100

  // If padding is enabled, create black screen (same format as first video)
let blackScreenPath: string | null = null
if (enablePadding) {
    blackScreenPath = path.resolve(tempDir, `black_screen_${paddingDuration}s.mp4`)
    tempFiles.push(blackScreenPath)
      
    // Create black screen for specified duration (same resolution, frame rate, audio sample rate as first video)
    // CRITICAL: Add silent audio track to match video format - required for concatenation
    await new Promise<void>((resolve, reject) => {
    ffmpeg()
        // Black video input
        .input(`color=c=black:s=${targetWidth}x${targetHeight}:r=${targetFps}`)
        .inputFormat('lavfi')
        // Silent audio input - CRITICAL: Must match targetAudioSampleRate
        .input(`anullsrc=channel_layout=stereo:sample_rate=${targetAudioSampleRate}`)
        .inputFormat('lavfi')
        .inputOptions(['-t', String(paddingDuration)])
        .outputOptions([
          '-c:v', 'libx264',                    // Video codec
          '-c:a', 'aac',                        // Audio codec
          '-b:a', '128k',                       // Audio bitrate
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',               // 🚀 OPTIMIZATION: ultrafast for black screen generation
          '-r', String(targetFps),              // Video frame rate
          '-ar', String(targetAudioSampleRate), // CRITICAL: Audio sample rate must match target
          '-ac', '2',                           // Stereo audio
          '-shortest',                          // Match duration of shortest input (both are same)
          '-movflags', '+faststart'
        ])
        .on('end', () => {
          log.info(`[Concat] ✅ Black screen created: ${path.basename(blackScreenPath!)} (${paddingDuration}s, ${targetAudioSampleRate}Hz audio)`)
          resolve()
        })
        .on('error', (err) => {
          log.error('FFmpeg Error (Black Screen):', err)
          reject(err)
        })
        .save(blackScreenPath!)
    })
}

  // If fade is enabled, process each video first
  // 💡 Memory efficiency: Process each video individually to load only one at a time in memory
  //    Uses temp files but minimizes memory usage through disk I/O
const processedVideoPaths: string[] = []
if (enableFadeOut || enableFadeIn) {
    const totalVideos = validatedVideoPaths.length
    // Each video processing step takes 80% of total progress (for more accurate progress display)
    const processProgressMax = 80
      
    for (let i = 0; i < validatedVideoPaths.length; i++) {
      const videoPath = path.resolve(validatedVideoPaths[i])
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`)
      }
        
      // Simplify temp filename: remove spaces and parentheses
      const safeFileName = `temp_segment_${i}.mp4`
      const processedPath = path.resolve(tempDir, safeFileName)
      tempFiles.push(processedPath)
        
      // Get each video's duration first
      const metadata = await new Promise<FfmpegMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            reject(err)
            return
          }
          resolve(metadata)
        })
      })
      const duration = metadata.format.duration || 0
        
      // Apply fade to each video (process all videos in the same format)
      await new Promise<void>((resolve, reject) => {
        const filters: string[] = []
        const audioFilters: string[] = []
          
        // Match resolution and frame rate to first video
        const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
        const currentWidth = videoStream?.width || targetWidth
        const currentHeight = videoStream?.height || targetHeight
        // SECURITY: Avoid eval() - use safer parsing
        const currentFps = (() => {
          if (videoStream?.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number)
            return den && num ? num / den : targetFps
          }
          return targetFps
        })()
          
        if (currentWidth !== targetWidth || currentHeight !== targetHeight) {
          filters.push(`scale=${targetWidth}:${targetHeight}`)
        }
        if (Math.abs(currentFps - targetFps) > 0.1) {
          filters.push(`fps=${targetFps}`)
        }
          
        if (enableFadeIn) {
          filters.push(`fade=t=in:st=0:d=${fadeOutDuration}`)
          audioFilters.push(`afade=t=in:ss=0:d=${fadeOutDuration}`)
        }
          
        if (enableFadeOut && duration > fadeOutDuration) {
          const fadeOutStart = duration - fadeOutDuration
          filters.push(`fade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`)
          audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`)
        }
          
        const command = ffmpeg(videoPath)
        log.info('[FFmpeg] Starting video processing...')
        if (filters.length > 0) {
          command.videoFilters(filters)
        }
        if (audioFilters.length > 0) {
          command.audioFilters(audioFilters)
        }
          
        command
          .outputOptions([
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'ultrafast',  // 🚀 OPTIMIZATION: ultrafast for fade processing
            '-pix_fmt', 'yuv420p',
            '-r', String(targetFps),
            '-ar', String(targetAudioSampleRate),
            '-movflags', '+faststart'
          ])
          .on('progress', (p) => {
            // Convert current video processing progress to total progress
            const videoProgress = p.percent || 0
            // Calculate progress range each video occupies
            const videoProgressRange = processProgressMax / totalVideos
            const baseProgress = (i / totalVideos) * processProgressMax
            const currentVideoProgress = (videoProgress / 100) * videoProgressRange
            const totalProgress = Math.floor(baseProgress + currentVideoProgress)
            sendProgress(Math.min(totalProgress, processProgressMax - 1))
          })
          .on('end', () => {
            // Current video processing complete
            // Wait for file creation: check if it actually exists on disk
            let retries = 0
            const maxRetries = 10
            const checkFile = () => {
              if (fs.existsSync(processedPath)) {
                const stats = fs.statSync(processedPath)
                if (stats.size > 0) {
                  log.info(`[FFmpeg] ✅ Processed video file created: ${processedPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
                  const videoEndProgress = Math.floor(((i + 1) / totalVideos) * processProgressMax)
                  sendProgress(Math.min(videoEndProgress, processProgressMax))
                  resolve()
                  return
                }
              }
              
              retries++
              if (retries < maxRetries) {
                log.info(`[FFmpeg] Waiting for file creation... (retry ${retries}/${maxRetries})`)
                setTimeout(checkFile, 200)
              } else {
                log.error(`[FFmpeg] File creation timeout: ${processedPath}`)
                reject(new Error(`Processed video file not found after ${maxRetries} retries: ${processedPath}`))
              }
            }
            checkFile()
          })
          .on('error', (err) => {
            log.error(`FFmpeg Error (Process Video ${i}):`, err)
            reject(err)
          })
          .save(processedPath)
      })
        
      processedVideoPaths.push(processedPath)
    }
      
    // All videos processed
    sendProgress(processProgressMax)
} else {
    // If no fade, use original paths (normalize to absolute paths)
    const basePaths = audioResampledPaths ?? validatedVideoPaths
    processedVideoPaths.push(...basePaths.map((p: string) => {
      const resolved = path.resolve(p)
      if (!fs.existsSync(resolved)) {
        throw new Error(`Video file not found: ${resolved}`)
      }
      return resolved
    }))
}

  // Normalize all paths to absolute paths and check file existence and access permissions
  const normalizedPaths: string[] = []
  for (const p of processedVideoPaths) {
    const normalizedPath = path.resolve(p)
    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`Video file not found: ${normalizedPath}`)
    }
    // CRITICAL: Check file read permission
    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK)
    } catch (err) {
      throw new Error(`Video file not readable: ${normalizedPath}`)
    }
    const stats = fs.statSync(normalizedPath)
    if (stats.size === 0) {
      throw new Error(`Video file is empty: ${normalizedPath}`)
    }
    normalizedPaths.push(normalizedPath)
    log.info(`[Concat] ✅ Verified input: ${path.basename(normalizedPath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
  }
    
  let blackScreenNormalized: string | null = null
  if (enablePadding && blackScreenPath) {
    blackScreenNormalized = path.resolve(blackScreenPath)
    if (!fs.existsSync(blackScreenNormalized)) {
      throw new Error(`Black screen file not found: ${blackScreenNormalized}`)
    }
    // CRITICAL: Check file read permission
    try {
      fs.accessSync(blackScreenNormalized, fs.constants.R_OK)
    } catch (err) {
      throw new Error(`Black screen file not readable: ${blackScreenNormalized}`)
    }
    const stats = fs.statSync(blackScreenNormalized)
    if (stats.size === 0) {
      throw new Error(`Black screen file is empty: ${blackScreenNormalized}`)
    }
    log.info(`[Concat] ✅ Verified black screen: ${path.basename(blackScreenNormalized)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
  }
    
  // CRITICAL: concat list file is only created in Fast Mode (useStreamCopy)
  // If hasEffects is true, use filter_complex mode, concat list not needed
  let concatListPath: string | null = null
  let totalConcatDuration = 0
  
  if (useStreamCopy) {
    // Fast Mode: create list file for concat demuxer
    concatListPath = path.resolve(tempDir, 'concat_list.txt')
    tempFiles.push(concatListPath)
    
    let concatList = ''
    const concatItems: Array<{ path: string; duration: number }> = []
    
    // Pre-calculate each video's duration (for progress estimation)
    for (let i = 0; i < normalizedPaths.length; i++) {
      const p = normalizedPaths[i]
      // FFmpeg concat demuxer path escaping: 'file ' + filePath.replace(/'/g, "'\\''") + ''
      // Convert Windows backslashes to slashes and escape single quotes
      const escapedPath = p.replace(/\\/g, '/').replace(/'/g, "'\\''")
        
      // Calculate video duration
      const metadata = await new Promise<FfmpegMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(p, (err, metadata) => {
          if (err) {
            reject(err)
            return
          }
          resolve(metadata)
        })
      })
      const duration = metadata.format.duration || 0
        
      concatItems.push({ path: escapedPath, duration })
      // CRITICAL: Must be written in 'file ' + escapedPath + '' format
      concatList += `file '${escapedPath}'\n`
        
      // If not last video and padding is enabled, add black screen
      if (enablePadding && i < normalizedPaths.length - 1 && blackScreenNormalized) {
        const escapedBlackScreen = blackScreenNormalized.replace(/\\/g, '/').replace(/'/g, "'\\''")
        concatItems.push({ path: escapedBlackScreen, duration: paddingDuration })
        // CRITICAL: Must be written in 'file ' + escapedPath + '' format
        concatList += `file '${escapedBlackScreen}'\n`
      }
    }
    
    fs.writeFileSync(concatListPath, concatList)
    
    // Calculate total concat duration (for progress estimation)
    totalConcatDuration = concatItems.reduce((sum, item) => sum + item.duration, 0)
    
    // Debug: check concat list file content
    log.info('[Concat] Concat list file content:')
    log.info(fs.readFileSync(concatListPath, 'utf-8'))
    log.info(`[Concat] Total concat duration: ${totalConcatDuration}s`)
  } else {
    // Slow Mode: calculate total duration for progress estimation
    for (const p of normalizedPaths) {
      const metadata = await new Promise<FfmpegMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(p, (err, metadata) => {
          if (err) {
            reject(err)
            return
          }
          resolve(metadata)
        })
      })
      totalConcatDuration += metadata.format.duration || 0
    }
    if (enablePadding && blackScreenNormalized) {
      totalConcatDuration += paddingDuration * Math.max(0, normalizedPaths.length - 1)
    }
  }

  // CRITICAL: Await the Promise to ensure FFmpeg completes before finally block executes
  const result = await new Promise<string>((resolve, reject) => {
    const command = ffmpeg()

    // SMART CONCAT: Choose encoding mode based on analysis
    if (useStreamCopy) {
      // Fast mode: Stream copy (all files match, no effects)
      // Use concat demuxer for fast concatenation (concat list file required)
      if (!concatListPath) {
        reject(new Error('Concat list path is required for Fast Mode'))
        return
      }
      
      command
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])  // ⚡ NO RE-ENCODING! Just copy streams!
      log.info('[SmartConcat] ⚡⚡⚡ Using FAST MODE: Stream copy (-c copy) - No re-encoding!')
      log.info('[SmartConcat] Expected time: 1-5 seconds!')
    } else if (hasEffects) {
      // Slow mode with effects: filter_complex required (fade/padding effects)
      // CRITICAL: All segment files (processed videos + black screen padding) must be added as inputs
      const targetSpec = analysisResult?.targetSpec
      
      if (!targetSpec) {
        reject(new Error('Target spec is required for filter_complex mode'))
        return
      }
      
      // Build list of all input files in order (videos + padding between them)
      // CRITICAL: Use path.resolve() to ensure all paths are absolute, but DO NOT add quotes manually
      const allInputFiles: string[] = []
      const inputTypeMap: Array<'video' | 'padding'> = []
      
      for (let i = 0; i < normalizedPaths.length; i++) {
        // normalizedPaths already contains absolute paths from path.resolve()
        allInputFiles.push(normalizedPaths[i])
        inputTypeMap.push('video')
        
        // Add padding between videos (except after last video)
        if (enablePadding && i < normalizedPaths.length - 1 && blackScreenNormalized) {
          // blackScreenNormalized already contains absolute path from path.resolve()
          allInputFiles.push(blackScreenNormalized)
          inputTypeMap.push('padding')
        }
      }
      
      // CRITICAL: Explicitly add all input files using .input() method
      // fluent-ffmpeg will handle path escaping internally - DO NOT add quotes manually
      log.info(`[SmartConcat] Adding ${allInputFiles.length} input file(s) for filter_complex mode...`)
      for (let i = 0; i < allInputFiles.length; i++) {
        const inputFile = allInputFiles[i]
        // CRITICAL: Ensure absolute path, but let fluent-ffmpeg handle escaping
        const absolutePath = path.resolve(inputFile)
        
        // Verify file exists and is readable before adding as input
        if (!fs.existsSync(absolutePath)) {
          reject(new Error(`Input file not found: ${absolutePath}`))
          return
        }
        try {
          fs.accessSync(absolutePath, fs.constants.R_OK)
        } catch (err) {
          reject(new Error(`Input file not readable: ${absolutePath}`))
          return
        }
        
        // Add input - fluent-ffmpeg handles path escaping automatically
        command.input(absolutePath)
        log.info(`[SmartConcat]   Input[${i}]: ${path.basename(absolutePath)} (${absolutePath})`)
      }
      
      const totalInputs = allInputFiles.length
      log.info(`[SmartConcat] Total inputs added: ${totalInputs}`)
      
      // Build filter_complex using input indices [0:v][0:a][1:v][1:a] etc.
      // CRITICAL: Use input indices, NOT file paths in filter_complex string
      const scaleFilters: string[] = []
      const audioFilters: string[] = []
      const processedVideoLabels: string[] = []
      const processedAudioLabels: string[] = []
      
      for (let inputIndex = 0; inputIndex < totalInputs; inputIndex++) {
        const inputType = inputTypeMap[inputIndex]
        const isVideo = inputType === 'video'
        
        // Label for processed video/audio streams
        const videoLabel = `v${inputIndex}`
        const audioLabel = `a${inputIndex}`
        processedVideoLabels.push(`[${videoLabel}]`)
        processedAudioLabels.push(`[${audioLabel}]`)
        
        if (isVideo) {
          // Find corresponding spec (only for original video inputs)
          const videoIndex = normalizedPaths.indexOf(allInputFiles[inputIndex])
          const spec = videoIndex >= 0 && videoIndex < analysisResult.specs.length 
            ? analysisResult.specs[videoIndex] 
            : null
          
          if (spec) {
            // Scale video if resolution differs
            if (spec.width !== targetSpec.width || spec.height !== targetSpec.height) {
              // Use input index [inputIndex:v] to reference the input
              scaleFilters.push(`[${inputIndex}:v]scale=${targetSpec.width}:${targetSpec.height}[${videoLabel}]`)
            } else {
              scaleFilters.push(`[${inputIndex}:v]copy[${videoLabel}]`)
            }
            
            // Resample audio if sample rate differs
            if (Math.abs(spec.audioSampleRate - targetSpec.audioSampleRate) > 100) {
              // Use input index [inputIndex:a] to reference the input
              audioFilters.push(`[${inputIndex}:a]aresample=${targetSpec.audioSampleRate}[${audioLabel}]`)
            } else {
              audioFilters.push(`[${inputIndex}:a]acopy[${audioLabel}]`)
            }
          } else {
            // Fallback: copy streams if spec not found
            scaleFilters.push(`[${inputIndex}:v]copy[${videoLabel}]`)
            audioFilters.push(`[${inputIndex}:a]acopy[${audioLabel}]`)
          }
        } else {
          // Padding segment: scale and process to match target spec
          // Use input index [inputIndex:v] and [inputIndex:a]
          scaleFilters.push(`[${inputIndex}:v]scale=${targetSpec.width}:${targetSpec.height}[${videoLabel}]`)
          audioFilters.push(`[${inputIndex}:a]aresample=${targetSpec.audioSampleRate}[${audioLabel}]`)
        }
      }
      
      // Build concat filter using processed stream labels
      // Format: [v0][v1][v2]concat=n=3:v=1:a=0[outv]
      const videoConcatInputs = processedVideoLabels.join('')
      const audioConcatInputs = processedAudioLabels.join('')
      
      const filterComplex = [
        ...scaleFilters,
        ...audioFilters,
        `${videoConcatInputs}concat=n=${totalInputs}:v=1:a=0[outv]`,
        `${audioConcatInputs}concat=n=${totalInputs}:v=0:a=1[outa]`
      ].join(';')
      
      log.info(`[SmartConcat] Filter complex (${totalInputs} inputs):`)
      log.info(`[SmartConcat]   Video filters: ${scaleFilters.length}`)
      log.info(`[SmartConcat]   Audio filters: ${audioFilters.length}`)
      log.info(`[SmartConcat]   Concat: ${totalInputs} segments`)
      
      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          '-r', String(Math.round(targetSpec.frameRate)),
          '-ar', String(targetSpec.audioSampleRate),
          '-movflags', '+faststart'
        ])
      
      log.info(`[SmartConcat] ✅ filter_complex mode configured: ${totalInputs} segments, scaling to ${targetSpec.width}x${targetSpec.height}, ${targetSpec.audioSampleRate}Hz`)
    } else {
      // Slow mode without effects: concat demuxer with re-encoding (no filter_complex needed)
      // Create concat list for re-encoding mode
      if (!concatListPath) {
        concatListPath = path.resolve(tempDir, 'concat_list_reencode.txt')
        tempFiles.push(concatListPath)
        
        let concatList = ''
        for (const p of normalizedPaths) {
          const escapedPath = p.replace(/\\/g, '/').replace(/'/g, "'\\''")
          concatList += `file '${escapedPath}'\n`
          
          // Add padding if enabled
          if (enablePadding && blackScreenNormalized && normalizedPaths.indexOf(p) < normalizedPaths.length - 1) {
            const escapedBlackScreen = blackScreenNormalized.replace(/\\/g, '/').replace(/'/g, "'\\''")
            concatList += `file '${escapedBlackScreen}'\n`
          }
        }
        
        fs.writeFileSync(concatListPath, concatList, 'utf-8')
        log.info('[SmartConcat] Created concat list for re-encoding mode')
      }
      
      const targetSpec = analysisResult?.targetSpec
      command
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          ...(targetSpec ? [
            '-r', String(Math.round(targetSpec.frameRate)),
            '-ar', String(targetSpec.audioSampleRate)
          ] : []),
          '-movflags', '+faststart'
        ])
      log.info('[SmartConcat] Using concat demuxer with re-encoding (no effects, compatibility mode)')
    }

    command
      .on('progress', (p) => {
        let clampedProgress: number
        if (enableFadeOut || enableFadeIn) {
          // If fade is applied: concat step is from 80% to 100%
          const concatProgress = p.percent || 0
            
          // Time-based progress estimation (more accurate progress display)
          if (p.timemark) {
            const timeMatch = p.timemark.match(/(\d+):(\d+):(\d+\.\d+)/)
            if (timeMatch) {
              const hours = parseInt(timeMatch[1])
              const minutes = parseInt(timeMatch[2])
              const seconds = parseFloat(timeMatch[3])
              const currentTime = hours * 3600 + minutes * 60 + seconds
                
              // Calculate progress based on time
              const timeBasedProgress = Math.min((currentTime / totalConcatDuration) * 100, 100)
              clampedProgress = Math.max(80, Math.min(80 + Math.floor((timeBasedProgress / 100) * 20), 99))
            } else {
              // If time parsing fails, use existing method
              clampedProgress = Math.max(80, Math.min(80 + Math.floor((concatProgress / 100) * 20), 99))
            }
          } else {
            // If no timemark, use existing method
            clampedProgress = Math.max(80, Math.min(80 + Math.floor((concatProgress / 100) * 20), 99))
          }
        } else {
          // If no fade: concat step is the total progress
          clampedProgress = Math.max(0, Math.min(Math.round(p.percent || 0), 99))
        }
        sendProgress(clampedProgress)
      })
      .on('end', async () => {
        // Delete temp files
        cleanupTempFiles(tempFiles)
          
        currentFfmpegCommand = null
        
        // 🖼️ Add thumbnail from first video frame
        try {
          log.info('[Thumbnail] Adding thumbnail to concatenated video...')
          const thumbnailPath = path.join(tempDir, `thumbnail_${Date.now()}.jpg`)
          const tempOutputWithThumbnail = path.join(tempDir, `temp_with_thumbnail_${Date.now()}.mp4`)
          
          // Extract first frame from first video
          await extractFirstFrameAsThumbnail(firstVideoPathOriginal, thumbnailPath)
          
          // Add thumbnail to the concatenated video
          await new Promise<void>((thumbResolve, thumbReject) => {
            ffmpeg()
              .input(outPath)
              .input(thumbnailPath)
              .outputOptions([
                '-map', '0',              // Map all streams from first input (video)
                '-map', '1',              // Map thumbnail image
                '-c', 'copy',             // Copy all streams (no re-encoding!)
                '-disposition:v:1', 'attached_pic'  // Set second video stream as thumbnail
              ])
              .output(tempOutputWithThumbnail)
              .on('end', () => {
                log.info('[Thumbnail] ✅ Thumbnail attached successfully')
                
                // Replace original output with thumbnail version
                try {
                  if (fs.existsSync(outPath)) {
                    safeRmSync(outPath)
                  }
                  fs.renameSync(tempOutputWithThumbnail, outPath)
                  
                  // Cleanup thumbnail file
                  if (fs.existsSync(thumbnailPath)) {
                    safeRmSync(thumbnailPath)
                  }
                } catch (err) {
                  log.error('[Thumbnail] Failed to replace output file:', err)
                  thumbReject(err)
                  return
                }
                
                thumbResolve()
              })
              .on('error', (err) => {
                log.error('[Thumbnail] ❌ Failed to attach thumbnail:', err)
                // Cleanup on error
                if (fs.existsSync(thumbnailPath)) {
                  try {
                    safeRmSync(thumbnailPath)
                  } catch (e) {
                    log.error('[Thumbnail] Failed to delete thumbnail file:', e)
                  }
                }
                if (fs.existsSync(tempOutputWithThumbnail)) {
                  try {
                    safeRmSync(tempOutputWithThumbnail)
                  } catch (e) {
                    log.error('[Thumbnail] Failed to delete temp file:', e)
                  }
                }
                thumbReject(err)
                // Don't reject - continue with video without thumbnail
                thumbResolve()
              })
              .run()
          })
        } catch (err) {
          log.error('[Thumbnail] Failed to add thumbnail (non-fatal):', err)
          // Continue anyway - thumbnail is optional
        }
        
        sendProgress(100) // 100% on completion
        resolve(outPath)
      })
      .on('error', (err) => {
        // Delete temp files even on error
        cleanupTempFiles(tempFiles, 'Concat videos error')
        log.error('FFmpeg Error (Concat Videos):', err)
        currentFfmpegCommand = null
        reject(err)
      })

    currentFfmpegCommand = command
    command.save(outPath)
  })
  
  // CRITICAL: Return result after Promise completes
  // This ensures finally block only runs after FFmpeg finishes
  return result
  } catch (error) {
    log.error('Video concat error:', error)
    throw error
  } finally {
    // Always cleanup OS temp workdir (best-effort). Important for Windows locks/AV.
    // CRITICAL: This only runs after Promise completes (end or error event)
    if (workDir) {
      await safeRm(workDir, { recursive: true })
    }
  }
})

// Register custom protocol for local file access
function registerLocalFileProtocol() {
  protocol.registerFileProtocol('loopmate', (request, callback) => {
    const rawUrl = request.url.replace('loopmate://', '')
    const filePath = decodeURIComponent(rawUrl)
    
    log.info('Protocol request:', { rawUrl, filePath })
    
    try {
      const normalizedPath = path.resolve(filePath)
      log.info('Normalized path:', normalizedPath)
      
      // Security: validate that file exists and is accessible
      if (fs.existsSync(normalizedPath)) {
        log.info('File exists, serving:', normalizedPath)
        callback({ path: normalizedPath })
      } else {
        log.warn('File not found:', normalizedPath)
        callback({ error: -6 }) // FILE_NOT_FOUND
      }
    } catch (error) {
      log.error('Protocol handler error:', { error, filePath })
      callback({ error: -2 }) // FAILED
    }
  })
}

// Register custom protocol scheme before app is ready
if (protocol.registerSchemesAsPrivileged) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'loopmate',
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: false
      }
    }
  ])
}

app.whenReady().then(() => {
  registerLocalFileProtocol()
  
  createSplashWindow()
  createWindow()
  setupAutoUpdater()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Global Error Handlers
// Catch uncaught exceptions in main process
process.on('uncaughtException', (error: Error) => {
  log.error('[UncaughtException]', error)
  log.error('[UncaughtException] Stack:', error.stack)
  // Show error to user if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:error', {
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack,
      errorId: generateErrorId()
    })
  }
  // Don't exit immediately - let the app handle it gracefully
  // In production, you might want to show a dialog and quit
})
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason)
  const errorStack = reason instanceof Error ? reason.stack : undefined
  log.error('[UnhandledRejection]', errorMessage)
  if (errorStack) {
    log.error('[UnhandledRejection] Stack:', errorStack)
  }
  log.error('[UnhandledRejection] Promise:', promise)
  // Show error to user if window exists
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:error', {
      type: 'unhandledRejection',
      message: errorMessage,
      stack: errorStack,
      errorId: generateErrorId()
    })
  }
})