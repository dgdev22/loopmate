import log from 'electron-log'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { safeRmSync } from './fsSafe.js'

/**
 * Logger utility for Electron application
 * 
 * Features:
 * - File logging with rotation (keeps last 5 log files)
 * - Console override (console.log -> log.info)
 * - Global error catching
 * - Renderer process logging support via IPC
 */

// Configure log file location (User Data directory)
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined

// Standardize log location to OS defaults:
// - Windows: %APPDATA%/<AppName>/logs
// - macOS:   ~/Library/Logs/<AppName>
const logsDir = app.getPath('logs')
try {
  fs.mkdirSync(logsDir, { recursive: true })
} catch {
  // Ignore
}
log.transports.file.resolvePathFn = () => path.join(logsDir, 'main.log')

// Configure log file settings
log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB per file

// Log rotation: Keep only the last 5 log files
log.transports.file.archiveLogFn = (logFile: string) => {
  const logDir = path.dirname(logFile)
  const logBaseName = path.basename(logFile, '.log')
  
  try {
    // Get all log files in the directory
    const files = fs.readdirSync(logDir)
    const logFiles = files
      .filter(file => file.startsWith(logBaseName) && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logDir, file),
        mtime: fs.statSync(path.join(logDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime) // Sort by modification time (newest first)
    
    // Keep only the last 5 files, delete older ones
    if (logFiles.length >= 5) {
      const filesToDelete = logFiles.slice(4) // Keep first 4 (newest), delete the rest
      filesToDelete.forEach(file => {
        try {
          safeRmSync(file.path)
          log.info(`[Logger] Deleted old log file: ${file.name}`)
        } catch (err) {
          log.warn(`[Logger] Failed to delete old log file ${file.name}:`, err)
        }
      })
    }
    
    // Generate archive name with timestamp
    const timestamp = Date.now()
    return logFile.replace('.log', `.${timestamp}.log`)
  } catch (error) {
    log.error('[Logger] Failed to manage log rotation:', error)
    // Fallback: just add timestamp
    return logFile.replace('.log', `.${Date.now()}.log`)
  }
}

// Log format: [{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.level = isDev ? 'debug' : 'info'

// Privacy: in production, redact absolute paths from file logs to avoid persisting OS account names.
// Console logs remain unchanged for local dev troubleshooting.
log.hooks.push((message, _transport, transportName) => {
  if (isDev) return message
  if (transportName !== 'file') return message

  const redact = (input: unknown) => {
    if (typeof input !== 'string') return input
    // Replace absolute paths with a stable token.
    // (Keep the original error detail; users can share logs safely.)
    return input
      .replace(/\/[^\s'"]+/g, '[path]')
      .replace(/[A-Z]:\\[^\s'"]+/g, '[path]')
  }

  return {
    ...message,
    data: message.data.map(redact)
  }
})

// Get log file path for IPC access
const logFilePath = log.transports.file.getFile().path
const logFileDir = path.dirname(logFilePath)

/**
 * Override console methods to use electron-log
 * This allows existing console.log statements to automatically use the logger
 */
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
}

// Override console methods
console.log = (...args: unknown[]) => {
  log.info(...args)
  if (isDev) {
    originalConsole.log(...args) // Also show in dev console
  }
}

console.error = (...args: unknown[]) => {
  log.error(...args)
  if (isDev) {
    originalConsole.error(...args)
  }
}

console.warn = (...args: unknown[]) => {
  log.warn(...args)
  if (isDev) {
    originalConsole.warn(...args)
  }
}

console.info = (...args: unknown[]) => {
  log.info(...args)
  if (isDev) {
    originalConsole.info(...args)
  }
}

console.debug = (...args: unknown[]) => {
  log.debug(...args)
  if (isDev) {
    originalConsole.debug(...args)
  }
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers() {
  // Generate unique error ID for user reference with platform info
  function generateErrorId(): string {
    const platform = process.platform === 'darwin' ? 'MAC' : 
                     process.platform === 'win32' ? 'WIN' : 
                     process.platform === 'linux' ? 'LINUX' : 'UNK'
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `ERR_${platform}_${timestamp}_${random}`
  }

  // Catch uncaught exceptions in main process
  process.on('uncaughtException', (error: Error) => {
    const errorId = generateErrorId()
    log.error(`[CRITICAL CRASH] [${errorId}] Uncaught Exception:`, error)
    log.error(`[CRITICAL CRASH] [${errorId}] Stack:`, error.stack)
    
    // Show error to user if window exists (will be set up in main.ts)
    // Note: win is not available here, so we'll handle this in main.ts
    
    // Don't exit immediately - let the app handle it gracefully
  })

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const errorId = generateErrorId()
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    const errorStack = reason instanceof Error ? reason.stack : undefined
    
    log.error(`[CRITICAL CRASH] [${errorId}] Unhandled Rejection:`, errorMessage)
    if (errorStack) {
      log.error(`[CRITICAL CRASH] [${errorId}] Stack:`, errorStack)
    }
    log.error(`[CRITICAL CRASH] [${errorId}] Promise:`, promise)
  })
}

/**
 * Initialize logger
 * Call this at the start of main process
 * @param sendErrorToRenderer Optional function to send errors to renderer process
 */
export function initializeLogger(sendErrorToRenderer?: (error: {
  type: string
  message: string
  stack?: string
  errorId: string
}) => void) {
  log.info('='.repeat(60))
  log.info('[Logger] Initializing electron-log')
  log.info(`[Logger] Log file location: ${logFilePath}`)
  log.info(`[Logger] Log directory: ${logFileDir}`)
  log.info(`[Logger] Environment: ${isDev ? 'Development' : 'Production'}`)
  log.info(`[Logger] App version: ${app.getVersion()}`)
  log.info('='.repeat(60))
  
  // Setup global error handlers
  setupGlobalErrorHandlers(sendErrorToRenderer)
  
  return {
    log,
    logFilePath,
    logFileDir
  }
}

// Export log instance and paths
export { log, logFilePath, logFileDir }

