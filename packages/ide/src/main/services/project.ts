import { promises as fs } from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import prettier from 'prettier'

const DEFAULT_FOLDERS = [
  'assets',
  'scenes',
  'characters',
  'modules',
  'declarations',
  'backgrounds',
  'effects',
  'fallbacks'
]

import { getNovelConfigContent, MAIN_TS_CONTENT, getIndexHtmlContent, getDeclarationTemplate, EFFECT_TYPES, getInitialEffectContent, getViteConfigContent } from '../../shared/templates'

export interface ProjectOptions {
  gameName: string
  projectId: string
  processName: string
  width: number
  height: number
}

export async function ensureEffectsFiles(targetDir: string) {
  const effectsDir = path.join(targetDir, 'effects')
  try {
    await fs.access(effectsDir)
  } catch {
    await fs.mkdir(effectsDir, { recursive: true })
  }

  for (const effectType of EFFECT_TYPES) {
    const filePath = path.join(effectsDir, `${effectType}.ts`)
    try {
      await fs.access(filePath)
    } catch {
      let content = getInitialEffectContent(effectType)
      try {
        content = await prettier.format(content, {
          parser: 'typescript',
          semi: false,
          singleQuote: true,
          trailingComma: 'none'
        })
      } catch (e) {
        console.warn('[IDE] Failed to format effect file:', e)
      }
      await fs.writeFile(filePath, content, 'utf-8')
    }
  }
}


export async function ensureProjectDependencies(targetDir: string, processName?: string, forceUpdate = false): Promise<void> {
  const packageJsonPath = path.join(targetDir, 'package.json')
  let needsInstall = false

  try {
    await fs.access(packageJsonPath)
    try {
      await fs.access(path.join(targetDir, 'node_modules', 'fumika'))
    } catch {
      needsInstall = true
    }
  } catch {
    needsInstall = true
    const pkg = {
      name: processName || path.basename(targetDir).replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'fumika-project',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build'
      }
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8')
  }

  const tsconfigPath = path.join(targetDir, 'tsconfig.json')
  try {
    await fs.access(tsconfigPath)
  } catch {
    const tsconfig = {
      compilerOptions: {
        target: 'ESNext',
        useDefineForClassFields: true,
        module: 'ESNext',
        lib: ['ESNext', 'DOM'],
        moduleResolution: 'bundler',
        paths: {
          '@/*': ['./*']
        },
        strict: true,
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        noEmit: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: true
      },
      include: ['**/*.ts']
    }
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf-8')
  }

  if (needsInstall || forceUpdate) {
    console.log('[IDE] Installing fumika and vite from npm to', targetDir)
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

    await new Promise<void>((resolve, reject) => {
      execFile(npmCmd, ['install', 'fumika'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[IDE] npm install fumika failed:', stderr)
          reject(err)
        } else {
          execFile(npmCmd, ['install', '--save-dev', 'vite', 'typescript@6', 'vite-plugin-pwa', '@types/node'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
            if (err) {
              console.error('[IDE] npm install vite failed:', stderr)
              reject(err)
            } else {
              console.log('[IDE] Dependencies installed from npm')
              resolve()
            }
          })
        }
      })
    })
  }
}

export async function ensureProjectStructure(targetDir: string, options?: Partial<ProjectOptions>): Promise<void> {
  for (const folder of DEFAULT_FOLDERS) {
    const dirPath = path.join(targetDir, folder)
    await fs.mkdir(dirPath, { recursive: true })
  }

  const declareFiles = ['assets', 'scenes', 'characters', 'modules', 'backgrounds', 'effects', 'fallbacks', 'audios']
  for (const file of declareFiles) {
    const filePath = path.join(targetDir, 'declarations', `${file}.ts`)
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, getDeclarationTemplate(file as any), 'utf-8')
    }
  }

  const typesDeclPath = path.join(targetDir, 'declarations', 'types.d.ts')
  try {
    await fs.access(typesDeclPath)
  } catch {
    await fs.writeFile(typesDeclPath, getDeclarationTemplate('types'), 'utf-8')
  }

  await ensureEffectsFiles(targetDir)

  // 기본 설정 파일 및 코어 파일 생성
  const width = options?.width ?? 1920
  const height = options?.height ?? 1080
  const gameName = options?.gameName ?? 'My Novel Project'

  const configPath = path.join(targetDir, 'novel.config.ts')
  const mainPath = path.join(targetDir, 'main.ts')

  try {
    await fs.access(configPath)
  } catch {
    await fs.writeFile(configPath, getNovelConfigContent(width, height), 'utf-8')
  }

  try {
    await fs.access(mainPath)
  } catch {
    await fs.writeFile(mainPath, MAIN_TS_CONTENT, 'utf-8')
  }

  const indexPath = path.join(targetDir, 'index.html')
  try {
    await fs.access(indexPath)
  } catch {
    await fs.writeFile(indexPath, getIndexHtmlContent(gameName), 'utf-8')
  }

  const licensePath = path.join(targetDir, 'LICENSE')
  try {
    await fs.access(licensePath)
  } catch {
    const MIT_LICENSE = `MIT License

Copyright (c) ${new Date().getFullYear()}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
    await fs.writeFile(licensePath, MIT_LICENSE, 'utf-8')
  }

  const viteConfigPath = path.join(targetDir, 'vite.config.ts')
  try {
    await fs.access(viteConfigPath)
  } catch {
    await fs.writeFile(viteConfigPath, getViteConfigContent(), 'utf-8')
  }
}

export async function updateProject(targetDir: string): Promise<void> {
  await ensureProjectStructure(targetDir)
  // Force update by passing true
  await ensureProjectDependencies(targetDir, undefined, true)
}

/**
 * 스캐폴딩: 대상 디렉토리에 빈 프로젝트 구조를 생성합니다.
 */
export async function scaffoldProject(targetDir: string, options: ProjectOptions): Promise<void> {
  await ensureProjectStructure(targetDir, options)
  await ensureProjectDependencies(targetDir, options.processName)
}

async function copyProjectAssets(targetDir: string, outDir: string) {
  // TS 소스 코드(backgrounds, effects 등)는 Vite가 번들링하므로 제외하고,
  // 순수 미디어 파일들이 담긴 assets 폴더만 복사합니다.
  const assetFolders = ['assets']
  for (const folder of assetFolders) {
    const src = path.join(targetDir, folder)
    const dest = path.join(targetDir, outDir, folder)
    try {
      await fs.access(src)
      await fs.cp(src, dest, { recursive: true })
    } catch {
      // Folder might not exist, just ignore
    }
  }
}

/**
 * 프로젝트 빌드 (Vite 정적 웹 빌드 및 플랫폼별 패키징)
 */
export async function buildProject(targetDir: string, options?: { target: string, resizable?: boolean }): Promise<string> {
  const isPwa = options?.target === 'pwa'
  const isWindows = options?.target === 'windows'
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  if (isPwa) {
    console.log('[IDE] Ensuring vite-plugin-pwa is installed for PWA build...')
    await new Promise<void>((resolve, reject) => {
      execFile(npmCmd, ['install', '--save-dev', 'vite-plugin-pwa'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[IDE] npm install vite-plugin-pwa failed:', stderr)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // 항상 최신 템플릿으로 vite.config.ts를 덮어씁니다. (구버전 충돌 방지)
  const viteConfigPath = path.join(targetDir, 'vite.config.ts')
  await fs.writeFile(viteConfigPath, getViteConfigContent({ pwa: isPwa }), 'utf-8')

  // 하위 호환성을 위해 package.json에 build 스크립트가 없다면 추가
  const packageJsonPath = path.join(targetDir, 'package.json')
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    if (!pkg.scripts?.build) {
      pkg.scripts = pkg.scripts || {}
      pkg.scripts.build = 'vite build'
      await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8')
    }
  } catch (e) {
    console.warn('[IDE] Failed to verify package.json for build script:', e)
  }

  return new Promise<string>((resolve, reject) => {
    const env = { ...process.env }
    let isLibraryTs = false

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    env.BUILD_TIME = timestamp
    const outDir = `dist/${timestamp}`

    if (options?.target) {
      if (options.target === 'library-ts' || options.target === 'library-js') {
        env.BUILD_TARGET = 'library'
      } else {
        env.BUILD_TARGET = options.target
      }

      if (options.target === 'library-ts') {
        isLibraryTs = true
      }
    }

    execFile(npmCmd, ['run', 'build'], { cwd: targetDir, env, shell: true }, async (err, stdout, stderr) => {
      if (err) {
        console.error('[IDE] Build failed:', stderr)
        reject(err)
      } else {
        console.log('[IDE] Vite build success:', stdout)

        if (isLibraryTs) {
          try {
            console.log('[IDE] Starting TSC declaration generation...')
            const tsconfigBuildPath = path.join(targetDir, 'tsconfig.build.json')
            const tsconfigBuildContent = JSON.stringify({
              extends: "./tsconfig.json",
              compilerOptions: {
                noEmit: false,
                declaration: true,
                emitDeclarationOnly: true,
                noEmitOnError: false,
                outDir: `./${outDir}/types`
              },
              include: ["**/*.ts"]
            }, null, 2)
            await fs.writeFile(tsconfigBuildPath, tsconfigBuildContent, 'utf-8')

            const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
            execFile(npxCmd, ['tsc', '-p', 'tsconfig.build.json'], { cwd: targetDir, env, shell: true }, async (tscErr, tscStdout, tscStderr) => {
              try {
                await fs.unlink(tsconfigBuildPath) // cleanup
              } catch (e) {
                console.warn('[IDE] Failed to cleanup tsconfig.build.json:', e)
              }

              if (tscErr) {
                console.warn('[IDE] TSC build finished with warnings/errors:', tscStderr || tscStdout)
              } else {
                console.log('[IDE] TS Declarations generated successfully')
              }
              await copyProjectAssets(targetDir, outDir)
              resolve(outDir)
            })
          } catch (e) {
            reject(e)
          }
        } else if (isWindows) {
          try {
            await copyProjectAssets(targetDir, outDir)
            console.log('[IDE] Starting Windows Packaging...')
            
            let width = 1920
            let height = 1080
            try {
              const configContent = await fs.readFile(path.join(targetDir, 'novel.config.ts'), 'utf-8')
              const widthMatch = configContent.match(/width:\s*(\d+)/)
              if (widthMatch) width = parseInt(widthMatch[1])
              
              const heightMatch = configContent.match(/height:\s*(\d+)/)
              if (heightMatch) height = parseInt(heightMatch[1])
            } catch (e) {
              console.warn('[IDE] Failed to parse novel.config.ts for build:', e)
            }

            const distPath = path.join(targetDir, outDir)
            await fs.writeFile(path.join(distPath, 'package.json'), JSON.stringify({
              name: 'fumika-game',
              version: '1.0.0',
              main: 'main.js'
            }, null, 2), 'utf-8')

            const mainJsContent = `const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: ${width},
    height: ${height},
    useContentSize: true,
    resizable: ${options?.resizable ? 'true' : 'false'},
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  try {
    win.setAspectRatio(${width} / ${height})
  } catch (e) {
    // Ignore if not supported on this platform
  }

  win.loadFile('index.html')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
`
            await fs.writeFile(path.join(distPath, 'main.js'), mainJsContent, 'utf-8')

            console.log('[IDE] Ensuring electron and @electron/packager are installed...')
            await new Promise<void>((res, rej) => {
              execFile(npmCmd, ['install', '--save-dev', 'electron', '@electron/packager'], { cwd: targetDir, shell: true }, (installErr, installStdout, installStderr) => {
                if (installErr) {
                  console.error('[IDE] Failed to install electron/packager:', installStderr)
                  rej(installErr)
                } else {
                  res()
                }
              })
            })

            console.log('[IDE] Running @electron/packager...')
            const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
            await new Promise<void>((res, rej) => {
              const packagerArgs = [
                '@electron/packager',
                `./${outDir}`,
                'FumikaGame',
                '--platform=win32',
                '--arch=x64',
                '--asar',
                '--out=./dist/windows_build',
                '--overwrite'
              ]
              
              // App Icon - assuming public/icon.png is created before buildProject is called
              packagerArgs.push('--icon=./public/icon.png')

              execFile(npxCmd, packagerArgs, { cwd: targetDir, shell: true }, (packErr, packStdout, packStderr) => {
                if (packErr) {
                  console.error('[IDE] @electron/packager failed:', packStderr)
                  rej(packErr)
                } else {
                  res()
                }
              })
            })

            resolve('dist/windows_build/FumikaGame-win32-x64')
          } catch (err) {
            reject(err)
          }
        } else {
          await copyProjectAssets(targetDir, outDir)
          resolve(outDir)
        }
      }
    })
  })
}
