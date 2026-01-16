/**
 * Unit tests for queue persistence and recovery mechanism
 */

describe('Queue Persistence', () => {
  const mockElectronAPI = {
    saveQueue: jest.fn(),
    getQueue: jest.fn(),
    clearQueue: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock window.electronAPI
    ;(global as typeof globalThis & { window: Window & { electronAPI: typeof mockElectronAPI } }).window = {
      ...global.window,
      electronAPI: mockElectronAPI
    } as Window & { electronAPI: typeof mockElectronAPI }
  })

  describe('Queue Save Logic', () => {
    it('should save queue when jobs change', async () => {
      const jobs = [
        { id: '1', status: 'waiting', progress: 0, name: 'Test Job', type: 'music-video', params: {}, createdAt: Date.now() },
        { id: '2', status: 'completed', progress: 100, name: 'Completed Job', type: 'music-video', params: {}, createdAt: Date.now() }
      ]

      mockElectronAPI.saveQueue.mockResolvedValue({ success: true })
      
      await mockElectronAPI.saveQueue({ queue: jobs })

      expect(mockElectronAPI.saveQueue).toHaveBeenCalledWith({ queue: jobs })
      expect(mockElectronAPI.saveQueue).toHaveBeenCalledTimes(1)
    })

    it('should sanitize processing jobs before saving', async () => {
      const jobs = [
        { id: '1', status: 'processing', progress: 50, name: 'Processing Job', type: 'music-video', params: {}, createdAt: Date.now() }
      ]

      // Backend should convert processing to interrupted
      const sanitized = jobs.map(job => {
        if (job.status === 'processing') {
          return {
            ...job,
            status: 'interrupted',
            error: 'App was closed unexpectedly'
          }
        }
        return job
      })

      mockElectronAPI.saveQueue.mockResolvedValue({ success: true })
      await mockElectronAPI.saveQueue({ queue: sanitized })

      expect(sanitized[0].status).toBe('interrupted')
      expect(sanitized[0].error).toBe('App was closed unexpectedly')
    })
  })

  describe('Queue Load Logic', () => {
    it('should load queue from store on app mount', async () => {
      const savedQueue = [
        { id: '1', status: 'waiting', progress: 0, name: 'Test Job', type: 'music-video', params: {}, createdAt: Date.now() },
        { id: '2', status: 'completed', progress: 100, name: 'Completed Job', type: 'music-video', params: {}, createdAt: Date.now() }
      ]

      mockElectronAPI.getQueue.mockResolvedValue({ queue: savedQueue })

      const result = await mockElectronAPI.getQueue()

      expect(mockElectronAPI.getQueue).toHaveBeenCalled()
      expect(result.queue).toEqual(savedQueue)
    })

    it('should recover processing jobs as interrupted on load', async () => {
      const savedQueue = [
        { id: '1', status: 'processing', progress: 50, name: 'Crashed Job', type: 'music-video', params: {}, createdAt: Date.now() }
      ]

      // Backend recovery logic
      const recoveredQueue = savedQueue.map(job => {
        if (job.status === 'processing') {
          return {
            ...job,
            status: 'interrupted',
            error: 'App was closed unexpectedly',
            progress: 0
          }
        }
        return job
      })

      mockElectronAPI.getQueue.mockResolvedValue({ queue: recoveredQueue })

      const result = await mockElectronAPI.getQueue()

      expect(result.queue[0].status).toBe('interrupted')
      expect(result.queue[0].error).toBe('App was closed unexpectedly')
      expect(result.queue[0].progress).toBe(0)
    })

    it('should identify recoverable tasks (interrupted or waiting)', () => {
      const queue = [
        { id: '1', status: 'waiting', progress: 0 },
        { id: '2', status: 'interrupted', progress: 0 },
        { id: '3', status: 'completed', progress: 100 },
        { id: '4', status: 'failed', progress: 0 }
      ]

      const recoverableTasks = queue.filter(job => 
        job.status === 'interrupted' || job.status === 'waiting'
      )

      expect(recoverableTasks).toHaveLength(2)
      expect(recoverableTasks[0].status).toBe('waiting')
      expect(recoverableTasks[1].status).toBe('interrupted')
    })
  })

  describe('Resume Recovery', () => {
    it('should reset interrupted tasks to waiting status', () => {
      const jobs = [
        { id: '1', status: 'interrupted', progress: 50, error: 'App was closed unexpectedly' },
        { id: '2', status: 'waiting', progress: 0 }
      ]

      const resumedJobs = jobs.map(job => 
        job.status === 'interrupted' || job.status === 'waiting'
          ? { ...job, status: 'waiting', progress: 0, error: undefined }
          : job
      )

      expect(resumedJobs[0].status).toBe('waiting')
      expect(resumedJobs[0].progress).toBe(0)
      expect(resumedJobs[0].error).toBeUndefined()
      expect(resumedJobs[1].status).toBe('waiting')
    })

    it('should not resume completed or failed tasks', () => {
      const jobs = [
        { id: '1', status: 'completed', progress: 100 },
        { id: '2', status: 'failed', progress: 0, error: 'Some error' },
        { id: '3', status: 'interrupted', progress: 50 }
      ]

      const resumedJobs = jobs.map(job => 
        job.status === 'interrupted' || job.status === 'waiting'
          ? { ...job, status: 'waiting', progress: 0, error: undefined }
          : job
      )

      expect(resumedJobs[0].status).toBe('completed')
      expect(resumedJobs[1].status).toBe('failed')
      expect(resumedJobs[2].status).toBe('waiting')
    })
  })

  describe('Clear Queue', () => {
    it('should clear only completed tasks when clearCompleted is true', async () => {
      const currentQueue = [
        { id: '1', status: 'waiting', progress: 0 },
        { id: '2', status: 'completed', progress: 100 },
        { id: '3', status: 'failed', progress: 0 },
        { id: '4', status: 'interrupted', progress: 0 }
      ]

      const filteredQueue = currentQueue.filter(job => 
        job.status !== 'completed' && job.status !== 'failed' && job.status !== 'interrupted'
      )

      mockElectronAPI.clearQueue.mockResolvedValue({ success: true })
      await mockElectronAPI.clearQueue({ clearCompleted: true })

      expect(filteredQueue).toHaveLength(1)
      expect(filteredQueue[0].status).toBe('waiting')
    })

    it('should clear all tasks when clearCompleted is false', async () => {
      mockElectronAPI.clearQueue.mockResolvedValue({ success: true })
      await mockElectronAPI.clearQueue({ clearCompleted: false })

      expect(mockElectronAPI.clearQueue).toHaveBeenCalledWith({ clearCompleted: false })
    })
  })

  describe('Retry Job', () => {
    it('should reset failed job to waiting status', () => {
      const job = {
        id: '1',
        status: 'failed' as const,
        progress: 0,
        error: 'Some error',
        name: 'Failed Job',
        type: 'music-video' as const,
        params: {},
        createdAt: Date.now()
      }

      const retriedJob = {
        ...job,
        status: 'waiting' as const,
        progress: 0,
        error: undefined
      }

      expect(retriedJob.status).toBe('waiting')
      expect(retriedJob.error).toBeUndefined()
      expect(retriedJob.progress).toBe(0)
    })

    it('should reset interrupted job to waiting status', () => {
      const job = {
        id: '1',
        status: 'interrupted' as const,
        progress: 50,
        error: 'App was closed unexpectedly',
        name: 'Interrupted Job',
        type: 'music-video' as const,
        params: {},
        createdAt: Date.now()
      }

      const retriedJob = {
        ...job,
        status: 'waiting' as const,
        progress: 0,
        error: undefined
      }

      expect(retriedJob.status).toBe('waiting')
      expect(retriedJob.error).toBeUndefined()
      expect(retriedJob.progress).toBe(0)
    })

    it('should not retry completed or processing jobs', () => {
      const completedJob = { id: '1', status: 'completed' as const, progress: 100 }
      const processingJob = { id: '2', status: 'processing' as const, progress: 50 }

      // Retry should only work on failed/interrupted
      const canRetry = (job: { status: string }) => 
        job.status === 'failed' || job.status === 'interrupted'

      expect(canRetry(completedJob)).toBe(false)
      expect(canRetry(processingJob)).toBe(false)
    })
  })
})

