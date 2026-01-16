import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Job, HistoryItem } from '@/types'
import { List, History } from "lucide-react"
import { JobQueuePanel } from "./JobQueuePanel"
import { HistoryPanel } from "./HistoryPanel"

type ViewType = 'queue' | 'history'

interface RightPanelProps {
  jobs: Job[]
  history: HistoryItem[]
  onCancelJob: (jobId: string) => Promise<void>
  onRemoveJob: (jobId: string) => void
  onDeleteHistoryItem: (id: string) => void
  onClearHistory: () => void
}

// Tab button style helper
const getTabButtonStyles = (isActive: boolean, isQueueTab: boolean) => {
  const baseStyles = 'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all'
  
  if (isActive) {
    return isQueueTab
      ? `${baseStyles} bg-emerald-600 text-white`
      : `${baseStyles} bg-slate-700 text-white`
  }
  
  return `${baseStyles} bg-slate-800 text-slate-400 hover:bg-slate-700`
}

// Badge component
interface BadgeProps {
  count: number
  variant?: 'primary' | 'secondary'
}

function Badge({ count, variant = 'secondary' }: BadgeProps) {
  if (count === 0) return null
  
  const styles = variant === 'primary'
    ? 'bg-white text-emerald-600 text-xs font-bold rounded-full px-2 py-0.5'
    : 'text-xs'
  
  return <span className={styles}>{count}</span>
}

// Tab button component
interface TabButtonProps {
  view: ViewType
  currentView: ViewType
  icon: React.ReactNode
  label: string
  count?: number
  showBadge?: boolean
  onClick: () => void
}

function TabButton({ view, currentView, icon, label, count = 0, showBadge = false, onClick }: TabButtonProps) {
  const isActive = view === currentView
  const isQueueTab = view === 'queue'
  
  return (
    <button
      onClick={onClick}
      className={getTabButtonStyles(isActive, isQueueTab)}
      aria-pressed={isActive}
      aria-label={`${label} tab`}
    >
      {icon}
      {label}
      {showBadge && <Badge count={count} variant={isActive ? 'primary' : 'secondary'} />}
    </button>
  )
}

export function RightPanel({
  jobs,
  history,
  onCancelJob,
  onRemoveJob,
  onDeleteHistoryItem,
  onClearHistory
}: RightPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ViewType>('queue')

  // Calculate active job count (memoized)
  const activeJobCount = useMemo(() => {
    return jobs.filter(job => 
      job.status === 'waiting' || job.status === 'processing'
    ).length
  }, [jobs])

  // Calculate history count
  const historyCount = history.length

  return (
    <aside 
      className="flex-1 min-w-[280px] max-w-[400px] border-l border-slate-800 p-6 overflow-y-auto bg-slate-900/30"
      role="complementary"
      aria-label="Job queue and history panel"
    >
      <div className="space-y-4">
        {/* Tab navigation */}
        <nav className="flex gap-2 mb-4" role="tablist" aria-label="Panel views">
          <TabButton
            view="queue"
            currentView={view}
            icon={<List className="w-4 h-4" />}
            label={t('rightPanel.queue')}
            count={activeJobCount}
            showBadge={activeJobCount > 0}
            onClick={() => setView('queue')}
          />
          <TabButton
            view="history"
            currentView={view}
            icon={<History className="w-4 h-4" />}
            label={t('rightPanel.history')}
            count={historyCount}
            showBadge={historyCount > 0}
            onClick={() => setView('history')}
          />
        </nav>

        {/* Panel content */}
        <div role="tabpanel" aria-labelledby={`${view}-tab`}>
          {view === 'queue' && (
            <JobQueuePanel
              jobs={jobs}
              onCancelJob={onCancelJob}
              onRemoveJob={onRemoveJob}
            />
          )}

          {view === 'history' && (
            <HistoryPanel
              history={history}
              onDeleteItem={onDeleteHistoryItem}
              onClearHistory={onClearHistory}
            />
          )}
        </div>
      </div>
    </aside>
  )
}

