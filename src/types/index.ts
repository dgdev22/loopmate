// Job type definitions
export type JobType = 'music-video' | 'video-loop' | 'video-concat'
export type JobStatus = 'waiting' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'interrupted'

export interface Job {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  name: string
  params: {
    imagePath?: string
    audioPath?: string | string[]
    videoPath?: string | string[]
    iterations?: number
    enablePadding?: boolean
    paddingDuration?: number
    enableFadeOut?: boolean
    fadeOutDuration?: number
    enableFadeIn?: boolean
  }
  result?: string
  error?: string
  createdAt: number
  startedAt?: number      // When job actually started processing
  completedAt?: number    // When job finished (success or failure)
  timestampText?: string // YouTube timestamps for concat jobs
}

// History type definitions
export interface HistoryItem {
  id: string
  type: JobType
  name: string
  status: 'completed' | 'failed'
  inputFiles: string[]
  outputFile?: string
  error?: string
  createdAt: number
  duration?: number      // Execution time in milliseconds
  params?: {
    iterations?: number
    imageUsed?: boolean
  }
  timestampText?: string // YouTube timestamps for concat jobs
}

