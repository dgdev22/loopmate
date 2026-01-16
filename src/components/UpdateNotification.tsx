import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { X, Download, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"

type UpdateStatus = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface UpdateNotificationProps {
  onDismiss?: () => void
}

export function UpdateNotification({ onDismiss }: UpdateNotificationProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cleanups: (() => void)[] = []

    if (window.electronAPI?.onUpdateAvailable) {
      const cleanup = window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
        setUpdateInfo(info)
        setStatus('available')
        setError(null)
      })
      if (cleanup) cleanups.push(cleanup)
    }

    if (window.electronAPI?.onUpdateNotAvailable) {
      const cleanup = window.electronAPI.onUpdateNotAvailable(() => {
        setStatus('idle')
      })
      if (cleanup) cleanups.push(cleanup)
    }

    if (window.electronAPI?.onUpdateDownloaded) {
      const cleanup = window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
        setUpdateInfo(info)
        setStatus('downloaded')
        setDownloadProgress(100)
        setError(null)
      })
      if (cleanup) cleanups.push(cleanup)
    }

    if (window.electronAPI?.onDownloadProgress) {
      const cleanup = window.electronAPI.onDownloadProgress((progress: { percent: number; transferred: number; total: number }) => {
        setDownloadProgress(progress.percent)
        setStatus('downloading')
      })
      if (cleanup) cleanups.push(cleanup)
    }

    if (window.electronAPI?.onUpdaterError) {
      const cleanup = window.electronAPI.onUpdaterError((error: { message: string; stack?: string }) => {
        setError(error.message)
        setStatus('error')
        console.error('Updater error:', error)
      })
      if (cleanup) cleanups.push(cleanup)
    }

    // Cleanup
    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [])

  const handleDownload = async () => {
    if (window.electronAPI?.downloadUpdate) {
      setStatus('downloading')
      setDownloadProgress(0)
      try {
        const result = await window.electronAPI.downloadUpdate()
        if (!result.success) {
          setError(result.error || t('updater.downloadFailed'))
          setStatus('error')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('updater.downloadFailed'))
        setStatus('error')
      }
    }
  }

  const handleRestart = async () => {
    if (window.electronAPI?.quitAndInstall) {
      try {
        await window.electronAPI.quitAndInstall()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('updater.restartFailed'))
        setStatus('error')
      }
    }
  }

  const handleDismiss = () => {
    setStatus('idle')
    setUpdateInfo(null)
    setDownloadProgress(0)
    setError(null)
    onDismiss?.()
  }

  if (status === 'idle' && !error) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {status === 'downloaded' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {status === 'downloading' && <Download className="w-5 h-5 text-blue-400 animate-pulse" />}
          {status === 'available' && <RefreshCw className="w-5 h-5 text-blue-400" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
          <h3 className="font-semibold text-slate-200">
            {status === 'downloaded' && t('updater.ready')}
            {status === 'downloading' && t('updater.downloading')}
            {status === 'available' && t('updater.available')}
            {status === 'error' && t('updater.error')}
          </h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Update Info */}
      {updateInfo && (
        <div className="text-sm text-slate-400">
          {t('updater.version')}: <span className="text-slate-300 font-medium">{updateInfo.version}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
          {error}
        </div>
      )}

      {/* Download Progress */}
      {status === 'downloading' && (
        <div className="space-y-2">
          <Progress value={downloadProgress} className="h-2" />
          <div className="text-xs text-slate-400 text-center">
            {Math.round(downloadProgress)}%
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status === 'available' && (
          <Button
            onClick={handleDownload}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('updater.download')}
          </Button>
        )}

        {status === 'downloaded' && (
          <Button
            onClick={handleRestart}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('updater.restart')}
          </Button>
        )}

        {status === 'error' && (
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {t('common.close')}
          </Button>
        )}
      </div>
    </div>
  )
}

