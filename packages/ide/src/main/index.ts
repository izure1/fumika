import { app, shell, BrowserWindow, ipcMain, dialog, protocol, Notification } from 'electron'
import path, { join } from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as util from 'node:util'
import sharp from 'sharp'
import prettier from 'prettier'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { scaffoldProject, updateProject, ensureEffectsFiles, buildProject } from './services/project'
import { ProjectWatcher } from './services/watcher'
import { PreviewService } from './services/preview'
import { settingsService } from './services/settings'
import { checkProjectTypes } from './services/typescript'

const watcher = new ProjectWatcher()
const previewService = new PreviewService()
let mainWindow: BrowserWindow | null = null

const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

console.log = (...args) => {
  originalLog(...args)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('output:log', { channel: 'Electron Main (Log)', message: util.format(...args) })
  }
}

console.error = (...args) => {
  originalError(...args)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('output:log', { channel: 'Electron Main (Error)', message: util.format(...args) })
  }
}

console.warn = (...args) => {
  originalWarn(...args)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('output:log', { channel: 'Electron Main (Warn)', message: util.format(...args) })
  }
}

// fetch() API가 local-resource:// 프로토콜을 사용할 수 있도록 사전 등록
// app.whenReady() 이전에 호출해야 합니다.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-resource',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 576,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 로컬 파일 접근을 위한 커스텀 프로토콜 등록
  protocol.registerFileProtocol('local-resource', (request, callback) => {
    try {
      // local-resource:///D:/my-visual-novel/... -> file:///D:/my-visual-novel/...
      const fileUrl = request.url.replace('local-resource://', 'file://')
      const filePath = fileURLToPath(fileUrl)
      callback(filePath)
    } catch (error) {
      console.error('[IDE] Custom protocol error:', error)
    }
  })
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Window Controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:setResizable', (_, resizable: boolean) => {
    mainWindow?.setResizable(resizable)
    mainWindow?.setMaximizable(resizable)
  })

  ipcMain.handle('window:forceMaximize', () => {
    if (mainWindow) {
      mainWindow.setResizable(true)
      mainWindow.setMaximizable(true)
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:restoreWelcomeSize', () => {
    if (mainWindow) {
      mainWindow.setResizable(true)
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      }
      mainWindow.setSize(1024, 576)
      mainWindow.center()
      mainWindow.setResizable(false)
      mainWindow.setMaximizable(false)
    }
  })

  // Project Management IPCs
  ipcMain.handle('dialog:openDirectory', async () => {
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async (_, customOptions?: any) => {
    const options: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'], ...customOptions }
    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    return canceled ? null : filePaths
  })

  ipcMain.handle('project:scaffold', async (_, targetDir: string, options: { folderName: string, gameName: string, projectId: string, processName: string, width: number, height: number }) => {
    try {
      await scaffoldProject(targetDir, options)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:load', async (_, projectPath: string) => {
    try {
      await ensureEffectsFiles(projectPath)
      await watcher.start(projectPath, mainWindow ?? undefined)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:update', async (_, projectPath: string) => {
    try {
      await updateProject(projectPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:selectIcon', async (_, projectPath: string) => {
    try {
      const options = {
        title: '프로젝트 아이콘 선택 (512x512 이상 필수)',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        properties: ['openFile' as const]
      }
      const { canceled, filePaths } = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options)

      if (canceled || filePaths.length === 0) {
        return { success: false, error: '선택이 취소되었습니다.' }
      }

      const selectedImage = filePaths[0]
      const metadata = await sharp(selectedImage).metadata()

      if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 512) {
        return { success: false, error: `선택한 아이콘의 크기가 너무 작습니다. (현재: ${metadata.width}x${metadata.height}, 요구사항: 512x512 이상)` }
      }

      const iconPath = path.join(projectPath, 'assets', 'icon.png')
      await fs.mkdir(path.dirname(iconPath), { recursive: true })
      await fs.copyFile(selectedImage, iconPath)
      
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:build', async (event, projectPath: string, options?: { target: string, resizable?: boolean, installer?: boolean }) => {
    try {
      await watcher.compileAllBlueprints(projectPath)
      const iconPath = path.join(projectPath, 'assets', 'icon.png')
      let hasIcon = true

      try {
        await fs.access(iconPath)
      } catch {
        hasIcon = false
      }

      if ((options?.target === 'windows' || options?.target === 'pwa') && !hasIcon) {
        return { success: false, error: '프로젝트 아이콘이 필요합니다.' }
      }



      const publicDir = path.join(projectPath, 'public')
      await fs.mkdir(publicDir, { recursive: true })
      
      // Favicon용으로 icon.png 복사
      if (hasIcon) {
        await fs.copyFile(iconPath, path.join(publicDir, 'icon.png'))
      }

      if (options?.target === 'pwa' && hasIcon) {
        await sharp(iconPath)
          .resize(192, 192)
          .png()
          .toFile(path.join(publicDir, 'pwa-192x192.png'))

        await sharp(iconPath)
          .resize(512, 512)
          .png()
          .toFile(path.join(publicDir, 'pwa-512x512.png'))
      }

      const outDir = await buildProject(projectPath, options, (msg) => {
        event.sender.send('output:log', { channel: 'Build', message: `${msg}` })
      })
      const fullPath = path.join(projectPath, outDir)
      await shell.openPath(fullPath)
      
      if (Notification.isSupported()) {
        new Notification({
          title: 'Fumika IDE 빌드 완료',
          body: `프로젝트 빌드가 성공적으로 완료되었습니다! (${options?.target?.toUpperCase() || 'WEB'})`,
          icon: hasIcon ? iconPath : icon
        }).show()
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:checkTypes', async (_, projectPath: string) => {
    try {
      const errorMap = await checkProjectTypes(projectPath)
      return { success: true, errorMap }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:getTsFileCache', async () => {
    try {
      const files = await watcher.getCachedFiles()
      return { success: true, files }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('preview:start', async (_, projectPath: string, targetScene?: string) => {
    try {
      await watcher.compileAllBlueprints(projectPath)
      const url = await previewService.start(projectPath, targetScene)
      return { success: true, url }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('preview:stop', async () => {
    try {
      await previewService.stop()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
    return { success: true }
  })

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    await shell.openPath(path)
    return { success: true }
  })

  ipcMain.handle('project:getTypes', async (_, projectPath: string) => {
    try {
      const typesDir = path.join(projectPath, 'node_modules', 'fumika', 'dist', 'types')

      const types: { path: string, content: string }[] = []

      const readTypesRecursively = async (currentPath: string, relativeRoot: string = '') => {
        try {
          const entries = await fs.readdir(currentPath, { withFileTypes: true })
          for (const entry of entries) {
            const entryPath = path.join(currentPath, entry.name)
            const relPath = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name

            if (entry.isDirectory()) {
              await readTypesRecursively(entryPath, relPath)
            } else if (entry.name.endsWith('.d.ts')) {
              const content = await fs.readFile(entryPath, 'utf-8')
              types.push({ path: relPath, content })
            }
          }
        } catch (e) {
          console.error('[IDE] Failed to read types dir:', currentPath, e)
        }
      }

      await readTypesRecursively(typesDir)
      return { success: true, types }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Settings IPCs
  ipcMain.handle('settings:get', async () => {
    return { success: true, settings: settingsService.getSettings() }
  })

  ipcMain.handle('settings:set', async (_, partialSettings: any) => {
    const updated = settingsService.updateSettings(partialSettings)
    return { success: true, settings: updated }
  })

  // File System IPCs
  ipcMain.handle('fs:checkExists', async (_, targetPath: string) => {
    try {
      await fs.access(targetPath)
      return { success: true, exists: true }
    } catch {
      return { success: true, exists: false }
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 여러 파일을 한 번에 읽는 배치 API (IPC 왕복 최소화)
  ipcMain.handle('fs:readFiles', async (_, filePaths: string[]) => {
    try {
      const results = await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            return { path: filePath, content }
          } catch {
            return { path: filePath, content: null }
          }
        })
      )
      return { success: true, files: results }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:formatCode', async (_, code: string) => {
    try {
      const formatted = await prettier.format(code, {
        parser: 'typescript',
        semi: false,
        singleQuote: true,
        trailingComma: 'none',
      })
      return { success: true, content: formatted }
    } catch (error: any) {
      console.error('[IDE] Prettier format error:', error)
      return { success: false, content: code, error: error.message }
    }
  })

  ipcMain.handle('fs:copyFile', async (_, src: string, dest: string) => {
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.copyFile(src, dest)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:renameFile', async (_, oldPath: string, newPath: string) => {
    try {
      await fs.rename(oldPath, newPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:deleteFile', async (_, targetPath: string) => {
    try {
      await fs.unlink(targetPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:deleteDir', async (_, targetPath: string) => {
    try {
      await fs.rm(targetPath, { recursive: true, force: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:mkdir', async (_, targetPath: string) => {
    try {
      await fs.mkdir(targetPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:readDir', async (_, dirPath: string, recursive = false) => {
    try {

      const readRecursively = async (currentPath: string, relativeRoot: string = ''): Promise<any[]> => {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        const result: any[] = []
        for (const entry of entries) {
          const isDir = entry.isDirectory()
          const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, '/')

          // 성능 문제 및 파일 잠금 에러(node_modules)를 방지하기 위해 스킵
          if (isDir && entry.name === 'node_modules' && recursive) {
            result.push({ name: entry.name, isDirectory: isDir, path: relativePath, children: [] })
            continue
          }

          const node = { name: entry.name, isDirectory: isDir, path: relativePath, children: [] as any[] }
          if (isDir && recursive) {
            node.children = await readRecursively(path.join(currentPath, entry.name), relativePath)
          }
          result.push(node)
        }
        return result
      }

      const files = await readRecursively(dirPath)
      return { success: true, files }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
