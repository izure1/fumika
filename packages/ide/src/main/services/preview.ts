import { promises as fs } from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

export class PreviewService {
  private process: ChildProcess | null = null
  private tempConfigPath: string | null = null

  public async start(projectPath: string, targetScene?: string): Promise<string> {
    await this.stop()

    // 디버그용 Vite 플러그인을 임시 설정 파일로 주입합니다.
    // IDE 자체의 node_modules에서 Vite를 import하지 않으므로 asar 문제를 우회합니다.
    const sceneReplacement = targetScene
      ? `newCode.replace(/novel\\.start\\([^)]+\\)/, "novel.start('${targetScene}')")`
      : 'newCode'

    const pluginCode = `
{
  name: 'fumika-debug-injector',
  transform(code, id) {
    if (id.endsWith('main.ts') || id.endsWith('main.js')) {
      let newCode = code.replace(/await novel\\.load\\(\\)/g, 'novel.debugMode = true;\\n  await novel.load()')
      newCode = ${sceneReplacement}
      return newCode
    }
    return null
  }
}
`.trim()

    const tempConfig = `
import { defineConfig } from 'vite'

export default defineConfig({
  root: ${JSON.stringify(projectPath)},
  resolve: {
    alias: {
      '@': ${JSON.stringify(projectPath)}
    }
  },
  server: {
    port: 5174,
    strictPort: false,
  },
  plugins: [
    ${pluginCode}
  ]
})
`.trim()

    this.tempConfigPath = path.join(projectPath, '.fumika-preview.vite.config.mjs')
    await fs.writeFile(this.tempConfigPath, tempConfig, 'utf-8')

    // .cmd 래퍼 대신 node + vite/bin/vite.js를 직접 실행합니다.
    // - shell: false 유지 → kill()이 프로세스 트리에 정상 작동 (shell: true 시 셸만 종료되어 vite가 좀비로 남음)
    // - race condition 제거 → strictPort: false + stdout 파싱으로 실제 바인딩된 URL을 획득
    const viteEntry = path.join(projectPath, 'node_modules', 'vite', 'bin', 'vite.js')
    const nodeExec = process.execPath // Electron이 사용 중인 Node.js 실행 파일

    return new Promise<string>((resolve, reject) => {
      let resolved = false

      try {
        this.process = spawn(nodeExec, [viteEntry, '--config', this.tempConfigPath!], {
          cwd: projectPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        })

        const handleOutput = (data: Buffer) => {
          const text = data.toString()
          console.log(`[Preview] ${text.trim()}`)

          if (!resolved) {
            // Vite stdout에는 ANSI 컬러 이스케이프 코드가 포함되어 있으므로 제거 후 파싱합니다.
            // 예: "\u001b[32m➜\u001b[0m  \u001b[1mLocal\u001b[0m:   \u001b[36mhttp://localhost:5174/\u001b[0m"
            // eslint-disable-next-line no-control-regex
            const clean = text.replace(/\u001b\[[0-9;]*m/g, '')
            const match = clean.match(/https?:\/\/localhost:(\d+)/i)
            if (match) {
              const url = `http://localhost:${match[1]}`
              resolved = true
              console.log(`[Preview] Server started at ${url}`)
              resolve(url)
            }
          }
        }

        this.process.stdout?.on('data', handleOutput)
        this.process.stderr?.on('data', (data: Buffer) => {
          console.warn(`[Preview] ${data.toString().trim()}`)
        })

        this.process.on('error', (err) => {
          console.error('[Preview] Failed to start vite process:', err)
          if (!resolved) reject(err)
        })

        this.process.on('close', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`[Preview] Vite process exited with code ${code}`)
            if (!resolved) reject(new Error(`Vite process exited with code ${code}`))
          }
        })

        // URL 파싱 실패 대비 타임아웃 (15초)
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            reject(new Error('Vite server did not report a URL within 15 seconds'))
          }
        }, 15000)

      } catch (e) {
        console.error('[Preview] Failed to start vite server:', e)
        reject(e)
      }
    })
  }

  public async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
      console.log('[Preview] Server stopped')
    }

    if (this.tempConfigPath) {
      try {
        await fs.unlink(this.tempConfigPath)
      } catch {
        // 이미 없으면 무시
      }
      this.tempConfigPath = null
    }
  }
}
