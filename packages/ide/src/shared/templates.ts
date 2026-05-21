// =============================================================
// templates.ts — 프로젝트 스캐폴딩 템플릿 문자열 모음
// =============================================================

// ─── 이펙트 프리셋 데이터 ─────────────────────────────────────

export const EFFECT_TYPES = ['dust', 'rain', 'snow', 'sakura', 'sparkle', 'fog', 'leaves', 'fireflies'] as const
export type EffectType = typeof EFFECT_TYPES[number]

/* eslint-disable @typescript-eslint/no-explicit-any */
const EFFECT_PARTICLE_PRESETS: Record<EffectType, Record<string, any>> = {
  dust: {
    attribute: { frictionAir: 0, gravityScale: 0.001 },
    style: { width: 10, height: 10, blendMode: 'lighter' }
  },
  rain: {
    attribute: { gravityScale: 1.5 },
    style: { width: 25, height: 100, opacity: 1, blendMode: 'screen' }
  },
  snow: {
    attribute: { gravityScale: 0.01, frictionAir: 0 },
    style: { width: 32, height: 32, blendMode: 'screen' }
  },
  sakura: {
    attribute: { gravityScale: 0.02, frictionAir: 0.001 },
    style: { width: 32, height: 32, blendMode: 'screen' }
  },
  sparkle: {
    attribute: { gravityScale: 0.1 },
    style: { width: 16, height: 16, opacity: 0.8 }
  },
  fog: {
    attribute: { frictionAir: 0, gravityScale: 0.003 },
    style: { width: 120, height: 120, blendMode: 'screen' }
  },
  leaves: {
    attribute: { gravityScale: 0.1, frictionAir: 0.005 },
    style: { width: 40, height: 40, blendMode: 'screen' }
  },
  fireflies: {
    attribute: { gravityScale: -0.015, frictionAir: 0.001 },
    style: { width: 50, height: 50, blendMode: 'lighter' }
  },
}

const EFFECT_CLIP_PRESETS: Record<EffectType, Record<string, any>> = {
  dust: {
    impulse: 0.05,
    lifespan: 10000,
    interval: 250,
    size: [[0.5, 1], [0, 0.5]],
    opacity: [[0, 0], [1, 1], [0, 0]],
    loop: true
  },
  rain: {
    impulse: 0,
    lifespan: 3000,
    interval: 40,
    size: [[0.1, 0.3], [0.1, 0.3]],
    opacity: [[1, 1], [1, 1]],
    loop: true
  },
  snow: {
    impulse: 0.01,
    lifespan: 10000,
    interval: 100,
    size: [[0.3, 0.8], [0, 0]],
    opacity: [[1, 1]],
    loop: true,
    angularImpulse: 0.001
  },
  sakura: {
    impulse: 0.02,
    lifespan: 6000,
    interval: 300,
    size: [[0.5, 0.8], [0.3, 0.5]],
    loop: true,
    angularImpulse: 0.001,
    opacity: [[0, 0], [0.5, 1], [0.5, 1], [0, 0]]
  },
  sparkle: {
    impulse: 0.02,
    lifespan: 1500,
    interval: 150,
    size: [[0.5, 1], [0, 0.1]],
    loop: true
  },
  fog: {
    impulse: 0.01,
    lifespan: 15000,
    interval: 800,
    size: [[2, 2], [5, 10]],
    opacity: [[0, 0], [0.1, 0.2], [0, 0]],
    loop: true,
    angularImpulse: 0.0001
  },
  leaves: {
    impulse: 0.15,
    lifespan: 7000,
    interval: 350,
    size: [[0.8, 1.2], [0.8, 1.2]],
    loop: true,
    angularImpulse: 0.01,
    opacity: [[0, 0], [1, 1], [1, 1], [0, 0]]
  },
  fireflies: {
    impulse: 0.03,
    lifespan: 5000,
    interval: 300,
    size: [[1, 1]],
    loop: true,
    opacity: [[0, 0], [0.5, 1], [0, 1], [0.5, 1], [0, 0]]
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 프리셋이 포함된 이펙트 파일 초기 내용을 생성합니다.
 */
export function getInitialEffectContent(effectType: EffectType): string {
  const particlePreset = JSON.stringify(EFFECT_PARTICLE_PRESETS[effectType], null, 2)
  const clipPreset = JSON.stringify(EFFECT_CLIP_PRESETS[effectType], null, 2)
  return `import type { EffectDef } from 'fumika'\n\nconst effectDef: EffectDef = {\n  particle: ${particlePreset.replace(/"([^"]+)":/g, '$1:')},\n  clip: ${clipPreset.replace(/"([^"]+)":/g, '$1:')}\n}\n\nexport default effectDef\n`
}

export function getBackgroundContent(srcVal: string, parallaxVal: boolean): string {
  return `import type Assets from '@/declarations/assets'\n\nexport const src: keyof typeof Assets = '${srcVal}'\nexport const parallax: boolean = ${parallaxVal}\n`
}

// ─── 최상위 설정 파일 ─────────────────────────────────────────

export function getNovelConfigContent(width: number, height: number): string {
  return `import Assets from '@/declarations/assets'
import sceneKeys from '@/declarations/sceneKeys'
import Characters from '@/declarations/characters'
import Modules from '@/declarations/modules'
import Backgrounds from '@/declarations/backgrounds'
import Audios from '@/declarations/audios'
import Effects from '@/declarations/effects'
import Fallbacks from '@/declarations/fallbacks'

import { defineNovelConfig } from 'fumika'

export default defineNovelConfig({
  width: ${width},
  height: ${height},
  variables: {},
  environments: {},
  assets: Assets,
  scenes: sceneKeys,
  characters: Characters,
  modules: Modules,
  backgrounds: Backgrounds,
  audios: Audios,
  effects: Effects,
  fallback: Fallbacks,
})
`
}

export const MAIN_TS_CONTENT = `// Fumika Engine Entry Point
import { Novel } from 'fumika'
import config from '@/novel.config'
import Scenes from '@/declarations/scenes'

async function main() {
  const element = document.getElementById('app') as HTMLDivElement

  const novel = new Novel(config, {
    element,
    scenes: Scenes
  })

  await novel.load()
  await novel.boot()

  // 기본적으로 'start' 씬을 시작하되, 없으면 로드된 첫 번째 씬을 시작합니다.
  const availableScenes = Object.keys(Scenes)
  const startScene = availableScenes.includes('start') ? 'start' : availableScenes[0]
  if (startScene) {
    novel.start(startScene as any)
  }

  window.addEventListener('click', () => {
    novel.next()
  })
}

main().catch(console.error)
`

export interface IndexHtmlOptions {
  gameName: string
  description?: string
  author?: string
}

export function getIndexHtmlContent(opts: IndexHtmlOptions | string): string {
  // 이전 버전 호환성: 문자열로 넘길 수도 있음
  const gameName = typeof opts === 'string' ? opts : opts.gameName
  const description = typeof opts === 'string' ? '' : (opts.description ?? '')
  const author = typeof opts === 'string' ? '' : (opts.author ?? '')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${gameName}</title>
    <meta name="description" content="${description}" />
    <meta name="author" content="${author}" />
    <meta property="og:title" content="${gameName}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/png" href="./icon.png" />
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
      #app { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
`
}

export function getElectronMainContent(width: number, height: number, resizable: boolean): string {
  return `const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: ${width},
    height: ${height},
    useContentSize: true,
    resizable: ${resizable ? 'true' : 'false'},
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
}

export function getAppPackageJsonContent(name?: string, productName?: string, version?: string, author?: string, description?: string): string {
  return JSON.stringify({
    name: name || 'fumika-game',
    version: version || '1.0.0',
    main: 'main.js',
    author: author || 'Fumika',
    description: description || productName || 'Fumika Visual Novel'
  }, null, 2)
}

export function getElectronBuilderConfigContent(
  electronVersion: string,
  appDir: string,
  outWindowsDir: string,
  isInstaller: boolean,
  appId?: string,
  productName?: string,
  author?: string
): string {
  return JSON.stringify({
    appId: appId || 'com.fumika.game',
    productName: productName || 'FumikaGame',
    copyright: `Copyright © ${new Date().getFullYear()} ${author || 'Fumika'}`,
    electronVersion,
    directories: {
      app: appDir,
      output: outWindowsDir
    },
    win: {
      target: isInstaller ? ['nsis'] : ['dir'],
      icon: 'public/icon.png'
    },
    asar: true
  }, null, 2)
}


export function getViteConfigContent(options?: { pwa?: boolean, appName?: string, shortName?: string, description?: string }): string {
  const pwaImport = options?.pwa ? `\nimport { VitePWA } from 'vite-plugin-pwa'` : ''
  const pwaPlugin = options?.pwa ? `
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: '${options?.appName || 'Fumika Game'}',
          short_name: '${options?.shortName || 'Fumika'}',
          description: '${options?.description || ''}',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],` : ''

  return `import { defineConfig } from 'vite'${pwaImport}

export default defineConfig(() => {
  const isLibrary = process.env.BUILD_TARGET === 'library'
  const outDir = process.env.BUILD_TIME ? \`dist/\${process.env.BUILD_TIME}\` : 'dist'

  return {
    base: './',${pwaPlugin}
    build: {
      outDir,
      emptyOutDir: true,
      lib: isLibrary ? {
        entry: 'main.ts',
        name: 'FumikaGame',
        fileName: 'fumika-game',
        formats: ['es', 'umd']
      } : undefined,
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && /\\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav)$/i.test(assetInfo.name)) {
              return 'resources/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          }
        }
      }
    }
  }
})
`
}

// ─── declarations/ 초기 파일 템플릿 ──────────────────────────

export type DeclarationFolder =
  | 'assets'
  | 'scenes'
  | 'sceneKeys'
  | 'characters'
  | 'modules'
  | 'backgrounds'
  | 'effects'
  | 'fallbacks'
  | 'audios'
  | 'types'
  | 'initials'
  | 'hooks'

const DECLARATION_TEMPLATES: Partial<Record<DeclarationFolder, string>> = {
  assets: `import { defineAssets } from 'fumika'\n\nexport default defineAssets({\n\n})\n`,
  scenes: `export default {}\n`,
  sceneKeys: `export default [] as const\n`,
  characters: `export default {} as const\n`,
  modules: `import { defineCustomModules } from 'fumika'\n\nexport default defineCustomModules({\n\n})\n`,
  backgrounds: `import { defineBackgrounds } from 'fumika'\nimport assets from '@/declarations/assets'\n\nexport default defineBackgrounds(assets)({\n\n})\n`,
  effects: `import { defineEffects } from 'fumika'\n\nexport default defineEffects({\n\n})\n`,
  fallbacks: `import { defineFallback } from 'fumika'\nimport modules from '@/declarations/modules'\n\nexport default defineFallback(modules)([\n\n])\n`,
  audios: `import { defineAudios } from 'fumika'\n\nexport default defineAudios({\n\n})\n`,
  types: `import type { FallbackRuleOf } from 'fumika'\nimport type Modules from '@/declarations/modules'\n\ndeclare global {\n  type FallbackItem = FallbackRuleOf<typeof Modules>\n}\n`,
  initials: `export default {}\n`,
  hooks: `export default {}\n`,
}

export function getDeclarationTemplate(type: DeclarationFolder | string): string {
  return DECLARATION_TEMPLATES[type as DeclarationFolder] ?? `export default {}\n`
}

// ─── watcher가 동적으로 생성하는 선언 파일의 헤더/푸터 ─────────

/**
 * watcher.ts의 generateDeclaration()에서 사용하는 헤더/푸터 조각.
 * 파일 항목은 watcher가 직접 삽입하고, 앞뒤 틀은 여기서 관리합니다.
 */
export type WatcherDeclSection = {
  header: string          // import 라인들 + 선언 시작
  footer: string          // 선언 닫기
  importStyle?: 'default' | 'namespace'  // watcher가 사용할 import 방식
}

export const WATCHER_DECL: Partial<Record<string, WatcherDeclSection>> = {
  assets: {
    header: `import { defineAssets } from 'fumika'\n\nexport default defineAssets({\n`,
    footer: `})\n`,
  },
  audios: {
    header: `import { defineAudios } from 'fumika'\n\nexport default defineAudios({\n`,
    footer: `})\n`,
  },
  backgrounds: {
    header: `import { defineBackgrounds } from 'fumika'\nimport assets from '@/declarations/assets'\n\nexport default defineBackgrounds(assets)({\n`,
    footer: `})\n`,
    importStyle: 'namespace',
  },
  effects: {
    header: `import { defineEffects } from 'fumika'\n\nexport default defineEffects({\n`,
    footer: `})\n`,
    importStyle: 'default',
  },
  modules: {
    header: `import { defineCustomModules } from 'fumika'\n`,
    // 항목이 있을 때: 각 import + 객체 → footer에서 닫음
    // 항목이 없을 때: 바로 빈 객체
    footer: `})\n`,
  },
  fallbacks: {
    header: `import { defineFallback } from 'fumika'\nimport modules from '@/declarations/modules'\n\nexport default defineFallback(modules)([\n`,
    footer: `])\n`,
  },
}

// ─── IDE에서 새 파일 생성 시 사용하는 파일 내용 템플릿 ──────────

const FILE_TEMPLATE_GENERATORS: Partial<
  Record<DeclarationFolder, (safeName: string, relativeDots: string) => string>
> = {
  scenes: (_, _relativeDots) =>
    `import { defineScene } from 'fumika'\nimport config from '@/novel.config'\nimport Initials from '@/declarations/initials'\nimport Hooks from '@/declarations/hooks'\n\nexport default defineScene({\n  config,\n  variables: {},\n  // next: { scene: '', preserve: true },\n  // initial: Initials[''],\n  // hooks: Hooks[''],\n})(({ label, goto, call, set, condition, next }) => [\n\n])\n`,

  characters: (safeName, _relativeDots) =>
    `import { defineCharacter } from 'fumika'\nimport assets from '@/declarations/assets'\n\nexport default defineCharacter(assets)({\n  name: '${safeName}',\n  bases: { },\n  emotions: { }\n})\n`,

  modules: (safeName) =>
    `import { define } from 'fumika'
import { getRuntimeEnv } from '@/helpers/Runtime'

interface MyCmd { }

interface MySchema { }

interface MyHook {
  '${safeName}:event': (val: unknown) => unknown
}

export default define<MyCmd, MySchema, MyHook>({ })
  .defineCommand(function* (cmd, ctx, state, setState) {
    // 커맨드 구현
  })
  .defineView((ctx, state, setState) => {
    // 뷰 구현
    return {
      show: () => {},
      hide: () => {},
      onUpdate: () => {},
      onCleanup: () => {}
    }
  })
`,
  backgrounds: (_, _relativeDots) => getBackgroundContent('', true),

  effects: () =>
    `import type { EffectDef } from 'fumika'\n\nconst effectDef: EffectDef = {}\n\nexport default effectDef`,

  fallbacks: () =>
    `const fallback: FallbackItem = {\n  type: '',\n  defaults: {}\n}\n\nexport default fallback`,

  initials: (_, _relativeDots) =>
    `import { defineInitial } from 'fumika'\nimport config from '@/novel.config'\n\nexport default defineInitial(config)({\n  \n})\n`,

  hooks: (_, _relativeDots) =>
    `import { defineHook } from 'fumika'\nimport config from '@/novel.config'\n\nexport default defineHook(config)({\n  \n})\n`,
}

export function getFileTemplate(
  rootType: DeclarationFolder | string,
  safeName: string,
  relativeDots: string
): string {
  const generator = FILE_TEMPLATE_GENERATORS[rootType as DeclarationFolder]
  return generator ? generator(safeName, relativeDots) : `// New file`
}

export const BLUEPRINT_RUNTIME_CODE = [
  "// =============================================================",
  "// declarations/blueprintRuntime.ts — 블루프린트 런타임 해석기 공용 유틸",
  "// =============================================================",
  "",
  "export interface BlueprintNode {",
  "  id: string",
  "  data?: {",
  "    nodeType: string",
  "    fieldName?: string",
  "    varName?: string",
  "    varType?: string",
  "    operator?: string",
  "    eventType?: string",
  "    value?: any",
  "    [key: string]: any",
  "  }",
  "}",
  "",
  "export interface BlueprintEdge {",
  "  source: string",
  "  sourceHandle: string",
  "  target: string",
  "  targetHandle: string",
  "}",
  "",
  "export interface BlueprintGraph {",
  "  nodes: BlueprintNode[]",
  "  edges: BlueprintEdge[]",
  "}",
  "",
  "export interface BlueprintRuntimeContext {",
  "  cmd?: any",
  "  ctx: any",
  "  state: any",
  "  setState: (updates: any) => void",
  "  outputs: Map<string, any>",
  "  constVariables?: Map<string, any>",
  "}",
  "",
  "const globalVariables = new Map<string, any>()",
  "",
  "/**",
  " * 런타임 상에서 저장된 블루프린트 그래프의 노드 연결 상태를 기반으로 흐름을 해석하고 연산을 실행합니다.",
  " */",
  "export function runBlueprintFlow(",
  "  tabName: string,",
  "  graphs: Record<string, BlueprintGraph>,",
  "  entryNodeType: string,",
  "  runtimeContext: BlueprintRuntimeContext",
  "): Generator<any, any, any> | undefined {",
  "  const graph = graphs[tabName]",
  "  if (!graph || !graph.nodes) {",
  "    return",
  "  }",
  "",
  "  // 진입 엔트리 노드 탐색",
  "  const entryNode = graph.nodes.find((n) => n.data?.nodeType === entryNodeType)",
  "  if (!entryNode) {",
  "    return",
  "  }",
  "",
  "  const { setState, outputs } = runtimeContext",
  "  if (!runtimeContext.constVariables) {",
  "    runtimeContext.constVariables = new Map<string, any>()",
  "  }",
  "",
  "  // 데이터 핀 의존성 역방향 재귀 연산",
  "  function evaluatePin(handleId: string): any {",
  "    if (outputs.has(handleId)) {",
  "      return outputs.get(handleId)",
  "    }",
  "",
  "    // handleId 예: \"node_id__pin_id\"",
  "    const index = handleId.indexOf('__')",
  "    if (index === -1) return undefined",
  "    const nodeId = handleId.substring(0, index)",
  "    const pinId = handleId.substring(index + 2)",
  "",
  "    // 해당 입력 핀에 연결된 소스 엣지 조회",
  "    const incomingEdge = (graph.edges || []).find(",
  "      (e) => e.target === nodeId && e.targetHandle === handleId",
  "    )",
  "",
  "    if (incomingEdge && incomingEdge.sourceHandle) {",
  "      // 소스 노드 연산 평가",
  "      return evaluateNodePin(incomingEdge.source, incomingEdge.sourceHandle)",
  "    }",
  "",
  "    // 연결선이 없는 경우 노드 자체의 리터럴 데이터 반환",
  "    const node = graph.nodes.find((n) => n.id === nodeId)",
  "    if (node && node.data) {",
  "      if (pinId.startsWith('prop__')) {",
  "        const originalKey = pinId.substring(6)",
  "        if (originalKey in node.data) {",
  "          return node.data[originalKey]",
  "        }",
  "      }",
  "      if (pinId in node.data) {",
  "        return node.data[pinId]",
  "      }",
  "    }",
  "",
  "    return undefined",
  "  }",
  "",
  "  function evaluateNodePin(nodeId: string, handleId: string): any {",
  "    if (outputs.has(handleId)) {",
  "      return outputs.get(handleId)",
  "    }",
  "",
  "    const node = graph.nodes.find((n) => n.id === nodeId)",
  "    if (!node) return undefined",
  "",
  "    const nodeType = node.data?.nodeType",
  "",
  "    let val: any = undefined",
  "",
  "    // 노드 타입별 연산 분기",
  "    if (nodeType === 'GetState') {",
  "      const field = node.data?.fieldName",
  "      if (field) val = runtimeContext.state[field]",
  "    } else if (nodeType === 'NovelSave') {",
  "      if (runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.save === 'function') {",
  "        val = JSON.stringify(runtimeContext.ctx.novel.save())",
  "      }",
  "    } else if (nodeType === 'NovelSaveEnv') {",
  "      if (runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.saveEnv === 'function') {",
  "        val = JSON.stringify(runtimeContext.ctx.novel.saveEnv())",
  "      }",
  "    } else if (nodeType === 'GetCmd') {",
  "      const field = node.data?.fieldName",
  "      if (field && runtimeContext.cmd) val = runtimeContext.cmd[field]",
  "    } else if (nodeType === 'GetVariable') {",
  "      const name = evaluatePin(nodeId + '__name') || node.data?.varName",
  "      const type = node.data?.varType || 'local'",
  "      if (runtimeContext.ctx.variables && name) {",
  "        val = runtimeContext.ctx.variables.get(name, type)",
  "      }",
  "    } else if (nodeType === 'GetConst') {",
  "      const name = evaluatePin(nodeId + '__name') || node.data?.name || node.data?.varName",
  "      if (name && runtimeContext.constVariables) {",
  "        val = runtimeContext.constVariables.get(name)",
  "      }",
  "    } else if (nodeType === 'GetGlobal') {",
  "      const name = evaluatePin(nodeId + '__name') || node.data?.name || node.data?.varName",
  "      if (name) {",
  "        val = globalVariables.get(name)",
  "      }",
  "    } else if (nodeType === 'GetCamera') {",
  "      val = runtimeContext.ctx.world?.camera",
  "    } else if (nodeType === 'CanvasToWorld') {",
  "      const camera = evaluatePin(nodeId + '__camera')",
  "      const x = Number(evaluatePin(nodeId + '__x') || 0)",
  "      const y = Number(evaluatePin(nodeId + '__y') || 0)",
  "      const targetZ = evaluatePin(nodeId + '__targetZ')",
  "      if (camera && typeof camera.canvasToWorld === 'function') {",
  "        val = camera.canvasToWorld(x, y, targetZ !== undefined ? Number(targetZ) : undefined)",
  "      } else {",
  "        val = { x: 0, y: 0, z: 0 }",
  "      }",
  "    } else if (nodeType === 'CanvasToLocal') {",
  "      const camera = evaluatePin(nodeId + '__camera')",
  "      const x = Number(evaluatePin(nodeId + '__x') || 0)",
  "      const y = Number(evaluatePin(nodeId + '__y') || 0)",
  "      const targetZ = evaluatePin(nodeId + '__targetZ')",
  "      if (camera && typeof camera.canvasToLocal === 'function') {",
  "        val = camera.canvasToLocal(x, y, targetZ !== undefined ? Number(targetZ) : undefined)",
  "      } else {",
  "        val = { x: 0, y: 0, z: 0 }",
  "      }",
  "    } else if (nodeType === 'CalcDepthRatio') {",
  "      const camera = evaluatePin(nodeId + '__camera')",
  "      const targetZ = Number(evaluatePin(nodeId + '__targetZ') || 0)",
  "      const valueVal = Number(evaluatePin(nodeId + '__value') || 0)",
  "      if (camera && typeof camera.calcDepthRatio === 'function') {",
  "        val = camera.calcDepthRatio(targetZ, valueVal)",
  "      } else {",
  "        val = valueVal",
  "      }",
  "    } else if (nodeType === 'Constant') {",
  "      val = node.data?.value",
  "    } else if (nodeType === 'Compare') {",
  "      const op = node.data?.operator || '=='",
  "      const a = evaluatePin(nodeId + '__a')",
  "      const b = evaluatePin(nodeId + '__b')",
  "      if (op === '==') val = (a == b)",
  "      else if (op === '!=') val = (a != b)",
  "      else if (op === '<') val = (a < b)",
  "      else if (op === '>') val = (a > b)",
  "      else if (op === '<=') val = (a <= b)",
  "      else if (op === '>=') val = (a >= b)",
  "    } else if (nodeType === 'MathOp') {",
  "      const op = node.data?.operator || '+'",
  "      const a = Number(evaluatePin(nodeId + '__a') || 0)",
  "      const b = Number(evaluatePin(nodeId + '__b') || 0)",
  "      if (op === '+') val = a + b",
  "      else if (op === '-') val = a - b",
  "      else if (op === '*') val = a * b",
  "      else if (op === '/') val = b === 0 ? 0 : a / b",
  "    } else if (nodeType === 'MakePosition') {",
  "      const x = Number(evaluatePin(nodeId + '__x') || 0)",
  "      const y = Number(evaluatePin(nodeId + '__y') || 0)",
  "      const z = Number(evaluatePin(nodeId + '__z') || 0)",
  "      val = { x, y, z }",
  "    } else if (nodeType === 'MakeStyle') {",
  "      const styleKeys = (node.data?.styleKeys as string[]) ?? ['width', 'height', 'background']",
  "      const styleObj: Record<string, any> = {}",
  "      for (const key of styleKeys) {",
  "        styleObj[key] = evaluatePin(nodeId + '__prop__' + key)",
  "      }",
  "      val = styleObj",
  "    } else if (nodeType === 'MakeAttribute') {",
  "      const attrKeys = (node.data?.attrKeys as string[]) ?? ['name', 'className']",
  "      const attrObj: Record<string, any> = {}",
  "      for (const key of attrKeys) {",
  "        attrObj[key] = evaluatePin(nodeId + '__prop__' + key)",
  "      }",
  "      if (attrObj.physics === 'none') {",
  "        attrObj.physics = null",
  "      }",
  "      val = attrObj",
  "    } else if (nodeType === 'CreateRectangle') {",
  "      const attribute = evaluatePin(nodeId + '__attribute') || {}",
  "      const style = evaluatePin(nodeId + '__style') || {}",
  "      const position = evaluatePin(nodeId + '__position')",
  "      if (runtimeContext.ctx.world) {",
  "        val = runtimeContext.ctx.world.createRectangle({",
  "          attribute,",
  "          style,",
  "          transform: position ? { position } : undefined",
  "        })",
  "      }",
  "    } else if (nodeType === 'CreateEllipse') {",
  "      const attribute = evaluatePin(nodeId + '__attribute') || {}",
  "      const style = evaluatePin(nodeId + '__style') || {}",
  "      const position = evaluatePin(nodeId + '__position')",
  "      if (runtimeContext.ctx.world) {",
  "        val = runtimeContext.ctx.world.createEllipse({",
  "          attribute,",
  "          style,",
  "          transform: position ? { position } : undefined",
  "        })",
  "      }",
  "    } else if (nodeType === 'CreateText') {",
  "      const text = evaluatePin(nodeId + '__text') || ''",
  "      const attribute = evaluatePin(nodeId + '__attribute') || {}",
  "      const style = evaluatePin(nodeId + '__style') || {}",
  "      const position = evaluatePin(nodeId + '__position')",
  "      if (runtimeContext.ctx.world) {",
  "        val = runtimeContext.ctx.world.createText({",
  "          text,",
  "          attribute,",
  "          style,",
  "          transform: position ? { position } : undefined",
  "        })",
  "      }",
  "    } else if (nodeType === 'CreateImage') {",
  "      const image = evaluatePin(nodeId + '__image') || ''",
  "      const attribute = evaluatePin(nodeId + '__attribute') || {}",
  "      const style = evaluatePin(nodeId + '__style') || {}",
  "      const position = evaluatePin(nodeId + '__position')",
  "      if (runtimeContext.ctx.world) {",
  "        val = runtimeContext.ctx.world.createImage({",
  "          src: image,",
  "          attribute,",
  "          style,",
  "          transform: position ? { position } : undefined",
  "        })",
  "      }",
  "    } else if (nodeType === 'MakeFunction') {",
  "      const callbackEdge = (graph.edges || []).find(",
  "        (e) => e.source === nodeId && e.sourceHandle === (nodeId + '__callback')",
  "      )",
  "      val = (...args: any[]) => {",
  "        if (callbackEdge) {",
  "          const gen = executeNode(callbackEdge.target)",
  "          if (gen) {",
  "            let res = gen.next()",
  "            while (!res.done) {",
  "              res = gen.next()",
  "            }",
  "          }",
  "        }",
  "      }",
  "    }",
  "",
  "    outputs.set(handleId, val)",
  "    return val",
  "  }",
  "",
  "  // 실행 흐름 제어 제너레이터 함수",
  "  function* executeNode(currentNodeId: string): Generator<any, any, any> {",
  "    const node = graph.nodes.find((n) => n.id === currentNodeId)",
  "    if (!node) return",
  "",
  "    const nodeType = node.data?.nodeType",
  "    let nextPinId = 'exec-out'",
  "",
  "    if (nodeType === 'SetState') {",
  "      const fields = (node.data?.fields as string[]) || []",
  "      const stateObj: Record<string, any> = {}",
  "      for (const field of fields) {",
  "        stateObj[field] = evaluatePin(currentNodeId + '__' + field)",
  "      }",
  "      setState(stateObj)",
  "      runtimeContext.state = { ...runtimeContext.state, ...stateObj }",
  "    } else if (nodeType === 'SetVariable') {",
  "      const name = evaluatePin(currentNodeId + '__name')",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      const type = node.data?.varType || 'local'",
  "      if (runtimeContext.ctx.variables && name) {",
  "        runtimeContext.ctx.variables.set(name, val, type)",
  "      }",
  "    } else if (nodeType === 'SetConst') {",
  "      const name = evaluatePin(currentNodeId + '__name') || node.data?.name || node.data?.varName",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      if (name && runtimeContext.constVariables) {",
  "        runtimeContext.constVariables.set(name, val)",
  "      }",
  "    } else if (nodeType === 'SetGlobal') {",
  "      const name = evaluatePin(currentNodeId + '__name') || node.data?.name || node.data?.varName",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      if (name) {",
  "        globalVariables.set(name, val)",
  "      }",
  "    } else if (nodeType === 'SetStyle') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const style = evaluatePin(currentNodeId + '__style')",
  "      if (obj && style && obj.style) {",
  "        Object.assign(obj.style, style)",
  "      }",
  "    } else if (nodeType === 'SetAttribute') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const attribute = evaluatePin(currentNodeId + '__attribute')",
  "      if (obj && attribute && obj.attribute) {",
  "        Object.assign(obj.attribute, attribute)",
  "      }",
  "    } else if (nodeType === 'AddChild') {",
  "    } else if (nodeType === 'BindEvent') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const eventType = node.data?.eventType",
  "      const callbackFn = evaluatePin(currentNodeId + '__callback')",
  "      if (obj && eventType && typeof obj.on === 'function' && typeof callbackFn === 'function') {",
  "        obj.on(eventType, callbackFn)",
  "      }",
  "    } else if (nodeType === 'FadeIn') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const dur = Number(evaluatePin(currentNodeId + '__duration') ?? 1000)",
  "      if (obj && typeof obj.fadeIn === 'function') {",
  "        obj.fadeIn(dur)",
  "      }",
  "    } else if (nodeType === 'FadeOut') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const dur = Number(evaluatePin(currentNodeId + '__duration') ?? 1000)",
  "      if (obj && typeof obj.fadeOut === 'function') {",
  "        obj.fadeOut(dur)",
  "      }",
  "    } else if (nodeType === 'RemoveObject') {",
  "      const obj = evaluatePin(currentNodeId + '__object')",
  "      const child = evaluatePin(currentNodeId + '__child') ?? false",
  "      const follower = evaluatePin(currentNodeId + '__follower') ?? false",
  "      if (obj && typeof obj.remove === 'function') {",
  "        obj.remove({ child, follower })",
  "      }",
  "    } else if (nodeType === 'Branch') {",
  "      const cond = evaluatePin(currentNodeId + '__condition')",
  "      nextPinId = cond ? 'true' : 'false'",
  "    } else if (nodeType === 'Yield') {",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      yield val ?? false",
  "    } else if (nodeType === 'Log') {",
  "      const message = evaluatePin(currentNodeId + '__message')",
  "      console.log(message)",
  "    } else if (nodeType === 'NovelSave') {",
  "      let val = ''",
  "      if (runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.save === 'function') {",
  "        val = JSON.stringify(runtimeContext.ctx.novel.save())",
  "      }",
  "      outputs.set(currentNodeId + '__result', val)",
  "    } else if (nodeType === 'NovelLoadSave') {",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      if (val && runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.loadSave === 'function') {",
  "        try {",
  "          runtimeContext.ctx.novel.loadSave(JSON.parse(val))",
  "        } catch (e) {",
  "          console.error('[fumika] loadSave failed:', e)",
  "        }",
  "      }",
  "    } else if (nodeType === 'NovelSaveEnv') {",
  "      let val = ''",
  "      if (runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.saveEnv === 'function') {",
  "        val = JSON.stringify(runtimeContext.ctx.novel.saveEnv())",
  "      }",
  "      outputs.set(currentNodeId + '__result', val)",
  "    } else if (nodeType === 'NovelLoadEnv') {",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      if (val && runtimeContext.ctx.novel && typeof runtimeContext.ctx.novel.loadEnv === 'function') {",
  "        try {",
  "          runtimeContext.ctx.novel.loadEnv(JSON.parse(val))",
  "        } catch (e) {",
  "          console.error('[fumika] loadEnv failed:', e)",
  "        }",
  "      }",
  "    } else if (nodeType === 'Return') {",
  "      const val = evaluatePin(currentNodeId + '__value')",
  "      return val ?? true",
  "    }",
  "",
  "    // 다음 연결된 노드로 실행 이동",
  "    const outgoingEdge = (graph.edges || []).find(",
  "      (e) => e.source === currentNodeId && e.sourceHandle === (currentNodeId + '__' + nextPinId)",
  "    )",
  "    if (outgoingEdge) {",
  "      yield* executeNode(outgoingEdge.target)",
  "    }",
  "  }",
  "",
  "  // 엔트리 노드의 다음 연결된 노드부터 순차 탐색 실행",
  "  const firstEdge = (graph.edges || []).find(",
  "    (e) => e.source === entryNode.id && e.sourceHandle === (entryNode.id + '__exec-out')",
  "  )",
  "  if (firstEdge) {",
  "    return executeNode(firstEdge.target)",
  "  }",
  "  return",
  "}"
].join('\n')

export const RUNTIME_CONTENT = `export function isWindowsEnv(): boolean {
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')
  const isWin = (typeof process !== 'undefined' && process.platform === 'win32') || 
                (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win'))
  return !!(isNode || isElectron) && isWin
}

export function isWebEnv(): boolean {
  return !isWindowsEnv()
}

export function getRuntimeEnv(): 'web' | 'windows' {
  return isWindowsEnv() ? 'windows' : 'web'
}
`

export const SAVE_MANAGER_CONTENT = `import { Novel } from 'fumika'
import { isWindowsEnv } from './Runtime'

interface SaveDoc {
  key: string
  value: string
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fumika-save-db', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('saves')) {
        db.createObjectStore('saves', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getIndexedDBValue(key: string): Promise<string | null> {
  const db = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly')
    const store = tx.objectStore('saves')
    const request = store.get(key)
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null)
    }
    request.onerror = () => reject(request.error)
  })
}

async function setIndexedDBValue(key: string, value: string): Promise<void> {
  const db = await openIndexedDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite')
    const store = tx.objectStore('saves')
    const request = store.put({ key, value })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function checkIndexedDBValue(key: string): Promise<boolean> {
  const val = await getIndexedDBValue(key)
  return val !== null
}

let dataplyDb: any = null

async function getDataplyDb(): Promise<any> {
  if (dataplyDb) {
    return dataplyDb
  }
  // @ts-ignore
  const mod = await import(/* @vite-ignore */ 'document-dataply')
  const db = mod.DocumentDataply.Define()
    .Options({ wal: 'save.wal' })
    .Open('save.db')
  
  await db.init()
  await db.migration(1, async (tx: any) => {
    await db.createIndex('idx_key', { type: 'btree', fields: ['key'] }, tx)
  })
  
  dataplyDb = db
  return db
}

async function getDataplyValue(key: string): Promise<string | null> {
  const db = await getDataplyDb()
  const query = db.select({ key })
  const results = await query.drain()
  if (results && results.length > 0) {
    return results[0].value
  }
  return null
}

async function setDataplyValue(key: string, value: string): Promise<void> {
  const db = await getDataplyDb()
  const updatedCount = await db.partialUpdate({ key }, { value })
  if (updatedCount === 0) {
    await db.insert({ key, value })
  }
}

async function checkDataplyValue(key: string): Promise<boolean> {
  const val = await getDataplyValue(key)
  return val !== null
}

export class SaveManager {
  private novel: Novel

  constructor(novel: Novel) {
    this.novel = novel
  }

  async check(slot: number): Promise<boolean> {
    const key = \`slot_\${slot}\`
    if (isWindowsEnv()) {
      return await checkDataplyValue(key)
    } else {
      return await checkIndexedDBValue(key)
    }
  }

  async save(slot: number): Promise<string> {
    const data = this.novel.save()
    const serialized = JSON.stringify(data)
    const key = \`slot_\${slot}\`
    if (isWindowsEnv()) {
      await setDataplyValue(key, serialized)
    } else {
      await setIndexedDBValue(key, serialized)
    }
    return serialized
  }

  async load(slot: number): Promise<string> {
    const key = \`slot_\${slot}\`
    let serialized: string | null = null
    if (isWindowsEnv()) {
      serialized = await getDataplyValue(key)
    } else {
      serialized = await getIndexedDBValue(key)
    }
    if (!serialized) {
      throw new Error(\`No save data found in slot \${slot}\`)
    }
    const data = JSON.parse(serialized)
    this.novel.loadSave(data)
    return serialized
  }

  async saveEnv(): Promise<string> {
    const data = this.novel.saveEnv()
    const serialized = JSON.stringify(data)
    const key = 'env'
    if (isWindowsEnv()) {
      await setDataplyValue(key, serialized)
    } else {
      await setIndexedDBValue(key, serialized)
    }
    return serialized
  }

  async loadEnv(): Promise<string> {
    const key = 'env'
    let serialized: string | null = null
    if (isWindowsEnv()) {
      serialized = await getDataplyValue(key)
    } else {
      serialized = await getIndexedDBValue(key)
    }
    if (!serialized) {
      throw new Error('No environment save data found')
    }
    const data = JSON.parse(serialized)
    this.novel.loadEnv(data)
    return serialized
  }
}

export function getSaveManager(novel: Novel): SaveManager {
  return new SaveManager(novel)
}
`

