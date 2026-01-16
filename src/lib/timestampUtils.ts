/**
 * Utility functions for YouTube timestamp generation
 */

/**
 * Format seconds to YouTube timestamp format (MM:SS or HH:MM:SS)
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Remove file extension from filename
 */
export function removeExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '')
}

/**
 * Calculate YouTube timestamps for a list of video files
 * @param videoFiles Array of video file paths
 * @param getDuration Function to get video duration (async)
 * @param options Optional padding settings
 * @returns Promise<string> Formatted timestamp text
 */
export async function calculateTimestamps(
  videoFiles: string[],
  getDuration: (path: string) => Promise<number>,
  options?: {
    enablePadding?: boolean
    paddingDuration?: number
  }
): Promise<string> {
  if (videoFiles.length < 2) {
    return ''
  }

  const { enablePadding = false, paddingDuration = 0 } = options || {}
  const timestamps: string[] = []
  let cumulativeTime = 0

  for (let i = 0; i < videoFiles.length; i++) {
    const filePath = videoFiles[i]
    const isLastFile = i === videoFiles.length - 1

    try {
      const duration = await getDuration(filePath)
      const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
      const fileNameWithoutExt = removeExtension(fileName)
      const timeString = formatTimestamp(cumulativeTime)

      timestamps.push(`${timeString} - ${fileNameWithoutExt}`)
      
      // Add duration + padding (except for the last file)
      cumulativeTime += duration
      if (enablePadding && !isLastFile) {
        cumulativeTime += paddingDuration
      }
    } catch (error) {
      console.error(`Failed to get duration for ${filePath}:`, error)
      // Continue with 0 duration if failed
      const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
      const fileNameWithoutExt = removeExtension(fileName)
      const timeString = formatTimestamp(cumulativeTime)
      timestamps.push(`${timeString} - ${fileNameWithoutExt}`)
      // Still add padding if enabled (except for last file)
      if (enablePadding && !isLastFile) {
        cumulativeTime += paddingDuration
      }
    }
  }

  return timestamps.join('\n')
}

