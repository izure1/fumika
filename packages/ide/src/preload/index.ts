import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    openFile: (options?: any) => ipcRenderer.invoke('dialog:openFile', options)
  },
  project: {
    scaffold: (targetDir: string, options: { folderName: string, gameName: string, projectId: string, processName: string, width: number, height: number }) => ipcRenderer.invoke('project:scaffold', targetDir, options),
    load: (projectPath: string) => ipcRenderer.invoke('project:load', projectPath),
    update: (projectPath: string, overrideFiles: string[] = []) => ipcRenderer.invoke('project:update', projectPath, overrideFiles),
    getFileSpecs: () => ipcRenderer.invoke('project:getFileSpecs'),
    build: (projectPath: string, options?: { target: string, resizable?: boolean, installer?: boolean, devTools?: boolean }) => ipcRenderer.invoke('project:build', projectPath, options),
    selectIcon: (projectPath: string) => ipcRenderer.invoke('project:selectIcon', projectPath),
    getTypes: (projectPath: string) => ipcRenderer.invoke('project:getTypes', projectPath),
    checkTypes: (projectPath: string) => ipcRenderer.invoke('project:checkTypes', projectPath),
    getTsFileCache: () => ipcRenderer.invoke('project:getTsFileCache'),
    parseScenes: (filePaths: string[], projectPath?: string) => ipcRenderer.invoke('project:parseScenes', filePaths, projectPath),
  },
  preview: {
    start: (projectPath: string, targetScene?: string) => ipcRenderer.invoke('preview:start', projectPath, targetScene),
    stop: () => ipcRenderer.invoke('preview:stop')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    setResizable: (resizable: boolean) => ipcRenderer.invoke('window:setResizable', resizable),
    forceMaximize: () => ipcRenderer.invoke('window:forceMaximize'),
    restoreWelcomeSize: () => ipcRenderer.invoke('window:restoreWelcomeSize')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: any) => ipcRenderer.invoke('settings:set', settings)
  },
  fs: {
    checkExists: (path: string) => ipcRenderer.invoke('fs:checkExists', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    readFiles: (paths: string[]) => ipcRenderer.invoke('fs:readFiles', paths),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    formatCode: (code: string) => ipcRenderer.invoke('fs:formatCode', code),
    copyFile: (src: string, dest: string) => ipcRenderer.invoke('fs:copyFile', src, dest),
    readDir: (path: string, recursive?: boolean) => ipcRenderer.invoke('fs:readDir', path, recursive),
    renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
    deleteDir: (path: string) => ipcRenderer.invoke('fs:deleteDir', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    onFileChanged: (callback: (data: { path: string; content: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: { path: string; content: string }) => callback(data)
      ipcRenderer.on('fs:fileChanged', listener)
      return () => ipcRenderer.removeListener('fs:fileChanged', listener)
    },
    onFileDeleted: (callback: (data: { path: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: { path: string }) => callback(data)
      ipcRenderer.on('fs:fileDeleted', listener)
      return () => ipcRenderer.removeListener('fs:fileDeleted', listener)
    },
    onDirDeleted: (callback: (data: { path: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: { path: string }) => callback(data)
      ipcRenderer.on('fs:dirDeleted', listener)
      return () => ipcRenderer.removeListener('fs:dirDeleted', listener)
    }
  },
  output: {
    onOutputLog: (callback: (data: { channel: string; message: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, data: { channel: string; message: string }) => callback(data)
      ipcRenderer.on('output:log', listener)
      return () => ipcRenderer.removeListener('output:log', listener)
    }
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    getAppVersion: () => ipcRenderer.invoke('updater:getAppVersion'),
    onCheckingForUpdate: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('updater:checking-for-update', listener)
      return () => ipcRenderer.removeListener('updater:checking-for-update', listener)
    },
    onUpdateAvailable: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('updater:update-available', listener)
      return () => ipcRenderer.removeListener('updater:update-available', listener)
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('updater:update-not-available', listener)
      return () => ipcRenderer.removeListener('updater:update-not-available', listener)
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      const listener = (_: any, progress: any) => callback(progress)
      ipcRenderer.on('updater:download-progress', listener)
      return () => ipcRenderer.removeListener('updater:download-progress', listener)
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      const listener = (_: any, info: any) => callback(info)
      ipcRenderer.on('updater:update-downloaded', listener)
      return () => ipcRenderer.removeListener('updater:update-downloaded', listener)
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_: any, error: string) => callback(error)
      ipcRenderer.on('updater:error', listener)
      return () => ipcRenderer.removeListener('updater:error', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
