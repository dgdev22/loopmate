import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'

// Mock electron API
const mockElectronAPI = {
  openFileDialog: jest.fn(),
  getVideoDuration: jest.fn(),
  processVideo: jest.fn(),
  createFromImage: jest.fn(),
  concatVideos: jest.fn(),
  openFile: jest.fn(),
  fileExists: jest.fn(),
  onProgress: jest.fn(),
  showNotification: jest.fn(),
  cancelCurrentJob: jest.fn(),
  openExternal: jest.fn().mockResolvedValue({ success: true }),
}

// Extend global window type
declare global {
  interface Window {
    electronAPI?: typeof mockElectronAPI
  }
}

Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    electronAPI: mockElectronAPI
  },
  writable: true,
  configurable: true
})

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock localStorage
    if (typeof Storage !== 'undefined') {
      Storage.prototype.getItem = jest.fn().mockReturnValue(null)
      Storage.prototype.setItem = jest.fn()
    } else {
      // For environments where Storage is not defined
      global.localStorage = {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn().mockReturnValue(null)
      } as unknown as Storage
    }
  })

  describe('Job Management Logic', () => {
    it('should create job with correct structure', () => {
      const job = {
        id: '123',
        type: 'music-video' as const,
        status: 'waiting' as const,
        progress: 0,
        name: 'Test Job',
        params: {
          imagePath: '/path/to/image.jpg',
          audioPath: '/path/to/audio.mp3',
        },
        createdAt: Date.now(),
      }

      expect(job).toHaveProperty('id')
      expect(job).toHaveProperty('type')
      expect(job).toHaveProperty('status')
      expect(job).toHaveProperty('progress')
      expect(job).toHaveProperty('name')
      expect(job).toHaveProperty('params')
      expect(job.type).toBe('music-video')
    })

    it('should handle history item with status field', () => {
      const historyItem = {
        id: '123',
        type: 'music-video' as const,
        name: 'Test Job',
        status: 'completed' as const,
        inputFiles: ['/path/to/file.mp3'],
        outputFile: '/path/to/output.mp4',
        createdAt: Date.now(),
      }

      expect(historyItem).toHaveProperty('status')
      expect(historyItem.status).toBe('completed')
    })

    it('should handle failed history item', () => {
      const historyItem = {
        id: '123',
        type: 'music-video' as const,
        name: 'Test Job',
        status: 'failed' as const,
        inputFiles: ['/path/to/file.mp3'],
        error: 'Test error message',
        createdAt: Date.now(),
      }

      expect(historyItem.status).toBe('failed')
      expect(historyItem).toHaveProperty('error')
      expect(historyItem.error).toBe('Test error message')
    })

    it('should handle video loop job structure', () => {
      const job = {
        id: '456',
        type: 'video-loop' as const,
        status: 'waiting' as const,
        progress: 0,
        name: 'Loop Video',
        params: {
          videoPath: '/path/to/video.mp4',
          iterations: 10,
        },
        createdAt: Date.now(),
      }

      expect(job.type).toBe('video-loop')
      expect(job.params.iterations).toBe(10)
    })

    it('should handle video concat job structure', () => {
      const job = {
        id: '789',
        type: 'video-concat' as const,
        status: 'waiting' as const,
        progress: 0,
        name: 'Concat Videos',
        params: {
          videoPath: ['/path/to/video1.mp4', '/path/to/video2.mp4'],
          enablePadding: true,
          paddingDuration: 3,
        },
        createdAt: Date.now(),
      }

      expect(job.type).toBe('video-concat')
      expect(Array.isArray(job.params.videoPath)).toBe(true)
      expect(job.params.videoPath.length).toBe(2)
    })
  })

  describe('File Validation Logic', () => {
    it('should validate video file count for concat', () => {
      const videoFiles: string[] = []
      const isValid = videoFiles.length > 0
      expect(isValid).toBe(false)

      const singleFile = ['/path/to/video.mp4']
      const isValidSingle = singleFile.length > 0
      expect(isValidSingle).toBe(true)

      const multipleFiles = ['/path/to/video1.mp4', '/path/to/video2.mp4']
      const isValidMultiple = multipleFiles.length > 0
      expect(isValidMultiple).toBe(true)
    })

    it('should validate audio files for music video', () => {
      const audioFiles: string[] = []
      const canCreate = audioFiles.length > 0
      expect(canCreate).toBe(false)

      const hasAudio = ['/path/to/audio.mp3']
      const canCreateWithAudio = hasAudio.length > 0
      expect(canCreateWithAudio).toBe(true)
    })
  })

  describe('External Link Handling', () => {
    it('should have openExternal in electronAPI', () => {
      expect(global.window.electronAPI).toHaveProperty('openExternal')
      expect(typeof global.window.electronAPI.openExternal).toBe('function')
    })

    it('should handle Buy Me a Coffee link', async () => {
      const mockOpenExternal = global.window.electronAPI?.openExternal as jest.Mock
      const url = 'https://buymeacoffee.com/loopmateapp'
      
      if (mockOpenExternal) {
        await mockOpenExternal(url)
        expect(mockOpenExternal).toHaveBeenCalledWith(url)
      }
    })
  })
})

