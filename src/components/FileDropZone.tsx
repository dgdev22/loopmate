import { useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { UploadCloud, AlertCircle, Eye, X, CheckCircle2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileDropZoneProps {
  label: string
  subLabel?: string
  acceptedExtensions: string[]
  currentFile: string | null
  onFileSelect: (path: string) => void
  onManualClick: () => void
  icon?: React.ReactNode
  colorClass?: string
  // Image preview related (optional)
  showImagePreview?: boolean
  imageDataUrl?: string | null
  onRemove?: () => void
}

// File type extension for electron file path
interface ElectronFile extends File {
  path?: string
}

export function FileDropZone({
  label,
  subLabel,
  acceptedExtensions,
  currentFile,
  onFileSelect,
  onManualClick,
  icon,
  colorClass = "border-blue-500",
  showImagePreview = false,
  imageDataUrl = null,
  onRemove
}: FileDropZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descriptionId = useId()
  const liveRegionId = useId()
  const errorId = useId()

  // Helper function to extract filename from path
  const getFileName = (filePath: string): string => {
    return filePath.split(/[/\\]/).pop() || ''
  }

  // Helper to get color variant classes
  const getColorClasses = () => {
    const colorMap: Record<string, { border: string; text: string; bg: string }> = {
      'border-blue-500': { border: 'border-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
      'border-green-500': { border: 'border-green-500', text: 'text-green-400', bg: 'bg-green-500/10' },
      'border-purple-500': { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/10' },
      'border-orange-500': { border: 'border-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' },
    }
    return colorMap[colorClass] || colorMap['border-blue-500']
  }

  const colors = getColorClasses()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setError(null)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as ElectronFile
      const fileName = file.name.toLowerCase()

      const isValid = acceptedExtensions.some(ext =>
        fileName.endsWith(ext.toLowerCase())
      )

      if (isValid) {
        const filePath = file.path
        if (filePath) {
          onFileSelect(filePath)
          setError(null)
        } else {
          setError(t('fileDropZone.noPathError'))
        }
      } else {
        setError(
          t('common.invalidFileFormat', {
            extensions: acceptedExtensions.join(', ')
          })
        )
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onManualClick()
    }
  }

  const ariaLabel = currentFile
    ? t('fileDropZone.selectedFile', {
        fileName: getFileName(currentFile),
        label
      })
    : t('fileDropZone.selectFile', {
        label,
        extensions: acceptedExtensions.join(', ')
      })

  const descriptionText = currentFile
    ? t('fileDropZone.currentFile', { fileName: getFileName(currentFile) })
    : subLabel || t('fileDropZone.allowedFormats', {
        extensions: acceptedExtensions.join(', ')
      })

  // Check if in image preview mode
  const isImagePreviewMode = showImagePreview && currentFile

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative group"
      role="region"
      aria-label={t('fileDropZone.regionLabel', { label })}
    >
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isDragging && t('fileDropZone.dragActive')}
        {error && t('fileDropZone.errorOccurred')}
      </div>

      {isImagePreviewMode ? (
        // Image preview mode
        <div className={cn(
          "relative w-full h-48 bg-slate-900 rounded-lg border-2 overflow-hidden group",
          isDragging ? `${colors.border} border-dashed` : colors.border
        )}>
          {imageDataUrl ? (
            <img 
              src={imageDataUrl}
              alt={t('preview.backgroundImage', { defaultValue: 'Selected image preview' })}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className={cn("w-12 h-12 mb-2 animate-spin", colors.text)} />
              <p className="text-sm">{t('common.loading', { defaultValue: 'Loading...' })}</p>
            </div>
          )}
          
          {/* Checkmark badge */}
          <div className={cn("absolute top-2 left-2 rounded-full p-1.5 shadow-lg", colors.border.replace('border-', 'bg-'))}>
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          
          {/* File name display */}
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-300 truncate">
            {getFileName(currentFile)}
          </div>
          
          {/* Action button on hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
            {window.electronAPI?.openFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  window.electronAPI.openFile!(currentFile)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                aria-label={t('common.openFile', { defaultValue: 'Open file' })}
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">{t('buttons.openFile', { defaultValue: 'Open' })}</span>
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onManualClick()
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white",
                colors.border.replace('border-', 'bg-').replace('-500', '-600'),
                colors.border.replace('border-', 'hover:bg-').replace('-500', '-500')
              )}
              aria-label={t('buttons.change', { defaultValue: 'Change' })}
            >
              <UploadCloud className="w-4 h-4" />
              <span className="text-sm font-medium">{t('buttons.change', { defaultValue: 'Change' })}</span>
            </button>
            
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                aria-label={t('buttons.remove', { defaultValue: 'Remove' })}
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">{t('buttons.remove')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        // Default upload mode
        <Button
          variant="outline"
          onClick={onManualClick}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
          aria-invalid={!!error}
          className={cn(
            "w-full h-40 border-dashed border-2 flex flex-col gap-3 transition-all duration-200",
            "bg-slate-800/30 text-slate-400",
            isDragging && `bg-slate-800 border-solid ${colors.border} ${colors.text} ${colors.bg}`,
            !isDragging && !currentFile && "border-slate-700 hover:bg-slate-800",
            currentFile && `border-solid ${colors.border} bg-slate-800/50`,
            error && "border-red-500 bg-red-500/10",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          )}
        >
          <div
            className={cn(
              "transition-transform duration-200",
              isDragging && "scale-110",
              error && "text-red-400"
            )}
            aria-hidden="true"
          >
            {error ? (
              <AlertCircle className="w-10 h-10" />
            ) : (
              icon || <UploadCloud className="w-10 h-10" />
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className="font-bold text-base">{label}</span>
            <span
              id={descriptionId}
              className="text-xs text-slate-500 mt-1 max-w-[200px] truncate px-2"
            >
              {currentFile
                ? getFileName(currentFile)
                : isDragging
                  ? t('common.dropHere')
                  : descriptionText}
            </span>
          </div>
        </Button>
      )}

      {error && (
        <Alert
          variant="destructive"
          className="mt-2"
          id={errorId}
          role="alert"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}