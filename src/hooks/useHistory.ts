import { useState, useEffect, useCallback, useRef } from 'react'
import { HistoryItem } from '@/types'

interface UseHistoryReturn {
  history: HistoryItem[]
  isLoading: boolean
  error: string | null
  saveHistory: (item: HistoryItem) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void
  updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void
}

const HISTORY_STORAGE_KEY = 'lemon-video-history'
const MAX_HISTORY_ITEMS = 100

/**
 * Custom hook for managing video conversion history
 * Provides CRUD operations with localStorage persistence
 */
export function useHistory(): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isInitialized = useRef(false)

  // Load history (initialization)
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const loadHistory = () => {
      try {
        setIsLoading(true)
        setError(null)

        const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY)

        if (savedHistory) {
          const parsed = JSON.parse(savedHistory)

          // Data validation
          if (Array.isArray(parsed)) {
            // Convert date string to Date object (if needed)
            const validatedHistory = parsed
              .filter(item => item && typeof item === 'object' && item.id)
              .slice(0, MAX_HISTORY_ITEMS)

            setHistory(validatedHistory)
          } else {
            console.warn('Invalid history format, resetting to empty array')
            setHistory([])
          }
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to load history'
        console.error('Failed to load history:', e)
        setError(errorMessage)
        setHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [])

  // Utility function to save to localStorage
  const saveToLocalStorage = useCallback((data: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data))
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to save history'
      console.error('Failed to save history:', e)
      setError(errorMessage)

      // If localStorage quota exceeded, delete old items and retry
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        try {
          const reducedData = data.slice(0, Math.floor(MAX_HISTORY_ITEMS / 2))
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(reducedData))
          setHistory(reducedData)
          setError('Storage quota exceeded. Older items were removed.')
        } catch (retryError) {
          console.error('Failed to save even after reducing data:', retryError)
        }
      }
    }
  }, [])

  // Save history
  const saveHistory = useCallback((item: HistoryItem) => {
    if (!item || !item.id) {
      console.error('Invalid history item:', item)
      setError('Invalid history item')
      return
    }

    setHistory(prev => {
      // Remove duplicates (remove if same ID exists)
      const filteredHistory = prev.filter(h => h.id !== item.id)

      // Add new item at the front and limit to max count
      const newHistory = [item, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS)

      saveToLocalStorage(newHistory)
      return newHistory
    })
  }, [saveToLocalStorage])

  // Update history item
  const updateHistoryItem = useCallback((id: string, updates: Partial<HistoryItem>) => {
    setHistory(prev => {
      const itemIndex = prev.findIndex(item => item.id === id)

      if (itemIndex === -1) {
        console.warn(`History item with id ${id} not found`)
        return prev
      }

      const newHistory = [...prev]
      newHistory[itemIndex] = { ...newHistory[itemIndex], ...updates }

      saveToLocalStorage(newHistory)
      return newHistory
    })
  }, [saveToLocalStorage])

  // Delete history
  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id)

      if (newHistory.length === prev.length) {
        console.warn(`History item with id ${id} not found`)
        return prev
      }

      saveToLocalStorage(newHistory)
      return newHistory
    })
  }, [saveToLocalStorage])

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([])
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY)
      setError(null)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to clear history'
      console.error('Failed to clear history:', e)
      setError(errorMessage)
    }
  }, [])

  return {
    history,
    isLoading,
    error,
    saveHistory,
    deleteHistoryItem,
    clearHistory,
    updateHistoryItem
  }
}

// Optional: Additional hook to get history statistics
export function useHistoryStats(history: HistoryItem[]) {
  return {
    totalItems: history.length,
    recentItems: history.slice(0, 10),
    oldestItem: history[history.length - 1],
    newestItem: history[0]
  }
}