/**
 * Error Code Utilities for Renderer Process
 * 
 * This file mirrors the error code parsing functions for use in the renderer process.
 */

/**
 * Parse error code from serialized error message
 * Returns {code, message} or null if no code found
 */
export function parseErrorFromIPC(errorMessage: string): { code: number | null; message: string } {
  const match = errorMessage.match(/^\[ERROR_CODE:(\d+)\]\s*(.*)$/)
  if (match) {
    return {
      code: parseInt(match[1], 10),
      message: match[2]
    }
  }
  return {
    code: null,
    message: errorMessage
  }
}


