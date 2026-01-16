import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from './i18n'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileVideo, Music, Image as ImageIcon, Plus, CheckCircle2, Settings, Coffee, ChevronDown, ChevronUp, Eye, Video, Loader2, Download, Repeat, FileVideo as VideoIcon, Files, Copy } from "lucide-react"
import { FileDropZone } from "@/components/FileDropZone"
import { TermsModal } from "@/components/TermsModal"
import { OnboardingModal } from "@/components/OnboardingModal"
import { SettingsTab } from "@/components/tabs/SettingsTab"
import { UpdateNotification } from "@/components/UpdateNotification"
import { ErrorModal } from "@/components/ErrorModal"
import { RightPanel } from "@/components/RightPanel"
import { ToastContainer, Toast } from "@/components/Toast"
import { calculateTimestamps } from "@/lib/timestampUtils"
import confetti from 'canvas-confetti'
import { useSettingsStore } from "@/store/useSettingsStore"
import { useHistory } from "@/hooks/useHistory"
import { Job, JobType, JobStatus } from "@/types"
// Note: window.electronAPI is typed globally in src/types/electronAPI.d.ts


export default function App() {
  const { t } = useTranslation()
  const isE2E = import.meta.env.VITE_E2E === '1'
  const { fileExtensions, loadFileExtensions } = useSettingsStore()
  const [progress, setProgress] = useState(0)

  // State management
  const [loopFile, setLoopFile] = useState<string | null>(null)
  const [loopVideoDuration, setLoopVideoDuration] = useState<number>(0) // Video duration (seconds)
  const [iterations, setIterations] = useState(10)
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(null) // Base64 data URL for preview
  const [audioFiles, setAudioFiles] = useState<string[]>([]) // Multiple audio files (playlist)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [enableMusicPadding, setEnableMusicPadding] = useState(false) // Black screen padding between audio (default false = fast merge)
  const [musicPaddingDuration, setMusicPaddingDuration] = useState(3) // Audio padding duration (seconds)
  const [enableMusicFadeOut, setEnableMusicFadeOut] = useState(false) // Audio fade out (default false = fast merge)
  const [musicFadeOutDuration, setMusicFadeOutDuration] = useState(2) // Audio fade out duration (seconds)
  
  // {t('tabs.concat.title')}
  const [videoFiles, setVideoFiles] = useState<string[]>([]) // Multiple video files
  const [draggedVideoIndex, setDraggedVideoIndex] = useState<number | null>(null)
  const [enablePadding, setEnablePadding] = useState(false) // Black screen padding between videos (default false = Fast Mode!)
  const [paddingDuration, setPaddingDuration] = useState(3) // Padding duration (seconds)
  const [enableFadeOut, setEnableFadeOut] = useState(false) // Fade out (end of each video, default false = Fast Mode!)
  const [fadeOutDuration, setFadeOutDuration] = useState(2) // Fade out duration (seconds)
  const [enableFadeIn, setEnableFadeIn] = useState(false) // Fade in (start of each video)
  
  // Job queue management
  const [jobs, setJobs] = useState<Job[]>([])
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  
  // Currently selected menu
  const [selectedMenu, setSelectedMenu] = useState<'image-music' | 'loop' | 'concat' | 'settings'>('image-music')
  
  // Advanced options display state (maintained per tab)
  const [showAdvancedMusicOptions, setShowAdvancedMusicOptions] = useState(false)
  const [showAdvancedVideoOptions, setShowAdvancedVideoOptions] = useState(false)
  const [showAdvancedLoopOptions, setShowAdvancedLoopOptions] = useState(false)
  
  // Estimated video duration
  const [estimatedDuration] = useState<string>('')
  
  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Show toast function
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now()
    setToasts(prev => [...prev, { ...toast, id, duration: toast.duration ?? 3000 }])
  }, [])
  
  // Remove toast function
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])
  
  
  // Error modal state
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [currentError, setCurrentError] = useState<{
    type?: string
    message: string
    stack?: string
    errorId?: string
  } | null>(null)
  
  // History management
  const { history, saveHistory, deleteHistoryItem, clearHistory } = useHistory()


  // Load settings and recover queue
  const [, setShowResumeModal] = useState(false)
  const [, setInterruptedTasks] = useState<Job[]>([])

  useEffect(() => {
    const loadSettings = async () => {
      // Remove existing localStorage language setting (electron-store becomes single source)
      localStorage.removeItem('i18nextLng')
      
      // Load language setting first to ensure UI language is set correctly
      if (window.electronAPI?.getLanguage) {
        try {
          const langResult = await window.electronAPI.getLanguage()
          if (langResult.language) {
            await i18n.changeLanguage(langResult.language)
          }
        } catch (e) {
          console.error('Failed to load language:', e)
        }
      }

      // Load job queue (including crash recovery)
      if (window.electronAPI?.getQueue) {
        try {
          const queueResult = await window.electronAPI.getQueue()
          if (queueResult.queue && queueResult.queue.length > 0) {
            // Find jobs in interrupted or waiting status
            const recoverableTasks = queueResult.queue.filter(job => 
              job.status === 'interrupted' || job.status === 'waiting'
            )
            
            if (recoverableTasks.length > 0) {
              setInterruptedTasks(recoverableTasks)
              setShowResumeModal(true)
              // Add to queue first (in interrupted status)
              setJobs(queueResult.queue)
            } else {
              // If no recoverable tasks, just load
              setJobs(queueResult.queue)
            }
          }
        } catch (e) {
          console.error('Failed to load queue:', e)
        }
      }

    }
    loadSettings()
  }, [])

  // Load file extension settings
  useEffect(() => {
    loadFileExtensions()
  }, [loadFileExtensions])

  // Load image as data URL for preview
  useEffect(() => {
    if (bgImage && window.electronAPI?.getImageDataUrl) {
      window.electronAPI.getImageDataUrl(bgImage)
        .then((result: { success: boolean; dataUrl?: string; error?: string }) => {
          if (result.success && result.dataUrl) {
            setBgImageDataUrl(result.dataUrl)
          } else {
            console.error('Failed to load image:', result.error)
            setBgImageDataUrl(null)
          }
        })
        .catch((error: Error) => {
          console.error('Error loading image:', error)
          setBgImageDataUrl(null)
        })
    } else {
      setBgImageDataUrl(null)
    }
  }, [bgImage])

  // UI preferences load (advanced options per tab + seconds storage)
  useEffect(() => {
    const loadUIPreferences = async () => {
      // Prefer electron-store via IPC; fallback to legacy localStorage
      if (window.electronAPI?.getUIPreferences) {
        try {
          const prefs = await window.electronAPI.getUIPreferences()

          setShowAdvancedMusicOptions(!!prefs.imageMusic.advancedOpen)
          setEnableMusicFadeOut(!!prefs.imageMusic.enableFadeOut)
          setMusicFadeOutDuration(Number(prefs.imageMusic.fadeOutDuration))
          setEnableMusicPadding(!!prefs.imageMusic.enablePadding)
          setMusicPaddingDuration(Number(prefs.imageMusic.paddingDuration))

          setShowAdvancedVideoOptions(!!prefs.concat.advancedOpen)
          setEnableFadeOut(!!prefs.concat.enableFadeOut)
          setFadeOutDuration(Number(prefs.concat.fadeOutDuration))
          setEnablePadding(!!prefs.concat.enablePadding)
          setPaddingDuration(Number(prefs.concat.paddingDuration))
          setEnableFadeIn(!!prefs.concat.enableFadeIn)

          setShowAdvancedLoopOptions(!!prefs.loop.advancedOpen)
          return
        } catch (e) {
          console.error('Failed to load UI preferences:', e)
        }
      }

      // Legacy fallback: localStorage
      const savedPadding = localStorage.getItem('lemon-video-padding-duration')
      const savedFadeOut = localStorage.getItem('lemon-video-fadeout-duration')
      const savedEnablePadding = localStorage.getItem('lemon-video-enable-padding')
      const savedEnableFadeOut = localStorage.getItem('lemon-video-enable-fadeout')
      const savedEnableFadeIn = localStorage.getItem('lemon-video-enable-fadein')

      const savedMusicPadding = localStorage.getItem('lemon-music-padding-duration')
      const savedMusicFadeOut = localStorage.getItem('lemon-music-fadeout-duration')
      const savedEnableMusicPadding = localStorage.getItem('lemon-music-enable-padding')
      const savedEnableMusicFadeOut = localStorage.getItem('lemon-music-enable-fadeout')

      const savedMusicAdvanced = localStorage.getItem('lemon-ui-advanced-image-music')
      const savedConcatAdvanced = localStorage.getItem('lemon-ui-advanced-concat')
      const savedLoopAdvanced = localStorage.getItem('lemon-ui-advanced-loop')

      if (savedPadding) setPaddingDuration(Number(savedPadding))
      if (savedFadeOut) setFadeOutDuration(Number(savedFadeOut))
      if (savedEnablePadding) setEnablePadding(savedEnablePadding === 'true')
      if (savedEnableFadeOut) setEnableFadeOut(savedEnableFadeOut === 'true')
      if (savedEnableFadeIn) setEnableFadeIn(savedEnableFadeIn === 'true')

      if (savedMusicPadding) setMusicPaddingDuration(Number(savedMusicPadding))
      if (savedMusicFadeOut) setMusicFadeOutDuration(Number(savedMusicFadeOut))
      if (savedEnableMusicPadding) setEnableMusicPadding(savedEnableMusicPadding === 'true')
      if (savedEnableMusicFadeOut) setEnableMusicFadeOut(savedEnableMusicFadeOut === 'true')

      if (savedMusicAdvanced) setShowAdvancedMusicOptions(savedMusicAdvanced === 'true')
      if (savedConcatAdvanced) setShowAdvancedVideoOptions(savedConcatAdvanced === 'true')
      if (savedLoopAdvanced) setShowAdvancedLoopOptions(savedLoopAdvanced === 'true')
    }

    loadUIPreferences()
  }, [])

  // UI preferences save (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Save to electron-store when available
      if (window.electronAPI?.setUIPreferences) {
        window.electronAPI.setUIPreferences({
          imageMusic: {
            advancedOpen: showAdvancedMusicOptions,
            enableFadeOut: enableMusicFadeOut,
            fadeOutDuration: musicFadeOutDuration,
            enablePadding: enableMusicPadding,
            paddingDuration: musicPaddingDuration
          },
          concat: {
            advancedOpen: showAdvancedVideoOptions,
            enableFadeOut,
            fadeOutDuration,
            enablePadding,
            paddingDuration,
            enableFadeIn
          },
          loop: {
            advancedOpen: showAdvancedLoopOptions
          }
        }).catch((e) => console.error('Failed to save UI preferences:', e))
      } else {
        // Legacy fallback: localStorage
        localStorage.setItem('lemon-video-padding-duration', String(paddingDuration))
        localStorage.setItem('lemon-video-fadeout-duration', String(fadeOutDuration))
        localStorage.setItem('lemon-video-enable-padding', String(enablePadding))
        localStorage.setItem('lemon-video-enable-fadeout', String(enableFadeOut))
        localStorage.setItem('lemon-video-enable-fadein', String(enableFadeIn))

        localStorage.setItem('lemon-music-padding-duration', String(musicPaddingDuration))
        localStorage.setItem('lemon-music-fadeout-duration', String(musicFadeOutDuration))
        localStorage.setItem('lemon-music-enable-padding', String(enableMusicPadding))
        localStorage.setItem('lemon-music-enable-fadeout', String(enableMusicFadeOut))

        localStorage.setItem('lemon-ui-advanced-image-music', String(showAdvancedMusicOptions))
        localStorage.setItem('lemon-ui-advanced-concat', String(showAdvancedVideoOptions))
        localStorage.setItem('lemon-ui-advanced-loop', String(showAdvancedLoopOptions))
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [
    showAdvancedMusicOptions,
    showAdvancedVideoOptions,
    showAdvancedLoopOptions,
    enableMusicFadeOut,
    musicFadeOutDuration,
    enableMusicPadding,
    musicPaddingDuration,
    enableFadeOut,
    fadeOutDuration,
    enablePadding,
    paddingDuration,
    enableFadeIn
  ])
  
  // Handler to clear all data
  const handleDataCleared = () => {
    // Clear history
    clearHistory()
    
    // Clear job queue
    setJobs([])
    setCurrentJobId(null)
    
    // Show success message
    showToast({
      type: 'success',
      title: t('resetData.success'),
      duration: 5000
    })
  }
  
  // Utility function to extract input file list from job
  const extractInputFiles = (job: Job): string[] => {
    const inputFiles: string[] = []
    
    if (job.type === 'music-video') {
      if (job.params.imagePath) inputFiles.push(job.params.imagePath)
      const audioPath = job.params.audioPath
      if (Array.isArray(audioPath)) {
        inputFiles.push(...audioPath)
      } else if (audioPath) {
        inputFiles.push(audioPath)
      }
    } else if (job.type === 'video-loop') {
      if (job.params.videoPath) inputFiles.push(job.params.videoPath as string)
    } else if (job.type === 'video-concat') {
      const videoPaths = job.params.videoPath
      if (Array.isArray(videoPaths)) inputFiles.push(...videoPaths)
    }
    
    return inputFiles
  }


  useEffect(() => {
    if (!window.electronAPI?.onProgress) {
      return
    }
    
    const cleanupProgress = window.electronAPI.onProgress((p) => {
      // Guardrail: limit to 0-100%
      const clampedProgress = Math.max(0, Math.min(p, 100))
      setProgress(clampedProgress)
      
      // Update progress of currently processing job
      if (currentJobId) {
        setJobs(prev => prev.map(job =>
          job.id === currentJobId
            ? { ...job, progress: clampedProgress }
            : job
        ))
      }
    })
    
    // Listen for global app errors from main process
    let cleanupError: (() => void) | undefined
    if (window.electronAPI.onAppError) {
      cleanupError = window.electronAPI.onAppError((error) => {
        setCurrentError({
          type: error.type,
          message: error.message,
          stack: error.stack,
          errorId: error.errorId
        })
        setErrorModalOpen(true)
      })
    }
    
    // Cleanup function
    return () => {
      cleanupProgress()
      cleanupError?.()
    }
  }, [currentJobId])

  // File selection handler (with type specification)
  const selectFile = async (setter: (path: string) => void, type: 'video' | 'image' | 'audio') => {
    const result = await window.electronAPI?.openFileDialog(type)
    if (!result) return
    const selectedPath = Array.isArray(result) ? result[0] : result
    if (selectedPath) setter(selectedPath)
  }

  // Select video file (also get duration info)
  const selectLoopVideo = async () => {
    const result = await window.electronAPI?.openFileDialog('video')
    if (result) {
      const selectedPath = Array.isArray(result) ? result[0] : result
      if (selectedPath) await updateLoopFile(selectedPath)
    }
  }

  // Update video file (also used in drag and drop)
  const updateLoopFile = async (path: string) => {
    setLoopFile(path)
    try {
      const duration = await window.electronAPI?.getVideoDuration(path)
      if (!duration) {
        setLoopVideoDuration(0)
        return
      }
      setLoopVideoDuration(duration)
    } catch (e) {
      console.error('Failed to analyze video duration:', e)
      setLoopVideoDuration(0)
    }
  }

  // Calculate estimated video time (minutes:seconds format)
  const getEstimatedTime = () => {
    if (!loopVideoDuration || loopVideoDuration === 0) return null
    const totalSeconds = Math.round(loopVideoDuration * iterations)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}${t('time.minutes')} ${seconds}${t('time.seconds')}`
  }

  // Return processing stage text
  const getProcessingStage = (progressValue: number): string => {
    if (progressValue < 20) {
      return t('processing.stage.preparing', { defaultValue: 'Preparing...' })
    } else if (progressValue < 40) {
      return t('processing.stage.processing', { defaultValue: 'Processing audio...' })
    } else if (progressValue < 60) {
      return t('processing.stage.encoding', { defaultValue: 'Encoding video...' })
    } else if (progressValue < 80) {
      return t('processing.stage.finalizing', { defaultValue: 'Finalizing...' })
    } else {
      return t('processing.stage.almostDone', { defaultValue: 'Almost done!' })
    }
  }

  // Add audio file (multiple file selection available)
  const addAudioFile = async () => {
    const result = await window.electronAPI?.openFileDialog('audio', true)
    if (result) {
      const paths = Array.isArray(result) ? result : [result]
      const newFiles = paths.filter(path => !audioFiles.includes(path))
      if (newFiles.length > 0) {
        setAudioFiles([...audioFiles, ...newFiles])
      }
    }
  }

  // Add audio file via drag and drop
  const addAudioFileByDrop = (path: string) => {
    if (!audioFiles.includes(path)) {
      setAudioFiles([...audioFiles, path])
    }
  }

  // Remove audio file
  const removeAudioFile = (index: number) => {
    setAudioFiles(audioFiles.filter((_, i) => i !== index))
  }

  // Duplicate audio file (copy the file at the given index to the next position)
  const duplicateAudioFile = (index: number) => {
    if (index < 0 || index >= audioFiles.length) return
    const newFiles = [...audioFiles]
    newFiles.splice(index + 1, 0, audioFiles[index])
    setAudioFiles(newFiles)
  }

  // Change order via drag and drop
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newAudioFiles = [...audioFiles]
    const draggedItem = newAudioFiles[draggedIndex]
    newAudioFiles.splice(draggedIndex, 1)
    newAudioFiles.splice(index, 0, draggedItem)

    setAudioFiles(newAudioFiles)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Add video file (multiple file selection available)
  const addVideoFile = async () => {
    const result = await window.electronAPI?.openFileDialog('video', true)
    if (result) {
      const paths = Array.isArray(result) ? result : [result]
      const newFiles = paths.filter(path => !videoFiles.includes(path))
      if (newFiles.length > 0) {
        setVideoFiles([...videoFiles, ...newFiles])
      }
    }
  }

  // Add video file via drag and drop
  const addVideoFileByDrop = (path: string) => {
    if (!videoFiles.includes(path)) {
      setVideoFiles([...videoFiles, path])
    }
  }

  // Remove video file
  const removeVideoFile = (index: number) => {
    setVideoFiles(videoFiles.filter((_, i) => i !== index))
  }

  // Duplicate video file (copy the file at the given index to the next position)
  const duplicateVideoFile = (index: number) => {
    if (index < 0 || index >= videoFiles.length) return
    const newFiles = [...videoFiles]
    newFiles.splice(index + 1, 0, videoFiles[index])
    setVideoFiles(newFiles)
  }

  // Change video order via drag and drop
  const handleVideoDragStart = (index: number) => {
    setDraggedVideoIndex(index)
  }

  const handleVideoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedVideoIndex === null || draggedVideoIndex === index) return

    const newVideoFiles = [...videoFiles]
    const draggedItem = newVideoFiles[draggedVideoIndex]
    newVideoFiles.splice(draggedVideoIndex, 1)
    newVideoFiles.splice(index, 0, draggedItem)

    setVideoFiles(newVideoFiles)
    setDraggedVideoIndex(index)
  }

  const handleVideoDragEnd = () => {
    setDraggedVideoIndex(null)
  }

  // Add concat job
  const handleConcatVideos = async () => {
    if (videoFiles.length === 0) return
    
    const videoCount = videoFiles.length
    const jobName = videoCount === 1 
      ? t('job.singleVideo')
      : t('job.concatMultiple', { count: videoCount })
    
    // Add job immediately to avoid UI blocking
    const jobId = addJob({
      type: 'video-concat' as JobType,
      name: jobName,
      params: {
        videoPath: videoFiles, // Pass multiple video files
        enablePadding, // Padding option
        paddingDuration, // Padding duration
        enableFadeOut, // Fade out option
        fadeOutDuration, // Fade out duration
        enableFadeIn, // Fade in option
      },
      timestampText: undefined // Will be calculated in background
    })
    
    // Show toast immediately
    showToast({
      type: 'success',
      title: t('toast.addedToQueue', { defaultValue: 'Added to queue' }),
      description: t('toast.jobWillStartSoon', { defaultValue: 'Job will start soon' }),
      duration: 3000
    })
    
    // Calculate timestamps in background (non-blocking)
    // This updates the job with timestamps when ready
    if (videoCount >= 2 && window.electronAPI?.getVideoDuration) {
      // Use setTimeout to ensure UI update happens first
      setTimeout(async () => {
        try {
          const getVideoDuration = window.electronAPI?.getVideoDuration
          if (!getVideoDuration) return
          
          const timestampText = await calculateTimestamps(
            videoFiles,
            (path) => getVideoDuration(path),
            {
              enablePadding,
              paddingDuration
            }
          )
          
          // Update job with calculated timestamps
          setJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { ...job, timestampText }
              : job
          ))
        } catch (error) {
          console.error('Failed to calculate timestamps:', error)
          // Continue without timestamps if calculation fails
        }
      }, 0)
    }
  }

  // Add job to queue
  const addJob = (job: Omit<Job, 'id' | 'status' | 'progress' | 'createdAt'>) => {
    const newJob: Job = {
      ...job,
      id: Date.now().toString(),
      status: 'waiting',
      progress: 0,
      createdAt: Date.now()
    }
    setJobs(prev => [...prev, newJob])
    return newJob.id
  }

  // Cancel job
  const cancelJob = async (jobId: string) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId && (job.status === 'waiting' || job.status === 'processing')
        ? { ...job, status: 'cancelled' as JobStatus }
        : job
    ))
    
    if (currentJobId === jobId) {
      await window.electronAPI?.cancelCurrentJob?.()
      setCurrentJobId(null)
    }
  }

  // Remove job (only completed/failed/cancelled jobs)
  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId))
  }



  // Process job
  const processNextJob = async () => {
    if (currentJobId !== null) return // Already processing
    
    const nextJob = jobs.find(job => job.status === 'waiting')
    if (!nextJob) return
    
    setCurrentJobId(nextJob.id)
    const jobStartTime = Date.now()
    setJobs(prev => prev.map(job => 
      job.id === nextJob.id ? { ...job, status: 'processing' as JobStatus, startedAt: jobStartTime } : job
    ))
    
    try {
      let result: string
      let generatedTimestamps: string | undefined
      
      if (nextJob.type === 'music-video') {
        if (!window.electronAPI?.createFromImage) {
          throw new Error('Electron API not available')
        }
        const response = await window.electronAPI.createFromImage({
          imagePath: nextJob.params.imagePath || '',
          audioPath: nextJob.params.audioPath!,
          enablePadding: nextJob.params.enablePadding ?? false,
          paddingDuration: nextJob.params.paddingDuration ?? 3,
          enableFadeOut: nextJob.params.enableFadeOut ?? true,
          fadeOutDuration: nextJob.params.fadeOutDuration ?? 2
        })
        
        // Parse response (may be JSON with timestamps or plain string for backward compatibility)
        try {
          const parsed = JSON.parse(response)
          result = parsed.outputPath || response // Fallback to response if outputPath is missing
          generatedTimestamps = parsed.timestamps
        } catch {
          // Backward compatibility: if not JSON, treat as plain output path
          result = response
        }
        
        // Final validation: ensure result is a string
        if (typeof result !== 'string') {
          console.error('Invalid result type:', typeof result, result)
          result = String(result) // Convert to string as fallback
        }
      } else if (nextJob.type === 'video-loop') {
        if (!window.electronAPI?.processVideo) {
          throw new Error('Electron API not available')
        }
        result = await window.electronAPI.processVideo({
          inputPath: nextJob.params.videoPath as string,
          iterations: nextJob.params.iterations!
        })
      } else if (nextJob.type === 'video-concat') {
        if (!window.electronAPI?.concatVideos) {
          throw new Error('Electron API not available')
        }
        result = await window.electronAPI.concatVideos({
          videoPaths: nextJob.params.videoPath as string[],
          enablePadding: nextJob.params.enablePadding ?? false,
          paddingDuration: nextJob.params.paddingDuration ?? 3,
          enableFadeOut: nextJob.params.enableFadeOut ?? true,
          fadeOutDuration: nextJob.params.fadeOutDuration ?? 2,
          enableFadeIn: nextJob.params.enableFadeIn ?? false,
        })
      } else {
        throw new Error('Unknown job type')
      }
      
      const jobEndTime = Date.now()
      const jobDuration = jobEndTime - jobStartTime
      
      setJobs(prev => prev.map(job =>
        job.id === nextJob.id
          ? { ...job, status: 'completed' as JobStatus, progress: 100, result, completedAt: jobEndTime, timestampText: generatedTimestamps || job.timestampText }
          : job
      ))
      
      // Save to history (completed)
      const inputFiles = extractInputFiles(nextJob)
      
      // Validate result before saving to history
      const validOutputFile = result && typeof result === 'string' ? result : undefined
      
      saveHistory({
        id: nextJob.id,
        type: nextJob.type,
        name: nextJob.name,
        status: 'completed',
        inputFiles,
        outputFile: validOutputFile,
        createdAt: Date.now(),
        duration: jobDuration,  // Add execution time
        params: {
          iterations: nextJob.params.iterations,
          imageUsed: !!nextJob.params.imagePath
        },
        timestampText: generatedTimestamps || nextJob.timestampText // Use generated or preserve existing
      })
      
      // Completion celebration effect (confetti) - improved version
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 }

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)
      
      // Completion notification
      await window.electronAPI.showNotification?.({
        title: t('notifications.jobCompleted'),
        body: t('notifications.jobCompletedBody', { jobName: nextJob.name })
      })
      
      // Toast notification
      showToast({
        type: 'success',
        title: `🎉 ${t('toast.jobCompleted')}`,
        description: nextJob.name,
        duration: 5000
      })
      
    } catch (error) {
      // Error handling
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      
      // Extract error code from message (format: [ERROR_CODE:1234] message)
      const errorCodeMatch = errorMessage.match(/\[ERROR_CODE:(\d+)\]/)
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : undefined
      
      // Extract error ID if present in error message (legacy format)
      const errorIdMatch = errorMessage.match(/Error ID: (ERR_\w+)/)
      const errorId = errorIdMatch ? errorIdMatch[1] : errorCode
      
      const failEndTime = Date.now()
      const failDuration = failEndTime - jobStartTime
      
      setJobs(prev => prev.map(job =>
        job.id === nextJob.id
          ? { ...job, status: 'failed' as JobStatus, error: errorMessage, completedAt: failEndTime }
          : job
      ))
      
      // Save to history (failed)
      const inputFiles = extractInputFiles(nextJob)
      
      saveHistory({
        id: nextJob.id,
        type: nextJob.type,
        name: nextJob.name,
        status: 'failed',
        inputFiles,
        error: errorMessage,
        createdAt: Date.now(),
        duration: failDuration,  // Add execution time
        params: {
          iterations: nextJob.params.iterations,
          imageUsed: !!nextJob.params.imagePath
        },
        timestampText: nextJob.timestampText // Preserve timestamps even on failure
      })
      
      // Show error modal for critical errors
      setCurrentError({
        type: 'videoProcessing',
        message: errorMessage,
        stack: errorStack,
        errorId
      })
      setErrorModalOpen(true)
      
      // Failure notification
      await window.electronAPI?.showNotification?.({
        title: t('notifications.jobFailed'),
        body: t('notifications.jobFailedBody', { jobName: nextJob.name })
      })
      
      // Toast notification
      showToast({
        type: 'error',
        title: t('toast.jobFailed'),
        description: nextJob.name,
        duration: 5000
      })
    } finally {
      setCurrentJobId(null)
      setProgress(0)  // Reset progress for next job
    }
  }

  // Auto-process queue
  useEffect(() => {
    if (!currentJobId && jobs.some(job => job.status === 'waiting')) {
      processNextJob()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, currentJobId])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + O: Open file
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        if (selectedMenu === 'image-music') {
          addAudioFile()
        } else if (selectedMenu === 'loop') {
          selectLoopVideo()
        } else if (selectedMenu === 'concat') {
          addVideoFile()
        }
      }
      
      // Cmd/Ctrl + Enter: Add to queue
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (selectedMenu === 'image-music' && audioFiles.length > 0) {
          handleCreateMusicVideo()
        } else if (selectedMenu === 'loop' && loopFile) {
          handleLoopProcess()
        } else if (selectedMenu === 'concat' && videoFiles.length > 0) {
          handleConcatVideos()
        }
      }
      
      // Escape: Cancel job
      if (e.key === 'Escape' && currentJobId) {
        cancelJob(currentJobId)
      }
      
      // Cmd/Ctrl + ,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setSelectedMenu('settings')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMenu, audioFiles.length, loopFile, videoFiles.length, currentJobId])

  const handleLoopProcess = () => {
    if (!loopFile) return
    
    const fileName = loopFile.split(/[/\\]/).pop() || t('common.video')
    addJob({
      type: 'video-loop',
      name: t('job.loopIterations', { name: fileName, iterations }),
      params: {
        videoPath: loopFile,
        iterations
      }
    })
    showToast({
      type: 'success',
      title: t('toast.addedToQueue', { defaultValue: 'Added to queue' }),
      description: t('toast.jobWillStartSoon', { defaultValue: 'Job will start soon' }),
      duration: 3000
    })
  }

  const handleCreateMusicVideo = () => {
    if (audioFiles.length === 0) return
    
    const musicCount = audioFiles.length
    const jobName = musicCount > 1 
      ? t('job.playlist', { count: musicCount })
      : audioFiles[0].split(/[/\\]/).pop() || t('job.musicVideo')
    
    addJob({
      type: 'music-video',
      name: jobName,
      params: {
        imagePath: bgImage || '',
        audioPath: audioFiles,
        enablePadding: enableMusicPadding && audioFiles.length > 1, // Apply padding only when multiple audio files
        paddingDuration: musicPaddingDuration, // Padding duration
        enableFadeOut: enableMusicFadeOut && audioFiles.length > 1, // Apply fade out only when multiple audio files
        fadeOutDuration: musicFadeOutDuration, // Fade out duration
      }
    })
    showToast({
      type: 'success',
      title: t('toast.addedToQueue', { defaultValue: 'Added to queue' }),
      description: t('toast.jobWillStartSoon', { defaultValue: 'Job will start soon' }),
      duration: 3000
    })
  }

  return (
    <>
      {!isE2E && <TermsModal onAccept={() => {}} />}
      {!isE2E && <OnboardingModal onComplete={() => {}} />}
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      <header className="px-8 py-6 border-b border-slate-800">
        <div className="flex justify-between items-center">
        <div>
            <h1 data-testid="app-title" className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {t('app.title')}
          </h1>
            <p className="text-slate-400 mt-1 text-sm">{t('app.tagline')}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              if (window.electronAPI?.openExternal) {
                try {
                  const result = await window.electronAPI.openExternal('https://buymeacoffee.com/loopmateapp')
                  if (result && 'success' in result && !result.success) {
                    console.error('Failed to open external link:', result.error || 'Unknown error')
                  }
                } catch (error) {
                  console.error('Failed to open external link:', error)
                }
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 transition-colors rounded-md hover:bg-slate-800/50 border border-slate-700/50 hover:border-orange-500/30"
            title={t('buttons.buyMeACoffee')}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('buttons.buyMeACoffee')}</span>
          </button>
        </div>
        </div>
      </header>

      <main className="flex-1 flex w-full mx-auto overflow-hidden">
        {/* Left sidebar menu */}
        <aside className="flex-1 min-w-[280px] max-w-[400px] border-r border-slate-800 p-6 space-y-2 overflow-y-auto">
          <div className="sticky top-0 space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 mb-4">{t('menu.title')}</h2>
          
          <button
            onClick={() => setSelectedMenu('image-music')}
            data-testid="menu-image-music"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              selectedMenu === 'image-music'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Music className="w-5 h-5" />
            <span className="font-medium">{t('menu.imageMusic')}</span>
          </button>
          
          <button
            onClick={() => setSelectedMenu('loop')}
            data-testid="menu-loop"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              selectedMenu === 'loop'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileVideo className="w-5 h-5" />
            <span className="font-medium">{t('menu.loopVideo')}</span>
          </button>
          
          <button
            onClick={() => setSelectedMenu('concat')}
            data-testid="menu-concat"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              selectedMenu === 'concat'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t('menu.concat')}</span>
          </button>
          
          <button
            onClick={() => setSelectedMenu('settings')}
            data-testid="menu-settings"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              selectedMenu === 'settings'
                ? 'bg-orange-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">{t('menu.settings')}</span>
          </button>
          </div>
        </aside>

        {/* Center content area (2x width) */}
        <div className="flex-[2] p-6 overflow-y-auto">
          {/* --- Stepper UI Start --- */}
          {selectedMenu !== 'settings' && (() => {
            // Determine job type for current menu
            const getJobTypeForMenu = (menu: string): JobType | null => {
              switch (menu) {
                case 'image-music':
                  return 'music-video'
                case 'loop':
                  return 'video-loop'
                case 'concat':
                  return 'video-concat'
                default:
                  return null
              }
            }
            
            // Filter only jobs relevant to current tab
            const jobType = getJobTypeForMenu(selectedMenu)
            const relevantJobs = jobType ? jobs.filter(job => job.type === jobType) : []
            const hasCompletedJobs = relevantJobs.some(job => job.status === 'completed' && job.result)
            const hasJobs = relevantJobs.length > 0
            const currentStep = hasCompletedJobs ? 3 : hasJobs ? 2 : 1
            const isProcessing = relevantJobs.some(job => job.status === 'processing' || job.status === 'waiting')
            
            // Define Stepper steps per menu
            const getStepperSteps = () => {
              switch (selectedMenu) {
                case 'image-music':
                  return [
                    { num: 1, label: t('videoGenerator.steps.selectMusic', 'Select Music'), icon: Music },
                    { num: 2, label: t('videoGenerator.steps.generateVideo', 'Generate Video'), icon: Video },
                    { num: 3, label: t('videoGenerator.steps.complete', 'Complete'), icon: CheckCircle2 }
                  ]
                case 'loop':
                  return [
                    { num: 1, label: t('videoLoop.step1', 'Select Video'), icon: VideoIcon },
                    { num: 2, label: t('videoLoop.step2', 'Loop Processing'), icon: Repeat },
                    { num: 3, label: t('videoLoop.step3', 'Complete'), icon: Download }
                  ]
                case 'concat':
                  return [
                    { num: 1, label: t('videoConcat.step1', 'Select Videos'), icon: Files },
                    { num: 2, label: t('videoConcat.step2', 'Concatenation Processing'), icon: Loader2 },
                    { num: 3, label: t('videoConcat.step3', 'Complete'), icon: Download }
                  ]
                default:
                  return []
              }
            }
            
            const steps = getStepperSteps()
            if (steps.length === 0) return null
            
            return (
              <div className="mb-8">
                <div className="flex items-center justify-center gap-4 max-w-3xl mx-auto">
                  {steps.map((step, idx) => (
                    <div key={step.num} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                          currentStep > step.num ? 'bg-emerald-600 text-white' :
                          currentStep === step.num ? 'bg-blue-600 text-white ring-4 ring-blue-200/50' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {currentStep > step.num ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <step.icon className={`h-6 w-6 ${step.num === 2 && currentStep === 2 && isProcessing ? 'animate-spin' : ''}`} />
                          )}
                        </div>
                        <span className={`text-sm mt-2 font-medium ${
                          currentStep >= step.num ? 'text-slate-200' : 'text-slate-400'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`w-16 h-1 mx-2 rounded transition-colors ${
                          currentStep > step.num ? 'bg-emerald-600' : 'bg-slate-700'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* --- Stepper UI End --- */}

          {/* Image + Music menu */}
          {selectedMenu === 'image-music' && (
            <Card data-testid="tab-image-music" className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <Music className="w-5 h-5" /> {t('tabs.imageMusic.title')}
                </CardTitle>
                <CardDescription className="text-slate-400">{t('tabs.imageMusic.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Image selection - drag and drop supported (optional) */}
                <div className="space-y-3">
                  <FileDropZone
                    label={t('labels.selectImage')}
                    subLabel={t('labels.selectImageSub')}
                    acceptedExtensions={fileExtensions.image}
                    currentFile={bgImage}
                    onFileSelect={setBgImage}
                    onManualClick={() => selectFile(setBgImage, 'image')}
                    icon={<ImageIcon className="w-10 h-10" />}
                    colorClass="border-emerald-500"
                    showImagePreview={true}
                    imageDataUrl={bgImageDataUrl}
                    onRemove={() => setBgImage(null)}
                  />
                </div>

                {/* Audio file list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-400">{t('labels.musicPlaylist')}</label>
                    <span className="text-xs text-slate-500">{t('labels.itemsAdded', { count: audioFiles.length })}</span>
                    </div>

                  {/* Add audio button */}
                  <FileDropZone
                    label={t('buttons.addMusic')}
                    subLabel={t('labels.musicPlaylistSub')}
                    acceptedExtensions={fileExtensions.audio}
                    currentFile={null}
                    onFileSelect={addAudioFileByDrop}
                    onManualClick={addAudioFile}
                    icon={<Plus className="w-8 h-8" />}
                    colorClass="border-emerald-500"
                  />

                  {/* Audio list (change order via drag and drop) */}
                  {audioFiles.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                      {audioFiles.map((file, index) => (
                        <div
                          key={`${file}-${index}`}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg cursor-move hover:bg-slate-750 transition-all ${
                            draggedIndex === index ? 'opacity-50 scale-95' : ''
                          }`}
                        >
                          <Music className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-sm text-slate-300 flex-1 truncate">
                            {index + 1}. {file.split(/[/\\]/).pop()}
                      </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                duplicateAudioFile(index)
                              }}
                              className="text-blue-400 hover:text-blue-300 transition-colors px-2"
                              title={t('buttons.duplicate')}
                              aria-label={t('buttons.duplicate')}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeAudioFile(index)}
                              className="text-red-400 hover:text-red-300 transition-colors px-2"
                              title={t('buttons.remove')}
                              aria-label={t('buttons.remove')}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced options */}
                {audioFiles.length > 0 && (
                  <div className="space-y-4">
                    {/* Advanced options toggle button */}
                    <button
                      onClick={() => setShowAdvancedMusicOptions(!showAdvancedMusicOptions)}
                      className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-slate-300">{t('options.advanced')}</span>
                      {showAdvancedMusicOptions ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    
                    {/* Show active options summary when collapsed */}
                    {!showAdvancedMusicOptions && audioFiles.length > 1 && (() => {
                      const activeOptions: string[] = []
                      if (enableMusicFadeOut) {
                        activeOptions.push(t('options.fadeOutShort', { defaultValue: 'Fade Out' }))
                      }
                      if (enableMusicPadding) {
                        activeOptions.push(t('options.paddingShort', { defaultValue: 'Padding' }))
                      }
                      
                      return activeOptions.length > 0 ? (
                        <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                          <div className="text-xs text-slate-400 mb-1">{t('options.activeOptions', { defaultValue: 'Active Options' })}</div>
                          <div className="flex flex-wrap gap-2">
                            {activeOptions.map((option, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30"
                              >
                                {option}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null
                    })()}
                    
                    {/* Advanced options content */}
                    {showAdvancedMusicOptions && (
                      <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                        
                        <div className="space-y-4">
                          {/* Fade out option */}
                          <div className="space-y-2">
                            <label className={`flex items-start gap-3 ${audioFiles.length > 1 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}>
                              <input
                                type="checkbox"
                                checked={enableMusicFadeOut}
                                onChange={(e) => setEnableMusicFadeOut(e.target.checked)}
                                disabled={audioFiles.length <= 1}
                                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${audioFiles.length > 1 ? 'text-slate-200' : 'text-slate-500'}`}>
                                  {t('options.fadeOut')}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {audioFiles.length > 1 
                                    ? t('options.fadeOutDesc')
                                    : t('options.requiresMultipleTracks', { defaultValue: 'Multiple tracks required' })}
                                </div>
                              </div>
                            </label>
                            {enableMusicFadeOut && audioFiles.length > 1 && (
                              <div className="pl-7 flex items-center gap-2">
                                <span className="text-xs text-slate-400">{t('options.fadeOutDuration')}</span>
                                <Input
                                  type="number"
                                  min="0.5"
                                  max="5"
                                  step="0.5"
                                  value={musicFadeOutDuration}
                                  onChange={(e) => setMusicFadeOutDuration(Number(e.target.value))}
                                  className="w-20 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                                />
                                <span className="text-xs text-slate-400">{t('options.seconds')}</span>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-slate-700 my-2"></div>

                          {/* Padding option */}
                          <div className="space-y-2">
                            <label className={`flex items-start gap-3 ${audioFiles.length > 1 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}>
                              <input
                                type="checkbox"
                                checked={enableMusicPadding}
                                onChange={(e) => setEnableMusicPadding(e.target.checked)}
                                disabled={audioFiles.length <= 1}
                                className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${audioFiles.length > 1 ? 'text-slate-200' : 'text-slate-500'}`}>
                                  {t('options.padding')}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {audioFiles.length > 1 
                                    ? t('options.paddingDesc')
                                    : t('options.requiresMultipleTracks', { defaultValue: 'Multiple tracks required' })}
                                </div>
                              </div>
                            </label>
                            {enableMusicPadding && audioFiles.length > 1 && (
                              <div className="pl-7 flex items-center gap-2">
                                <span className="text-xs text-slate-400">{t('options.paddingDuration')}</span>
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  value={musicPaddingDuration}
                                  onChange={(e) => setMusicPaddingDuration(Number(e.target.value))}
                                  className="w-20 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                                />
                                <span className="text-xs text-slate-400">{t('options.secondsSilence')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time preview card */}
                {bgImage && audioFiles.length > 0 && (
                  <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-bold text-emerald-400">{t('preview.title', { defaultValue: 'Preview' })}</h3>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Image preview */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400">{t('preview.backgroundImage', { defaultValue: 'Background Image' })}</div>
                        <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
                          {bgImageDataUrl ? (
                            <img 
                              src={bgImageDataUrl}
                              alt="Preview background"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Audio information */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-400">{t('preview.musicTracks', { defaultValue: 'Music Tracks' })}</div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {audioFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded border border-slate-700">
                              <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs truncate text-slate-300">{file.split(/[/\\]/).pop()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expected result */}
                    <div className="mt-4 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-400">{t('preview.estimatedDuration', { defaultValue: 'Estimated Video Length' })}</span>
                        <span className="font-bold text-emerald-300">
                          {estimatedDuration || (
                            audioFiles.length > 1 
                              ? t('preview.multipleTracks', { count: audioFiles.length, defaultValue: '{{count}} tracks' })
                              : t('preview.audioLength', { defaultValue: 'Determined by audio length' })
                          )}
                        </span>
                      </div>
                      {audioFiles.length > 1 && (
                        <div className="mt-2 text-xs text-emerald-400/70">
                          {t('preview.playlistMode')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                    <p className="text-xs text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4"/>
                        {t('messages.videoCreated')}
                    </p>
                </div>

                <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 text-lg shadow-lg shadow-emerald-900/20"
                    disabled={audioFiles.length === 0}
                    onClick={handleCreateMusicVideo}
                >
                  {audioFiles.length > 0 
                    ? t('buttons.addToQueueWithMusic', { count: audioFiles.length })
                    : t('buttons.addToQueue')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Video loop menu */}
          {selectedMenu === 'loop' && (
            <Card data-testid="tab-loop" className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <FileVideo className="w-5 h-5" /> {t('tabs.loop.title')}
                </CardTitle>
                <CardDescription className="text-slate-400">{t('tabs.loop.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Video selection - drag and drop supported */}
                <FileDropZone
                  label={t('labels.selectLoopVideo')}
                  subLabel={t('labels.videoFileFormats')}
                  acceptedExtensions={fileExtensions.video}
                  currentFile={loopFile}
                  onFileSelect={updateLoopFile}
                  onManualClick={selectLoopVideo}
                  icon={<Plus className="w-8 h-8" />}
                  colorClass="border-blue-500"
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t('labels.iterations')}</label>
                  <Input
                    type="number"
                    className="bg-slate-800 border-slate-700 text-white h-12"
                    value={iterations}
                    onChange={(e) => setIterations(Number(e.target.value))}
                    min={1}
                  />
                </div>

                {/* Show estimated video time */}
                {loopFile && getEstimatedTime() && (
                  <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
                    <p className="text-sm text-blue-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4"/>
                      {t('messages.estimatedTime')} <span className="font-bold">{getEstimatedTime()}</span>
                    </p>
                  </div>
                )}

                {/* Advanced options */}
                {loopFile && (
                  <div className="space-y-4">
                    <button
                      onClick={() => setShowAdvancedLoopOptions(!showAdvancedLoopOptions)}
                      className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-slate-300">{t('options.advanced')}</span>
                      {showAdvancedLoopOptions ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    
                    {showAdvancedLoopOptions && (
                      <div className="space-y-2 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <div className="text-sm text-slate-400">
                          {t('options.noAdvancedOptions', 'No advanced options available for this feature')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-14 text-lg"
                  disabled={!loopFile}
                  onClick={handleLoopProcess}
                >
                  {t('buttons.addToQueue')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Concat menu */}
          {selectedMenu === 'concat' && (
            <Card data-testid="tab-concat" className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-400">
                  <Plus className="w-5 h-5" /> {t('tabs.concat.title')}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {t('tabs.concat.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Video file list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-400">
                      {t('labels.videoList')}
                    </label>
                    <span className="text-xs text-slate-500">{t('labels.itemsAdded', { count: videoFiles.length })}</span>
                  </div>

                  {/* Add video button */}
                  <FileDropZone
                    label={t('buttons.addVideo')}
                    subLabel={videoFiles.length === 0 
                      ? t('labels.videoListSub') 
                      : t('labels.musicPlaylistSub')}
                    acceptedExtensions={fileExtensions.video}
                    currentFile={null}
                    onFileSelect={addVideoFileByDrop}
                    onManualClick={addVideoFile}
                    icon={<Plus className="w-8 h-8" />}
                    colorClass="border-purple-500"
                  />

                  {/* Video list (change order via drag and drop) */}
                  {videoFiles.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-slate-950/50 rounded-lg border border-slate-800">
                      {videoFiles.map((file, index) => (
                        <div
                          key={`${file}-${index}`}
                          draggable
                          onDragStart={() => handleVideoDragStart(index)}
                          onDragOver={(e) => handleVideoDragOver(e, index)}
                          onDragEnd={handleVideoDragEnd}
                          className={`flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-lg cursor-move hover:bg-slate-750 transition-all ${
                            draggedVideoIndex === index ? 'opacity-50 scale-95' : ''
                          }`}
                        >
                          <FileVideo className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="text-sm text-slate-300 flex-1 truncate">
                            {index + 1}. {file.split(/[/\\]/).pop()}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                duplicateVideoFile(index)
                              }}
                              className="text-blue-400 hover:text-blue-300 transition-colors px-2"
                              title={t('buttons.duplicate')}
                              aria-label={t('buttons.duplicate')}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeVideoFile(index)}
                              className="text-red-400 hover:text-red-300 transition-colors px-2"
                              title={t('buttons.remove')}
                              aria-label={t('buttons.remove')}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advanced options */}
                <div className="space-y-4">
                  {/* Advanced options toggle button */}
                  <button
                    onClick={() => setShowAdvancedVideoOptions(!showAdvancedVideoOptions)}
                    className="w-full flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-slate-300">{t('options.advanced')}</span>
                    {showAdvancedVideoOptions ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  
                  {/* Show active options summary when collapsed */}
                  {!showAdvancedVideoOptions && videoFiles.length >= 2 && (() => {
                    const activeOptions: string[] = []
                    if (enableFadeOut) {
                      activeOptions.push(t('options.fadeOutShort', { defaultValue: 'Fade Out' }))
                    }
                    if (enableFadeIn) {
                      activeOptions.push(t('options.fadeInShort', { defaultValue: 'Fade In' }))
                    }
                    if (enablePadding) {
                      activeOptions.push(t('options.paddingShort', { defaultValue: 'Padding' }))
                    }
                    
                    return activeOptions.length > 0 ? (
                      <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/50 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">{t('options.activeOptions', { defaultValue: 'Active Options' })}</div>
                        <div className="flex flex-wrap gap-2">
                          {activeOptions.map((option, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium border border-purple-500/30"
                            >
                              {option}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}
                  
                  {/* Advanced options content */}
                  {showAdvancedVideoOptions && (
                    <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                      
                      <div className="space-y-4">
                        {/* Fade out option */}
                        <div className="space-y-2">
                          <label className={`flex items-start gap-3 ${videoFiles.length >= 2 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={enableFadeOut}
                              onChange={(e) => setEnableFadeOut(e.target.checked)}
                              disabled={videoFiles.length < 2}
                              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${videoFiles.length >= 2 ? 'text-slate-200' : 'text-slate-500'}`}>
                                {t('options.videoFadeOut')}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {videoFiles.length >= 2 
                                  ? t('options.videoFadeOutDesc')
                                  : t('options.requiresMultipleVideos', { defaultValue: 'Multiple videos required' })}
                              </div>
                            </div>
                          </label>
                          {enableFadeOut && videoFiles.length >= 2 && (
                            <div className="pl-7 flex items-center gap-2">
                              <span className="text-xs text-slate-400">{t('options.fadeOutDuration')}</span>
                              <Input
                                type="number"
                                min="0.5"
                                max="5"
                                step="0.5"
                                value={fadeOutDuration}
                                onChange={(e) => setFadeOutDuration(Number(e.target.value))}
                                className="w-20 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                              />
                              <span className="text-xs text-slate-400">{t('options.seconds')}</span>
                            </div>
                          )}
                        </div>

                        {/* Fade in option */}
                        <label className={`flex items-start gap-3 ${videoFiles.length >= 2 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}>
                          <input
                            type="checkbox"
                            checked={enableFadeIn}
                            onChange={(e) => setEnableFadeIn(e.target.checked)}
                            disabled={videoFiles.length < 2}
                            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${videoFiles.length >= 2 ? 'text-slate-200' : 'text-slate-500'}`}>
                              {t('options.fadeIn')}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {videoFiles.length >= 2 
                                ? t('options.fadeInDesc')
                                : t('options.requiresMultipleVideos', { defaultValue: 'Multiple videos required' })}
                            </div>
                          </div>
                        </label>

                        <div className="border-t border-slate-700 my-2"></div>

                        {/* Padding option */}
                        <div className="space-y-2">
                          <label className={`flex items-start gap-3 ${videoFiles.length >= 2 ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={enablePadding}
                              onChange={(e) => setEnablePadding(e.target.checked)}
                              disabled={videoFiles.length < 2}
                              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-600 focus:ring-purple-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${videoFiles.length >= 2 ? 'text-slate-200' : 'text-slate-500'}`}>
                                {t('options.videoPadding')}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {videoFiles.length >= 2 
                                  ? t('options.videoPaddingDesc')
                                  : t('options.requiresMultipleVideos', { defaultValue: 'Multiple videos required' })}
                              </div>
                            </div>
                          </label>
                          {enablePadding && videoFiles.length >= 2 && (
                            <div className="pl-7 flex items-center gap-2">
                              <span className="text-xs text-slate-400">{t('options.paddingDuration')}</span>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={paddingDuration}
                                onChange={(e) => setPaddingDuration(Number(e.target.value))}
                                className="w-20 h-8 bg-slate-700 border-slate-600 text-white text-xs"
                              />
                              <span className="text-xs text-slate-400">{t('options.seconds')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-14 text-lg shadow-lg shadow-purple-900/20"
                  disabled={videoFiles.length < 2}
                  onClick={handleConcatVideos}
                >
                  {videoFiles.length === 0
                    ? t('buttons.addToQueueNeedsVideo')
                    : videoFiles.length === 1
                    ? t('buttons.needsAtLeast2Videos', { defaultValue: 'Need at least 2 videos' })
                    : t('buttons.addToQueueWithVideos', { count: videoFiles.length })}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Settings tab */}
          {selectedMenu === 'settings' && (
            <div data-testid="tab-settings">
              <SettingsTab onDataCleared={handleDataCleared} />
            </div>
          )}

        </div>

        {/* Right job queue/history panel */}
        <RightPanel
          jobs={jobs}
          history={history}
          onCancelJob={cancelJob}
          onRemoveJob={removeJob}
          onDeleteHistoryItem={deleteHistoryItem}
          onClearHistory={clearHistory}
        />
      </main>

      
      {/* Bottom progress area - show currently processing job */}
      {currentJobId && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent border-t border-slate-800 backdrop-blur-lg z-50">
          <div className="max-w-7xl mx-auto p-6">
            <div className="flex items-center gap-6">
              {/* Left: Animation icon */}
              <div className="relative flex-shrink-0">
                {/* Outer rotating ring */}
                <div className="absolute inset-0 rounded-full">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
                      className="text-emerald-500 transition-all duration-300 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                
                {/* Center icon */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center animate-pulse">
                    <Video className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Center: Information */}
              <div className="flex-1 min-w-0">
                {/* Top: Title and percentage */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-lg text-white truncate mb-1">
                      {jobs.find(j => j.id === currentJobId)?.name}
                    </h4>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-emerald-400 font-medium">
                        {getProcessingStage(progress)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {Math.round(progress)}%
                    </div>
                  </div>
                </div>
                
                {/* Bottom: Progress bar */}
                <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-700"></div>
                  
                  {/* Progress bar */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_infinite]"></div>
                    </div>
                    
                    {/* Glowing dot at the end */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-emerald-500/50"></div>
                  </div>
                </div>
              </div>
              
              {/* Right: Cancel button */}
              <button
                onClick={() => {
                  if (window.confirm(t('buttons.cancel'))) {
                    cancelJob(currentJobId)
                  }
                }}
                className="flex-shrink-0 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-500/30 hover:border-red-500/50 font-medium"
              >
                {t('buttons.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Notification */}
      <UpdateNotification />

      {/* Error Modal */}
      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        error={currentError || undefined}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

    </div>
    </>
  )
}