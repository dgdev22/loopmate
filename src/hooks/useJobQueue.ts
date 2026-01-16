import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Job, JobStatus } from '@/types'

interface ProcessJobResult {
  success: boolean
  result?: string
  job: Job
  error?: string
}

interface UseJobQueueReturn {
  jobs: Job[]
  currentJobId: string | null
  progress: number
  isProcessing: boolean
  addJob: (job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>) => string
  cancelJob: (jobId: string) => Promise<void>
  removeJob: (jobId: string) => void
  retryJob: (jobId: string) => void
  clearCompletedJobs: () => Promise<void>
  clearAllJobs: () => Promise<void>
  processNextJob: () => Promise<ProcessJobResult | null>
  pauseQueue: () => void
  resumeQueue: () => void
  getJobById: (jobId: string) => Job | undefined
  getJobsByStatus: (status: JobStatus) => Job[]
}

/**
 * Custom hook for managing job queue with automatic processing
 * Handles video processing jobs with progress tracking and error handling
 */
export function useJobQueue(
  onProgress: (p: number) => void,
  onError: (error: { type?: string; message: string; stack?: string; errorId?: string }) => void
): UseJobQueueReturn {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<Job[]>([])
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const progressCleanupRef = useRef<(() => void) | null>(null)
  const isProcessingRef = useRef(false)

  // Progress listener setup
  useEffect(() => {
    // Cleanup previous listener
    if (progressCleanupRef.current) {
      progressCleanupRef.current()
      progressCleanupRef.current = null
    }

    if (!window.electronAPI?.onProgress) {
      console.warn('Progress listener not available')
      return
    }

    const cleanup = window.electronAPI.onProgress((p) => {
      const clampedProgress = Math.max(0, Math.min(p, 100))
      setProgress(clampedProgress)
      onProgress(clampedProgress)

      if (currentJobId) {
        setJobs(prev => prev.map(job =>
          job.id === currentJobId
            ? { ...job, progress: clampedProgress }
            : job
        ))
      }
    })

    progressCleanupRef.current = cleanup
    return cleanup
  }, [currentJobId, onProgress])

  // Add to job queue
  const addJob = useCallback((job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>) => {
    const newJob: Job = {
      ...job,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // More secure ID generation
      status: 'waiting',
      progress: 0,
      createdAt: Date.now()
    }

    setJobs(prev => [...prev, newJob])
    return newJob.id
  }, [])

  // Cancel job
  const cancelJob = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) {
      console.warn(`Job ${jobId} not found`)
      return
    }

    // Only jobs in waiting or processing status can be cancelled
    if (job.status !== 'waiting' && job.status !== 'processing') {
      console.warn(`Job ${jobId} cannot be cancelled (status: ${job.status})`)
      return
    }

    setJobs(prev => prev.map(j =>
      j.id === jobId
        ? { ...j, status: 'cancelled' as JobStatus, progress: 0 }
        : j
    ))

    // If currently processing, also send cancel request to backend
    if (currentJobId === jobId && window.electronAPI?.cancelCurrentJob) {
      try {
        await window.electronAPI.cancelCurrentJob()
      } catch (error) {
        console.error('Failed to cancel current job:', error)
      }
      setCurrentJobId(null)
      isProcessingRef.current = false
    }
  }, [jobs, currentJobId])

  // Remove job
  const removeJob = useCallback((jobId: string) => {
    const job = jobs.find(j => j.id === jobId)

    // Jobs in processing status cannot be removed
    if (job?.status === 'processing') {
      console.warn(`Cannot remove job ${jobId} while processing`)
      return
    }

    setJobs(prev => prev.filter(job => job.id !== jobId))
  }, [jobs])

  // Retry job
  const retryJob = useCallback((jobId: string) => {
    setJobs(prev => prev.map(job => {
      if (job.id !== jobId) return job

      // Only failed or interrupted jobs can be retried
      if (job.status !== 'failed' && job.status !== 'interrupted' && job.status !== 'cancelled') {
        console.warn(`Job ${jobId} cannot be retried (status: ${job.status})`)
        return job
      }

      return {
        ...job,
        status: 'waiting' as JobStatus,
        progress: 0,
        error: undefined
      }
    }))
  }, [])

  // Remove completed jobs
  const clearCompletedJobs = useCallback(async () => {
    try {
      if (window.electronAPI?.clearQueue) {
        await window.electronAPI.clearQueue({ clearCompleted: true })
      }

      setJobs(prev => prev.filter(job =>
        job.status !== 'completed' &&
        job.status !== 'failed' &&
        job.status !== 'interrupted' &&
        job.status !== 'cancelled'
      ))
    } catch (error) {
      console.error('Failed to clear completed jobs:', error)
      throw error
    }
  }, [])

  // Remove all jobs
  const clearAllJobs = useCallback(async () => {
    try {
      // If there are jobs in processing, cancel them first
      if (currentJobId) {
        await cancelJob(currentJobId)
      }

      // Clear all jobs by filtering them out
      setJobs([])
      setProgress(0)
    } catch (error) {
      console.error('Failed to clear all jobs:', error)
      throw error
    }
  }, [currentJobId, cancelJob])

  // Pause queue
  const pauseQueue = useCallback(() => {
    setIsPaused(true)
  }, [])

  // Resume queue
  const resumeQueue = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Find job by ID
  const getJobById = useCallback((jobId: string): Job | undefined => {
    return jobs.find(job => job.id === jobId)
  }, [jobs])

  // Get job list by status
  const getJobsByStatus = useCallback((status: JobStatus): Job[] => {
    return jobs.filter(job => job.status === status)
  }, [jobs])

  // Parse error info
  const parseError = useCallback((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    // Extract error code from message (format: [ERROR_CODE:1234] message)
    const errorCodeMatch = errorMessage.match(/\[ERROR_CODE:(\d+)\]/)
    const errorCode = errorCodeMatch ? errorCodeMatch[1] : undefined

    // Extract error ID if present in error message (legacy format)
    const errorIdMatch = errorMessage.match(/Error ID: (ERR_\w+)/)
    const errorId = errorIdMatch ? errorIdMatch[1] : errorCode

    return {
      message: errorMessage,
      stack: errorStack,
      errorId
    }
  }, [])

  // Process job
  const processNextJob = useCallback(async (): Promise<ProcessJobResult | null> => {
    // Skip if already processing or paused
    if (isProcessingRef.current || isPaused) {
      return null
    }

    // Find next waiting job
    const nextJob = jobs.find(job => job.status === 'waiting')
    if (!nextJob) {
      return null
    }

    isProcessingRef.current = true
    setCurrentJobId(nextJob.id)
    setProgress(0)

    // Change job status to 'processing' and record start time
    const startTime = Date.now()
    setJobs(prev => prev.map(job =>
      job.id === nextJob.id 
        ? { ...job, status: 'processing' as JobStatus, startedAt: startTime } 
        : job
    ))

    try {
      let result: string

      // Process by job type
      switch (nextJob.type) {
        case 'music-video':
          if (!window.electronAPI?.createFromImage) {
            throw new Error('createFromImage API not available')
          }
          result = await window.electronAPI.createFromImage({
            imagePath: nextJob.params.imagePath || '',
            audioPath: nextJob.params.audioPath!,
            enablePadding: nextJob.params.enablePadding ?? false,
            paddingDuration: nextJob.params.paddingDuration ?? 3,
            enableFadeOut: nextJob.params.enableFadeOut ?? true,
            fadeOutDuration: nextJob.params.fadeOutDuration ?? 2
          })
          break

        case 'video-loop':
          if (!window.electronAPI?.processVideo) {
            throw new Error('processVideo API not available')
          }
          result = await window.electronAPI.processVideo({
            inputPath: nextJob.params.videoPath as string,
            iterations: nextJob.params.iterations!
          })
          break

        case 'video-concat':
          if (!window.electronAPI?.concatVideos) {
            throw new Error('concatVideos API not available')
          }
          result = await window.electronAPI.concatVideos({
            videoPaths: nextJob.params.videoPath as string[],
            enablePadding: nextJob.params.enablePadding ?? false,
            paddingDuration: nextJob.params.paddingDuration ?? 3,
            enableFadeOut: nextJob.params.enableFadeOut ?? true,
            fadeOutDuration: nextJob.params.fadeOutDuration ?? 2,
            enableFadeIn: nextJob.params.enableFadeIn ?? false
          })
          break

        default:
          throw new Error(`Unknown job type: ${nextJob.type}`)
      }

      // Handle job completion and record completion time
      const endTime = Date.now()
      setJobs(prev => prev.map(job =>
        job.id === nextJob.id
          ? { ...job, status: 'completed' as JobStatus, progress: 100, result, completedAt: endTime }
          : job
      ))

      // Completion notification
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification({
          title: t('notifications.jobCompleted'),
          body: t('notifications.jobCompletedBody', { jobName: nextJob.name })
        })
      }

      return { success: true, result, job: nextJob }

    } catch (error) {
      const { message, stack, errorId } = parseError(error)

      // Handle job failure and record completion time
      const endTime = Date.now()
      setJobs(prev => prev.map(job =>
        job.id === nextJob.id
          ? { ...job, status: 'failed' as JobStatus, error: message, completedAt: endTime }
          : job
      ))

      // Show error modal
      onError({
        type: 'videoProcessing',
        message,
        stack,
        errorId
      })

      // Failure notification
      if (window.electronAPI?.showNotification) {
        await window.electronAPI.showNotification({
          title: t('notifications.jobFailed'),
          body: t('notifications.jobFailedBody', { jobName: nextJob.name })
        })
      }

      return { success: false, job: nextJob, error: message }

    } finally {
      setCurrentJobId(null)
      setProgress(0)
      isProcessingRef.current = false
    }
  }, [jobs, isPaused, parseError, onError, t])

  return {
    jobs,
    currentJobId,
    progress,
    isProcessing: isProcessingRef.current,
    addJob,
    cancelJob,
    removeJob,
    retryJob,
    clearCompletedJobs,
    clearAllJobs,
    processNextJob,
    pauseQueue,
    resumeQueue,
    getJobById,
    getJobsByStatus
  }
}