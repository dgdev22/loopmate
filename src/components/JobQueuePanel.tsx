import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Job } from '@/types'

type TFunction = ReturnType<typeof useTranslation>['t']
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { List, Music, FileVideo, X, Copy, Check, Loader2 } from "lucide-react"

interface JobQueuePanelProps {
  jobs: Job[]
  onCancelJob: (jobId: string) => Promise<void>
  onRemoveJob: (jobId: string) => void
}

// Style settings by status
const getJobCardStyles = (status: Job['status']) => {
  const styles = {
    processing: 'bg-emerald-950/30 border-emerald-500',
    completed: 'bg-slate-800 border-slate-700 opacity-60',
    failed: 'bg-red-950/30 border-red-900',
    cancelled: 'bg-slate-800 border-slate-700 opacity-40',
    waiting: 'bg-slate-800 border-slate-700',
    interrupted: 'bg-slate-800 border-slate-700'
  }
  return styles[status] || styles.waiting
}

const getStatusBadgeStyles = (status: Job['status']) => {
  const styles = {
    processing: 'bg-emerald-500 text-white',
    waiting: 'bg-blue-500 text-white',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
    failed: 'bg-red-500 text-white',
    interrupted: 'bg-orange-500 text-white',
    cancelled: 'bg-slate-600 text-slate-400'
  }
  return styles[status] || styles.cancelled
}

const getJobTypeStyles = (type: Job['type']) => {
  const styles = {
    'music-video': {
      container: 'bg-emerald-950/50 border border-emerald-500/30',
      icon: 'text-emerald-400'
    },
    'video-loop': {
      container: 'bg-blue-950/50 border border-blue-500/30',
      icon: 'text-blue-400'
    },
    'video-concat': {
      container: 'bg-purple-950/50 border border-purple-500/30',
      icon: 'text-purple-400'
    }
  }
  return styles[type] || styles['video-concat']
}

// Thumbnail component
function JobThumbnail({ job }: { job: Job }) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const hasImage = job.type === 'music-video' && job.params.imagePath
  const typeStyles = getJobTypeStyles(job.type)

  useEffect(() => {
    if (hasImage && window.electronAPI?.getImageDataUrl && job.params.imagePath) {
      setIsLoading(true)
      window.electronAPI.getImageDataUrl(job.params.imagePath)
        .then((result: { success: boolean; dataUrl?: string; error?: string }) => {
          if (result.success && result.dataUrl) {
            setImageDataUrl(result.dataUrl)
          }
          setIsLoading(false)
        })
        .catch(() => {
          setIsLoading(false)
        })
    }
  }, [hasImage, job.params.imagePath])

  if (hasImage) {
    return (
      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
        {imageDataUrl ? (
          <img
            src={imageDataUrl}
            alt="Job thumbnail"
            className="w-full h-full object-cover"
          />
        ) : isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${typeStyles.container}`}>
            <Music className={`w-6 h-6 ${typeStyles.icon}`} />
          </div>
        )}
      </div>
    )
  }

  const IconComponent = job.type === 'music-video' ? Music : FileVideo

  return (
    <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center ${typeStyles.container}`}>
      <IconComponent className={`w-8 h-8 ${typeStyles.icon}`} />
    </div>
  )
}

// Job detail info component
function JobDetails({ job, t }: { job: Job; t: TFunction }) {
  const getDetailText = () => {
    if (job.type === 'music-video' && job.params.audioPath) {
      const count = Array.isArray(job.params.audioPath) ? job.params.audioPath.length : 1
      return count > 1 ? `${count} ${t('common.tracks')}` : t('common.singleTrack')
    }

    if (job.type === 'video-loop' && job.params.iterations) {
      return `${job.params.iterations} ${t('common.iterations')}`
    }

    if (job.type === 'video-concat' && job.params.videoPath) {
      const count = Array.isArray(job.params.videoPath) ? job.params.videoPath.length : 1
      return count > 1 ? `${count} ${t('common.videos')}` : t('common.singleVideo')
    }

    return null
  }

  const detailText = getDetailText()

  return (
    <>
      {detailText && (
        <p className="text-xs text-slate-400">{detailText}</p>
      )}

      {job.result && (
        <p className="text-xs text-slate-400 mt-1 truncate">
          {t('job.savedLocation')}: {typeof job.result === 'string' ? job.result.split(/[/\\]/).pop() : 'Output File'}
        </p>
      )}

      {job.error && (
        <p className="text-xs text-red-400 mt-1 line-clamp-2">
          {t('job.error')}: {job.error}
        </p>
      )}
    </>
  )
}

// Job action buttons component
function JobActions({ job, onCancelJob, onRemoveJob, t }: {
  job: Job
  onCancelJob: (id: string) => Promise<void>
  onRemoveJob: (id: string) => void
  t: TFunction
}) {
  const isActive = job.status === 'waiting' || job.status === 'processing'
  const isFinished = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'

  if (!isActive && !isFinished) return null

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {isActive && (
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-950 h-7 w-7 p-0"
          onClick={() => onCancelJob(job.id)}
          title={t('buttons.cancel')}
          aria-label={t('buttons.cancel')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}

      {isFinished && (
        <Button
          size="sm"
          variant="ghost"
          className="text-slate-400 hover:text-slate-300 h-7 w-7 p-0"
          onClick={() => onRemoveJob(job.id)}
          title={t('buttons.remove')}
          aria-label={t('buttons.remove')}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

// Timestamp Snippet component
function TimestampSnippet({ timestampText, t }: { timestampText: string; t: TFunction }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!timestampText) return

    try {
      await navigator.clipboard.writeText(timestampText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = timestampText
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        textArea.setAttribute('aria-hidden', 'true')
        document.body.appendChild(textArea)
        textArea.select()

        const success = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
      }
    }
  }

  return (
    <div className="mt-3 space-y-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300">
          {t('timestamps.title')}
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-slate-400 hover:text-purple-400 hover:bg-purple-950/50"
          onClick={handleCopy}
          title={copied ? t('timestamps.copied') : t('timestamps.copy')}
          aria-label={copied ? t('timestamps.copied') : t('timestamps.copy')}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
      <textarea
        readOnly
        value={timestampText}
        className="w-full h-32 p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
        style={{ fontFamily: 'monospace' }}
        aria-label={t('timestamps.title')}
      />
    </div>
  )
}

// Individual job card component
function JobCard({ job, onCancelJob, onRemoveJob, t }: {
  job: Job
  onCancelJob: (id: string) => Promise<void>
  onRemoveJob: (id: string) => void
  t: TFunction
}) {
  const statusTranslationKey = `status.${job.status}`

  return (
    <div className={`p-4 border rounded-lg transition-all ${getJobCardStyles(job.status)}`}>
      <div className="flex items-start gap-4">
        <JobThumbnail job={job} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">{job.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${getStatusBadgeStyles(job.status)}`}>
                  {t(statusTranslationKey)}
                </span>
              </div>

              <JobDetails job={job} t={t} />
            </div>

            <JobActions
              job={job}
              onCancelJob={onCancelJob}
              onRemoveJob={onRemoveJob}
              t={t}
            />
          </div>
        </div>
      </div>

      {job.status === 'processing' && (
        <div className="mt-3">
          <Progress value={job.progress} className="h-2" />
          <p className="text-xs text-emerald-400 mt-1">{job.progress}%</p>
        </div>
      )}

      {job.status === 'completed' && (job.type === 'video-concat' || job.type === 'music-video') && job.timestampText && (
        <TimestampSnippet timestampText={job.timestampText} t={t} />
      )}
    </div>
  )
}

// Empty state component
function EmptyState({ t }: { t: TFunction }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <List className="w-16 h-16 mx-auto mb-4 opacity-20" />
      <p>{t('messages.noJobs')}</p>
      <p className="text-sm mt-2">{t('messages.jobsEmpty')}</p>
    </div>
  )
}

// Main component
export function JobQueuePanel({ jobs, onCancelJob, onRemoveJob }: JobQueuePanelProps) {
  const { t } = useTranslation()
  const waitingCount = jobs.filter(j => j.status === 'waiting').length

  return (
    <>
      <p className="text-sm text-slate-400 mb-4">
        {t('common.waitingCount', { count: waitingCount })}
      </p>

      {jobs.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-3">
          {[...jobs].reverse().map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onCancelJob={onCancelJob}
              onRemoveJob={onRemoveJob}
              t={t}
            />
          ))}
        </div>
      )}
    </>
  )
}