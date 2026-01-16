import { Component, ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, FolderOpen, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getPlatformCode } from '@/lib/utils'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
}

// Generate unique error ID for user reference with platform info
function generateErrorId(): string {
  const platform = getPlatformCode()
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ERR_${platform}_${timestamp}_${random}`
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: generateErrorId()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and send to main process logger
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
    
    // Log to main process if available
    if (window.electronAPI?.log) {
      window.electronAPI.log.error(`[ErrorBoundary] [${this.state.errorId}] React Error:`, error.message)
      window.electronAPI.log.error(`[ErrorBoundary] [${this.state.errorId}] Stack:`, error.stack)
      window.electronAPI.log.error(`[ErrorBoundary] [${this.state.errorId}] Component Stack:`, errorInfo.componentStack)
    }

    this.setState({
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  onReset: () => void
}

function ErrorFallback({ error, errorId, onReset }: ErrorFallbackProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopyErrorId = async () => {
    try {
      await navigator.clipboard.writeText(errorId)
      setCopied(true)
    } catch (err) {
      console.error('Failed to copy error ID:', err)
    }
  }

  const handleOpenLogFolder = async () => {
    if (window.electronAPI?.openLogFolder) {
      try {
        await window.electronAPI.openLogFolder()
      } catch (err) {
        console.error('Failed to open log folder:', err)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <Card className="bg-slate-900 border-slate-800 text-slate-50 max-w-2xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {t('errorBoundary.title')}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {t('errorBoundary.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Code/ID */}
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{t('errors.errorId')}</p>
                <p className="text-sm font-mono text-slate-200">{errorId}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyErrorId}
                className="text-slate-400 hover:text-slate-200"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    {t('errors.copyErrorId')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">{t('errorBoundary.errorMessage')}</p>
              <p className="text-sm text-slate-200 font-mono break-words">{error.message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={onReset}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('errorBoundary.tryAgain')}
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenLogFolder}
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {t('errors.openLogFolder')}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('errorBoundary.helpText')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ErrorBoundaryClass

