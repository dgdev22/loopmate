/**
 * Security utility functions for input validation and sanitization
 * 
 * This module provides security functions to prevent common vulnerabilities:
 * - Path Traversal attacks
 * - URL injection attacks
 * - Invalid file path handling
 */

import path from 'node:path'

/**
 * Default allowed file extensions for different file types
 * These are used as fallback when settings are not available
 */
const DEFAULT_VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv'])
const DEFAULT_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus', '.aiff', '.aif', '.alac'])
const DEFAULT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'])

/**
 * Get allowed extensions from a Set or array, with fallback to defaults
 */
function getExtensionSet(extensions?: Set<string> | string[]): Set<string> {
  if (!extensions) {
    return new Set()
  }
  if (Array.isArray(extensions)) {
    return new Set(extensions.map(ext => ext.toLowerCase()))
  }
  return extensions
}

/**
 * Validates and normalizes a file path to prevent Path Traversal attacks
 * 
 * @param filePath - The file path to validate
 * @param allowedExtensions - Set of allowed file extensions (optional)
 * @returns Normalized absolute path if valid, throws error if invalid
 * 
 * @throws {Error} If path contains traversal sequences or invalid characters
 */
export function validateFilePath(filePath: string, allowedExtensions?: Set<string>): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string')
  }

  // Normalize the path to resolve any relative components
  const normalizedPath = path.resolve(filePath)

  // Check for path traversal attempts
  // After path.resolve(), if the path contains '..', it would be resolved
  // But we check the original path for suspicious patterns
  if (filePath.includes('..') || filePath.includes('~')) {
    throw new Error('Invalid file path: path traversal detected')
  }

  // Check for null bytes (potential injection)
  if (filePath.includes('\0')) {
    throw new Error('Invalid file path: null byte detected')
  }

  // Validate file extension if provided
  if (allowedExtensions) {
    const ext = path.extname(normalizedPath).toLowerCase()
    if (!allowedExtensions.has(ext)) {
      throw new Error(`Invalid file extension: ${ext} is not allowed`)
    }
  }

  // Verify file exists (optional check, can be removed if not needed)
  // if (!fs.existsSync(normalizedPath)) {
  //   throw new Error('File does not exist')
  // }

  return normalizedPath
}

/**
 * Validates a video file path
 * @param filePath - The file path to validate
 * @param allowedExtensions - Optional set of allowed extensions (defaults to DEFAULT_VIDEO_EXTENSIONS)
 */
export function validateVideoFilePath(filePath: string, allowedExtensions?: Set<string> | string[]): string {
  const extensions = allowedExtensions ? getExtensionSet(allowedExtensions) : DEFAULT_VIDEO_EXTENSIONS
  return validateFilePath(filePath, extensions)
}

/**
 * Validates an audio file path
 * @param filePath - The file path to validate
 * @param allowedExtensions - Optional set of allowed extensions (defaults to DEFAULT_AUDIO_EXTENSIONS)
 */
export function validateAudioFilePath(filePath: string, allowedExtensions?: Set<string> | string[]): string {
  const extensions = allowedExtensions ? getExtensionSet(allowedExtensions) : DEFAULT_AUDIO_EXTENSIONS
  return validateFilePath(filePath, extensions)
}

/**
 * Validates an image file path
 * @param filePath - The file path to validate
 * @param allowedExtensions - Optional set of allowed extensions (defaults to DEFAULT_IMAGE_EXTENSIONS)
 */
export function validateImageFilePath(filePath: string, allowedExtensions?: Set<string> | string[]): string {
  const extensions = allowedExtensions ? getExtensionSet(allowedExtensions) : DEFAULT_IMAGE_EXTENSIONS
  return validateFilePath(filePath, extensions)
}

/**
 * Validates an array of file paths
 */
export function validateFilePaths(filePaths: string[], allowedExtensions?: Set<string>): string[] {
  if (!Array.isArray(filePaths)) {
    throw new Error('Invalid input: filePaths must be an array')
  }

  if (filePaths.length === 0) {
    throw new Error('Invalid input: at least one file path is required')
  }

  // Limit maximum number of files to prevent DoS
  const MAX_FILES = 100
  if (filePaths.length > MAX_FILES) {
    throw new Error(`Too many files: maximum ${MAX_FILES} files allowed`)
  }

  return filePaths.map(filePath => validateFilePath(filePath, allowedExtensions))
}

/**
 * Validates a URL to prevent malicious URL execution
 * 
 * @param url - The URL to validate
 * @returns true if URL is safe, throws error if unsafe
 * 
 * @throws {Error} If URL is invalid or uses dangerous protocols
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string')
  }

  // Check for null bytes
  if (url.includes('\0')) {
    throw new Error('Invalid URL: null byte detected')
  }

  // Parse URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch (error) {
    throw new Error('Invalid URL: malformed URL format')
  }

  // Only allow http, https, and mailto protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:']
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new Error(`Invalid URL protocol: ${parsedUrl.protocol} is not allowed. Only http, https, and mailto are permitted.`)
  }

  // Additional check: prevent javascript: and data: URLs
  const lowerUrl = url.toLowerCase().trim()
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('data:') || 
      lowerUrl.startsWith('vbscript:') ||
      lowerUrl.startsWith('file:')) {
    throw new Error('Invalid URL: dangerous protocol detected')
  }

  return true
}

/**
 * Sanitizes error messages to prevent information disclosure
 * 
 * @param error - The error object or message
 * @param userMessage - Optional user-friendly message
 * @returns Sanitized error message safe for user display
 */
export function sanitizeErrorMessage(error: unknown, userMessage?: string): string {
  if (userMessage) {
    return userMessage
  }

  if (error instanceof Error) {
    // Remove file system paths from error messages
    let message = error.message
    
    // Remove absolute paths (common patterns)
    message = message.replace(/\/[^\s]+/g, '[path]')
    message = message.replace(/[A-Z]:\\[^\s]+/g, '[path]')
    
    // Remove stack traces in production
    if (process.env.NODE_ENV === 'production') {
      return message.split('\n')[0] // Only return first line
    }
    
    return message
  }

  return 'An error occurred'
}

/**
 * Validates numeric input to prevent DoS attacks
 */
export function validateNumericInput(value: unknown, min: number, max: number, fieldName: string): number {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new Error(`Invalid ${fieldName}: must be a valid number`)
  }

  if (value < min || value > max) {
    throw new Error(`Invalid ${fieldName}: must be between ${min} and ${max}`)
  }

  return value
}

/**
 * Validates string input length to prevent DoS attacks
 */
export function validateStringLength(value: string, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be a string`)
  }

  if (value.length > maxLength) {
    throw new Error(`Invalid ${fieldName}: exceeds maximum length of ${maxLength} characters`)
  }

  return value
}

