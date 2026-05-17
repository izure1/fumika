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

import { getNovelConfigContent, MAIN_TS_CONTENT, getIndexHtmlContent, getDeclarationTemplate, EFFECT_TYPES, getInitialEffectContent } from '../../shared/templates'

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
        dev: 'vite'
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
          execFile(npmCmd, ['install', '--save-dev', 'vite', 'typescript@6'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
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
