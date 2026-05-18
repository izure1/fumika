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
    opacity: [[0, 1], [0.5, 1], [0, 1], [0.5, 1], [0, 0]]
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

export function getIndexHtmlContent(gameName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${gameName}</title>
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
    `import { define } from 'fumika'\n\ninterface MyCmd { }\n\ninterface MySchema { }\n\ninterface MyHook {\n  '${safeName}:event': (val: unknown) => unknown\n}\n\nexport default define<MyCmd, MySchema, MyHook>({ })\n  .defineCommand(function* (cmd, ctx, state, setState) {\n    // 커맨드 구현\n  })\n  .defineView((ctx, state, setState) => {\n    // 뷰 구현\n    return {\n      show: () => {},\n      hide: () => {},\n      onUpdate: () => {},\n      onCleanup: () => {}\n    }\n  })\n`,

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
