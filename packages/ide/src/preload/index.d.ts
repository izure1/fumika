import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dialog: {
        openDirectory: () => Promise<string | null>
        openFile: (options?: any) => Promise<string[] | null>
      }
      project: {
        scaffold: (targetDir: string, options: { folderName: string, gameName: string, projectId: string, processName: string, width: number, height: number }) => Promise<{ success: boolean; error?: string }>
        load: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        update: (projectPath: string, overrideFiles?: string[]) => Promise<{ success: boolean; error?: string }>
        getFileSpecs: () => Promise<{ success: boolean; specs?: { relativePath: string; label: string; overwriteIfExists: boolean }[] }>
        getTypes: (projectPath: string) => Promise<{ success: boolean; types?: { path: string; content: string }[]; error?: string }>
        checkTypes: (projectPath: string) => Promise<{ success: boolean; errorMap?: Record<string, { line: number; message: string }[]>; error?: string }>
        getTsFileCache: () => Promise<{ success: boolean; files?: { path: string; content: string }[]; error?: string }>
        build: (projectPath: string, options?: { target: string, resizable?: boolean, installer?: boolean, devTools?: boolean }) => Promise<{ success: boolean; error?: string }>
        selectIcon: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        parseScenes: (filePaths: string[], projectPath?: string) => Promise<{
          success: boolean
          scenes?: {
            path: string
            parsed: {
              flowItems: {
                kind: 'label' | 'goto' | 'call' | 'next' | 'condition'
                name?: string
                target?: string
                id?: number
                expression?: string
                line: number
                ifBranch?: any[]
                elseBranch?: any[]
              }[]
              externalConnections: {
                type: 'next' | 'call'
                target: string
                conditional: boolean
              }[]
              error?: string
            }
          }[]
          error?: string
        }>
      }
      preview: {
        start: (projectPath: string, targetScene?: string) => Promise<{ success: boolean; url?: string; error?: string }>
        stop: () => Promise<{ success: boolean; error?: string }>
      }
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean }>
        openPath: (path: string) => Promise<{ success: boolean }>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        setResizable: (resizable: boolean) => Promise<void>
        forceMaximize: () => Promise<void>
        restoreWelcomeSize: () => Promise<void>
      }
      settings: {
        get: () => Promise<{ success: boolean; settings?: any; error?: string }>
        set: (settings: any) => Promise<{ success: boolean; settings?: any; error?: string }>
      }
      fs: {
        checkExists: (path: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>
        readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        readFiles: (paths: string[]) => Promise<{ success: boolean; files?: { path: string; content: string | null }[]; error?: string }>
        writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
        formatCode: (code: string) => Promise<{ success: boolean; content?: string; error?: string }>
        copyFile: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>
        readDir: (path: string, recursive?: boolean) => Promise<{ success: boolean; files?: { name: string; isDirectory: boolean; path: string; children?: any[] }[]; error?: string }>
        renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
        deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>
        deleteDir: (path: string) => Promise<{ success: boolean; error?: string }>
        mkdir: (path: string) => Promise<{ success: boolean; error?: string }>
        onFileChanged: (callback: (data: { path: string; content: string }) => void) => () => void
        onFileDeleted: (callback: (data: { path: string }) => void) => () => void
        onDirDeleted: (callback: (data: { path: string }) => void) => () => void
      }
      output: {
        onOutputLog: (callback: (data: { channel: string; message: string }) => void) => () => void
      }
      updater: {
        checkForUpdates: () => Promise<any>
        quitAndInstall: () => Promise<void>
        getAppVersion: () => Promise<string>
        onCheckingForUpdate: (callback: () => void) => () => void
        onUpdateAvailable: (callback: (info: any) => void) => () => void
        onUpdateNotAvailable: (callback: (info: any) => void) => () => void
        onDownloadProgress: (callback: (progress: any) => void) => () => void
        onUpdateDownloaded: (callback: (info: any) => void) => () => void
        onError: (callback: (error: string) => void) => () => void
      }
    }
  }
}
