import { describe, it, expect } from '@jest/globals'
import { formatTimestamp, removeExtension, calculateTimestamps } from '@/lib/timestampUtils'

describe('timestampUtils', () => {
  describe('formatTimestamp', () => {
    it('should format seconds to MM:SS format for durations under 1 hour', () => {
      expect(formatTimestamp(0)).toBe('00:00')
      expect(formatTimestamp(30)).toBe('00:30')
      expect(formatTimestamp(60)).toBe('01:00')
      expect(formatTimestamp(90)).toBe('01:30')
      expect(formatTimestamp(3599)).toBe('59:59')
    })

    it('should format seconds to HH:MM:SS format for durations over 1 hour', () => {
      expect(formatTimestamp(3600)).toBe('01:00:00')
      expect(formatTimestamp(3661)).toBe('01:01:01')
      expect(formatTimestamp(7323)).toBe('02:02:03')
      expect(formatTimestamp(90000)).toBe('25:00:00')
    })

    it('should handle decimal seconds by flooring', () => {
      expect(formatTimestamp(30.7)).toBe('00:30')
      expect(formatTimestamp(60.9)).toBe('01:00')
    })
  })

  describe('removeExtension', () => {
    it('should remove file extension from filename', () => {
      expect(removeExtension('video.mp4')).toBe('video')
      expect(removeExtension('my-video.mov')).toBe('my-video')
      expect(removeExtension('file.name.avi')).toBe('file.name')
    })

    it('should handle filenames without extension', () => {
      expect(removeExtension('video')).toBe('video')
      expect(removeExtension('my-file')).toBe('my-file')
    })

    it('should handle filenames with path', () => {
      expect(removeExtension('/path/to/video.mp4')).toBe('/path/to/video')
      expect(removeExtension('C:\\path\\to\\video.mp4')).toBe('C:\\path\\to\\video')
    })
  })

  describe('calculateTimestamps', () => {
    it('should return empty string for less than 2 files', async () => {
      const getDuration = jest.fn()
      expect(await calculateTimestamps([], getDuration)).toBe('')
      expect(await calculateTimestamps(['video1.mp4'], getDuration)).toBe('')
      expect(getDuration).not.toHaveBeenCalled()
    })

    it('should calculate timestamps for multiple videos', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(180) // 3 minutes for video1
        .mockResolvedValueOnce(120) // 2 minutes for video2
        .mockResolvedValueOnce(60)  // 1 minute for video3

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4', 'video3.mp4'],
        getDuration
      )

      expect(result).toBe('00:00 - video1\n03:00 - video2\n05:00 - video3')
      expect(getDuration).toHaveBeenCalledTimes(3)
    })

    it('should handle videos over 1 hour', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(3600) // 1 hour
        .mockResolvedValueOnce(1800)  // 30 minutes

      const result = await calculateTimestamps(
        ['long-video.mp4', 'short-video.mp4'],
        getDuration
      )

      // First video starts at 00:00 (MM:SS format for < 1 hour), second starts after 1 hour (HH:MM:SS)
      expect(result).toContain('00:00 - long-video')
      expect(result).toContain('01:00:00 - short-video')
    })

    it('should remove file extensions from filenames', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(60)

      const result = await calculateTimestamps(
        ['/path/to/video1.mp4', '/path/to/video2.mov'],
        getDuration
      )

      expect(result).toContain('video1')
      expect(result).toContain('video2')
      expect(result).not.toContain('.mp4')
      expect(result).not.toContain('.mov')
    })

    it('should handle duration fetch errors gracefully', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(60)
        .mockRejectedValueOnce(new Error('Failed to get duration'))
        .mockResolvedValueOnce(60)

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4', 'video3.mp4'],
        getDuration
      )

      // Should continue processing even if one fails
      expect(result).toContain('video1')
      expect(result).toContain('video2')
      expect(result).toContain('video3')
      // video2 should have timestamp based on video1's duration
      expect(result).toMatch(/01:00 - video2/)
    })

    it('should handle files with different path separators', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(60)

      const result = await calculateTimestamps(
        ['C:\\Windows\\video1.mp4', '/unix/path/video2.mp4'],
        getDuration
      )

      expect(result).toContain('video1')
      expect(result).toContain('video2')
    })

    it('should handle cumulative time correctly', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(30)   // 0.5 min
        .mockResolvedValueOnce(60)   // 1 min
        .mockResolvedValueOnce(90)   // 1.5 min

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4', 'video3.mp4'],
        getDuration
      )

      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('00:30 - video2')
      expect(lines[2]).toBe('01:30 - video3')
    })

    it('should calculate timestamps with padding between videos', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(10)   // 10 seconds
        .mockResolvedValueOnce(15)   // 15 seconds
        .mockResolvedValueOnce(20)   // 20 seconds

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4', 'video3.mp4'],
        getDuration,
        {
          enablePadding: true,
          paddingDuration: 3
        }
      )

      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('00:13 - video2') // 10s + 3s padding
      expect(lines[2]).toBe('00:31 - video3') // 10s + 3s + 15s + 3s
    })

    it('should not add padding after the last video', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(60)   // 1 minute
        .mockResolvedValueOnce(60)   // 1 minute

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4'],
        getDuration,
        {
          enablePadding: true,
          paddingDuration: 5
        }
      )

      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('01:05 - video2') // 60s + 5s padding
      // Total duration should be 60 + 5 + 60 = 125s, not 130s (no padding after last)
    })

    it('should handle padding with duration errors', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(10)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(20)

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4', 'video3.mp4'],
        getDuration,
        {
          enablePadding: true,
          paddingDuration: 3
        }
      )

      // Should still add padding even if duration fetch fails
      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('00:13 - video2') // 10s + 3s padding
      expect(lines[2]).toBe('00:16 - video3') // 10s + 3s + 0s + 3s (0s for failed duration)
    })

    it('should work without padding options (backward compatibility)', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(60)

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4'],
        getDuration
      )

      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('00:30 - video2')
    })

    it('should ignore padding when enablePadding is false', async () => {
      const getDuration = jest.fn()
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(60)

      const result = await calculateTimestamps(
        ['video1.mp4', 'video2.mp4'],
        getDuration,
        {
          enablePadding: false,
          paddingDuration: 10
        }
      )

      const lines = result.split('\n')
      expect(lines[0]).toBe('00:00 - video1')
      expect(lines[1]).toBe('00:30 - video2')
    })
  })
})

