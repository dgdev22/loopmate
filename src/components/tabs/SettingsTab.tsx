import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Settings, Info, FolderOpen, Image, Music, Video, AlertTriangle, Volume2, Zap, CheckCircle2 } from "lucide-react"
import { AboutDialog } from "@/components/AboutDialog"
import { useSettingsStore, AudioQualityPreset, AUDIO_QUALITY_PRESETS } from "@/store/useSettingsStore"
import { TagInput } from "@/components/ui/tag-input"
import i18n from '../../i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SettingsTabProps {
  onDataCleared?: () => void
}

export function SettingsTab({
  onDataCleared,
}: SettingsTabProps) {
  const { t } = useTranslation()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const { 
    fileExtensions, 
    loadFileExtensions, 
    saveFileExtensions,
    audioQuality,
    loadAudioQuality,
    saveAudioQuality,
    fastMode,
    loadFastMode,
    saveFastMode
  } = useSettingsStore()
  const [localExtensions, setLocalExtensions] = useState(fileExtensions)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadFileExtensions()
    loadAudioQuality()
    loadFastMode()
  }, [loadFileExtensions, loadAudioQuality, loadFastMode])

  useEffect(() => {
    setLocalExtensions(fileExtensions)
  }, [fileExtensions])

  const handleTagChange = (type: 'image' | 'video' | 'audio', tags: string[]) => {
    setLocalExtensions(prev => ({
      ...prev,
      [type]: tags
    }))
  }

  const handleSaveExtensions = async () => {
    setIsSaving(true)
    try {
      await saveFileExtensions(localExtensions)
    } catch (error) {
      console.error('Failed to save file extensions:', error)
      alert(t('settings.fileExtensions.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetExtensions = () => {
    const defaultExtensions = {
      image: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'],
      video: ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv'],
      audio: ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus', '.aiff', '.aif', '.alac']
    }
    setLocalExtensions(defaultExtensions)
  }

  const handleResetCategory = (type: 'image' | 'video' | 'audio') => {
    const defaultExtensions = {
      image: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'],
      video: ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv'],
      audio: ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma', '.opus', '.aiff', '.aif', '.alac']
    }
    setLocalExtensions(prev => ({
      ...prev,
      [type]: defaultExtensions[type]
    }))
  }

  const handleClearAllData = async () => {
    if (!window.electronAPI?.clearAllData) {
      console.error('clearAllData API not available')
      return
    }

    setIsClearing(true)
    try {
      const result = await window.electronAPI.clearAllData()
      if (result.success) {
        setResetDialogOpen(false)
        if (onDataCleared) {
          onDataCleared()
        }
      } else {
        alert(t('resetData.error'))
      }
    } catch (error) {
      console.error('Failed to clear all data:', error)
      alert(t('resetData.error'))
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-400">
          <Settings className="w-5 h-5" /> {t('tabs.settings.title')}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {t('tabs.settings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-400">{t('settings.language')}</label>
          <Select
            value={i18n.language}
            onValueChange={async (value) => {
              await i18n.changeLanguage(value)
              if (window.electronAPI?.setLanguage) {
                try {
                  await window.electronAPI.setLanguage({ language: value })
                } catch (e) {
                  console.error('Failed to save language:', e)
                }
              }
            }}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ko">Korean</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="zh">中文 (简体)</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="pt">Português</SelectItem>
              <SelectItem value="ru">Русский</SelectItem>
              <SelectItem value="hi">हिन्दी</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="id">Bahasa Indonesia</SelectItem>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="th">ไทย</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fast Mode Settings */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                {t('settings.fastMode.title', '⚡ Fast Mode (Recommended)')}
              </label>
              <p className="text-xs text-slate-500 mt-1">
                {t('settings.fastMode.description', 'Use original audio quality for maximum speed (10-30x faster)')}
              </p>
            </div>
            <Switch
              checked={fastMode}
              onCheckedChange={async (checked) => {
                try {
                  await saveFastMode(checked)
                } catch (e) {
                  console.error('Failed to save fast mode:', e)
                }
              }}
            />
          </div>
          {fastMode && (
            <div className="p-3 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-300">
                  <strong>{t('warnings.fastMode')}:</strong> {t('warnings.fastModeDesc')}
                </div>
              </div>
            </div>
          )}
          {!fastMode && (
            <div className="p-3 bg-orange-900/20 border border-orange-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-orange-300">
                  <strong>{t('warnings.slowProcessing')}:</strong> {t('settings.fastMode.slowWarning', 'Processing will be significantly slower when Fast Mode is disabled.')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Audio Quality Settings */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className={`text-sm font-medium flex items-center gap-2 ${fastMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <Volume2 className="w-4 h-4" />
              {t('settings.audioQuality.title')}
              {fastMode && (
                <span className="text-xs text-slate-500">({t('settings.fastMode.disabled', 'Disabled in Fast Mode')})</span>
              )}
            </label>
          </div>
          <Select
            value={audioQuality}
            disabled={fastMode}
            onValueChange={async (value: AudioQualityPreset) => {
              try {
                await saveAudioQuality(value)
              } catch (e) {
                console.error('Failed to save audio quality:', e)
              }
            }}
          >
            <SelectTrigger className={`bg-slate-800 border-slate-700 ${fastMode ? 'opacity-50 cursor-not-allowed' : 'text-slate-200'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="low">
                {t('settings.audioQuality.low')} (128 kbps)
              </SelectItem>
              <SelectItem value="medium">
                {t('settings.audioQuality.medium')} (192 kbps)
              </SelectItem>
              <SelectItem value="high">
                {t('settings.audioQuality.high')} (256 kbps) ⭐
              </SelectItem>
              <SelectItem value="studio">
                {t('settings.audioQuality.studio')} (320 kbps)
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg space-y-2">
            <p className="text-xs text-slate-400">
              {t('settings.audioQuality.description')}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-900/50 rounded">
                <div className="text-slate-500">{t('settings.audioQuality.codec')}</div>
                <div className="text-slate-300 font-medium">{AUDIO_QUALITY_PRESETS[audioQuality].codec.toUpperCase()}</div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <div className="text-slate-500">{t('settings.audioQuality.bitrate')}</div>
                <div className="text-slate-300 font-medium">{AUDIO_QUALITY_PRESETS[audioQuality].bitrate}</div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <div className="text-slate-500">{t('settings.audioQuality.sampleRate')}</div>
                <div className="text-slate-300 font-medium">{parseInt(AUDIO_QUALITY_PRESETS[audioQuality].sampleRate) / 1000} kHz</div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <div className="text-slate-500">{t('settings.audioQuality.fileSize')}</div>
                <div className="text-slate-300 font-medium">
                  {audioQuality === 'low' && '~1 MB/min'}
                  {audioQuality === 'medium' && '~1.5 MB/min'}
                  {audioQuality === 'high' && '~2 MB/min'}
                  {audioQuality === 'studio' && '~2.5 MB/min'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">{t('settings.fileExtensions.title')}</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetExtensions}
                className="text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white"
              >
                {t('settings.fileExtensions.reset')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveExtensions}
                disabled={isSaving}
                className="text-xs"
              >
                {isSaving ? t('settings.fileExtensions.saving') : t('settings.fileExtensions.save')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-400">{t('settings.fileExtensions.description')}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Image className="w-4 h-4" />
                {t('settings.fileExtensions.image')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('image')}
                className="text-xs h-6 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              >
                {t('settings.fileExtensions.reset')}
              </Button>
            </div>
            <TagInput
              tags={localExtensions.image}
              onTagsChange={(tags) => handleTagChange('image', tags)}
              placeholder="Type extension (e.g., jpg, png) and press Enter"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Video className="w-4 h-4" />
                {t('settings.fileExtensions.video')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('video')}
                className="text-xs h-6 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              >
                {t('settings.fileExtensions.reset')}
              </Button>
            </div>
            <TagInput
              tags={localExtensions.video}
              onTagsChange={(tags) => handleTagChange('video', tags)}
              placeholder="Type extension (e.g., mp4, mov) and press Enter"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Music className="w-4 h-4" />
                {t('settings.fileExtensions.audio')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('audio')}
                className="text-xs h-6 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
              >
                {t('settings.fileExtensions.reset')}
              </Button>
            </div>
            <TagInput
              tags={localExtensions.audio}
              onTagsChange={(tags) => handleTagChange('audio', tags)}
              placeholder="Type extension (e.g., mp3, wav) and press Enter"
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Help & Support Section */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('support.title')}</h3>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={async () => {
              if (window.electronAPI?.openLogFolder) {
                try {
                  await window.electronAPI.openLogFolder()
                } catch (e) {
                  console.error('Failed to open log folder:', e)
                }
              }
            }}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {t('support.openLogs')}
          </Button>
          
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('support.logsDescription')}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              {t('support.supportEmail')}
            </p>
          </div>
        </div>

        {/* Data Reset Section */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('resetData.title')}</h3>
          
          <Button
            variant="destructive"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/50"
            onClick={() => setResetDialogOpen(true)}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            {t('resetData.button')}
          </Button>
          
          <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('resetData.description')}
            </p>
            <ul className="text-xs text-slate-500 mt-2 space-y-1 list-disc list-inside">
              <li>{t('resetData.items.settings')}</li>
              <li>{t('resetData.items.history')}</li>
              <li>{t('resetData.items.queue')}</li>
              <li>{t('resetData.items.onboarding')}</li>
            </ul>
          </div>
        </div>

        {/* About Section */}
        <div className="pt-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={() => setAboutOpen(true)}
          >
            <Info className="w-4 h-4 mr-2" />
            {t('about.title')}
          </Button>
        </div>
      </CardContent>

      {/* About Dialog */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Reset Data Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('resetData.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 pt-2">
              {t('resetData.warning')}
            </AlertDialogDescription>
            <div className="text-slate-300 pt-2 space-y-2">
              <p className="text-sm">{t('resetData.description')}</p>
              <ul className="text-sm space-y-1 list-disc list-inside text-slate-400">
                <li>{t('resetData.items.settings')}</li>
                <li>{t('resetData.items.history')}</li>
                <li>{t('resetData.items.queue')}</li>
                <li>{t('resetData.items.onboarding')}</li>
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
              {t('resetData.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllData}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isClearing ? t('status.processing') : t('resetData.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

