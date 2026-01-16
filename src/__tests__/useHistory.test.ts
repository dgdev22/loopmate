/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '@/hooks/useHistory'
import { HistoryItem } from '@/types'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('useHistory Hook', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useHistory())
    expect(result.current.history).toEqual([])
  })

  it('should load history from localStorage on mount', () => {
    const savedHistory: HistoryItem[] = [
      {
        id: '1',
        type: 'music-video',
        name: 'Test Job',
        status: 'completed',
        inputFiles: ['/path/to/file.mp3'],
        outputFile: '/path/to/output.mp4',
        createdAt: Date.now()
      }
    ]
    localStorageMock.setItem('lemon-video-history', JSON.stringify(savedHistory))

    const { result } = renderHook(() => useHistory())
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe('1')
    expect(result.current.history[0].name).toBe('Test Job')
  })

  it('should save history item', () => {
    const { result } = renderHook(() => useHistory())
    
    const newItem: HistoryItem = {
      id: '2',
      type: 'video-loop',
      name: 'Loop Video',
      status: 'completed',
      inputFiles: ['/path/to/video.mp4'],
      outputFile: '/path/to/output.mp4',
      createdAt: Date.now()
    }

    act(() => {
      result.current.saveHistory(newItem)
    })

    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe('2')
    expect(localStorageMock.getItem('lemon-video-history')).toBeTruthy()
  })

  it('should limit history to 100 items', () => {
    const { result } = renderHook(() => useHistory())
    
    // Add 101 items
    act(() => {
      for (let i = 0; i < 101; i++) {
        result.current.saveHistory({
          id: `item-${i}`,
          type: 'music-video',
          name: `Job ${i}`,
          status: 'completed',
          inputFiles: ['/path/to/file.mp3'],
          createdAt: Date.now()
        })
      }
    })

    expect(result.current.history).toHaveLength(100)
    expect(result.current.history[0].id).toBe('item-100') // Most recent
    expect(result.current.history[99].id).toBe('item-1') // Oldest
  })

  it('should delete history item by id', () => {
    const { result } = renderHook(() => useHistory())
    
    const item1: HistoryItem = {
      id: '1',
      type: 'music-video',
      name: 'Job 1',
      status: 'completed',
      inputFiles: ['/path/to/file.mp3'],
      createdAt: Date.now()
    }
    
    const item2: HistoryItem = {
      id: '2',
      type: 'video-loop',
      name: 'Job 2',
      status: 'completed',
      inputFiles: ['/path/to/video.mp4'],
      createdAt: Date.now()
    }

    act(() => {
      result.current.saveHistory(item1)
      result.current.saveHistory(item2)
    })

    expect(result.current.history).toHaveLength(2)

    act(() => {
      result.current.deleteHistoryItem('1')
    })

    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].id).toBe('2')
  })

  it('should clear all history', () => {
    const { result } = renderHook(() => useHistory())
    
    act(() => {
      result.current.saveHistory({
        id: '1',
        type: 'music-video',
        name: 'Job 1',
        status: 'completed',
        inputFiles: ['/path/to/file.mp3'],
        createdAt: Date.now()
      })
    })

    expect(result.current.history).toHaveLength(1)

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.history).toHaveLength(0)
    expect(localStorageMock.getItem('lemon-video-history')).toBeNull()
  })

  it('should handle corrupted localStorage data gracefully', () => {
    localStorageMock.setItem('lemon-video-history', 'invalid json')
    
    // Should not throw error
    const { result } = renderHook(() => useHistory())
    expect(result.current.history).toEqual([])
  })

  it('should preserve timestampText for concat jobs', () => {
    const { result } = renderHook(() => useHistory())
    
    const concatItem: HistoryItem = {
      id: 'concat-1',
      type: 'video-concat',
      name: 'Concat Job',
      status: 'completed',
      inputFiles: ['/path/to/video1.mp4', '/path/to/video2.mp4'],
      outputFile: '/path/to/output.mp4',
      timestampText: '00:00 - Video 1\n05:30 - Video 2',
      createdAt: Date.now()
    }

    act(() => {
      result.current.saveHistory(concatItem)
    })

    expect(result.current.history[0].timestampText).toBe('00:00 - Video 1\n05:30 - Video 2')
  })
})

