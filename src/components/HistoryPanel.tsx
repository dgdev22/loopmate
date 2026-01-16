import { useTranslation } from 'react-i18next'
import { HistoryItem } from '@/types'
import { Button } from "@/components/ui/button"
import { History, Music, FileVideo, Plus, Trash2, X, ExternalLink } from "lucide-react"
import { CopyTimestampsButton } from "./CopyTimestampsButton"

interface HistoryPanelProps {
  history: HistoryItem[]
  onDeleteItem: (id: string) => void
  onClearHistory: () => void
}

export function HistoryPanel({ history, onDeleteItem, onClearHistory }: HistoryPanelProps) {
  const { t, i18n } = useTranslation()

  // Format duration in milliseconds to human-readable string
  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return '—'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      const remainingMinutes = minutes % 60
      const remainingSeconds = seconds % 60
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    } else if (seconds > 0) {
      return `${seconds}s`
    } else {
      return `${ms}ms`
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-400">
            {t('messages.historyCount', { count: history.length })}
          </p>
          {history.filter(h => h.status === 'completed').length > 0 && (
            <span className="text-xs text-emerald-400">
              {t('messages.completedCount', { count: history.filter(h => h.status === 'completed').length })}
            </span>
          )}
          {history.filter(h => h.status === 'failed').length > 0 && (
            <span className="text-xs text-red-400">
              {t('messages.failedCount', { count: history.filter(h => h.status === 'failed').length })}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-950 h-8"
            onClick={onClearHistory}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>{t('messages.noHistory')}</p>
          <p className="text-sm mt-2">{t('messages.historyEmpty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className={`p-3 border rounded-lg hover:border-slate-600 transition-all ${
                item.status === 'failed'
                  ? 'bg-red-950/20 border-red-900/50'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.type === 'music-video' ? <Music className="w-3 h-3 text-emerald-400" /> : 
                     item.type === 'video-loop' ? <FileVideo className="w-3 h-3 text-blue-400" /> :
                     <Plus className="w-3 h-3 text-purple-400" />}
                    <span className="text-sm font-medium text-slate-200 truncate">{item.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      item.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {item.status === 'completed' ? t('status.completed') : t('status.failed')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>
                      {new Date(item.createdAt).toLocaleString(i18n.language, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    {item.duration && (
                      <>
                        <span className="text-slate-700">•</span>
                        <span className="flex items-center gap-1">
                          <span className="text-slate-600">{t('history.duration', 'Execution time')}:</span>
                          <span className={`font-medium ${
                            item.duration < 5000 ? 'text-emerald-400' :    // < 5s - ultra-fast!
                            item.duration < 30000 ? 'text-green-400' :     // < 30s - fast
                            item.duration < 120000 ? 'text-yellow-400' :   // < 2min - normal
                            'text-orange-400'                              // >= 2min - slow
                          }`}>
                            ⚡ {formatDuration(item.duration)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-slate-400 text-xs">
                  {t('job.inputFiles', { count: item.inputFiles.length })}
                </div>

                {item.status === 'completed' && item.outputFile && (
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 h-8 text-xs"
                      onClick={async () => {
                        await window.electronAPI.openFile?.(item.outputFile!)
                      }}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {typeof item.outputFile === 'string' ? item.outputFile.split(/[/\\]/).pop() : 'Output File'}
                    </Button>
                    
                    {/* Copy Timestamps Button for Concat and Playlist Jobs */}
                    {(item.type === 'video-concat' || item.type === 'music-video') && item.timestampText && (
                      <CopyTimestampsButton timestampText={item.timestampText} />
                    )}
                  </div>
                )}

                {item.status === 'failed' && item.error && (
                  <div className="p-2 bg-red-950/30 border border-red-900/50 rounded text-red-400 text-xs">
                    <div className="font-medium mb-1">{t('errors.label')}</div>
                    <div className="text-red-300 break-words">{item.error}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

