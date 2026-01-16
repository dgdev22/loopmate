import { ipcMain, dialog } from 'electron'

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi'] }]
  })
  if (!canceled) {
    return filePaths[0]
  }
})