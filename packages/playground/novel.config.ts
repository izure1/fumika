import {
  defineNovelConfig,
  define,
  defineBackgrounds,
  defineAudios,
  defineEffects,
  defineFallback,
  defineCustomModules
} from 'fumika'
import chat from './characters/chat'
import fumika from './characters/fumika'
import assets from './assets'

// ─── 모듈 ────────────────────────────────────────────────────

const testModule = define<{ message: string }>()
testModule
  .onBoot(async (_world) => {
    console.log('booting...')
  })
  .defineView((_ctx, _data, _setState) => ({ show: () => { }, hide: () => { }, onCleanup: () => { } }))
  .defineCommand(function* (cmd, ctx) {
    console.log('[test-cmd]', cmd.message, ctx.globalVars)
    return true
  })

const debugModule = define<{
  on: boolean
}, {
  on: boolean
}>({ on: false })
debugModule
  .defineView((_ctx, _state, _setState) => ({
    show: () => { },
    hide: () => { },
    onCleanup: () => { },
    onUpdate: (ctx, state, _setState) => {
      ctx.world.debugMode = state.on
    }
  }))
  .defineCommand(function* (_cmd, _ctx, state, setState) {
    setState({ on: !state.on })
    return true
  })

const modules = defineCustomModules({
  'test-cmd': testModule,
  'debug': debugModule,
})

// ─── 배경 ────────────────────────────────────────────────────

const backgrounds = defineBackgrounds(assets)({
  'floor': { src: 'bg_floor', parallax: true },
  'room': { src: 'bg_room', parallax: true },
  'park': { src: 'bg_park', parallax: true },
})

// ─── 오디오 ──────────────────────────────────────────────────

const audios = defineAudios({
  'am223': './assets/bgm_am223.mp3',
  'daytime': './assets/bgm_daytime.mp3',
})

// ─── 폴백 ────────────────────────────────────────────────────

const fallback = defineFallback(modules)([
  { type: 'character', action: 'show', defaults: { duration: 300 } },
  { type: 'character', action: 'remove', defaults: { duration: 1000 } },
])

// ─── 이펙트 ──────────────────────────────────────────────────

const effects = defineEffects({
  sakura: {
    clip: {
      size: [
        [1.0, 2.0],
      ]
    }
  }
})

// ─── config ──────────────────────────────────────────────────

export default defineNovelConfig({
  width: 1280,
  height: 720,
  variables: {
    likeability: 0,
    metHeroine: false,
    endingReached: false,
    useHeroineVoice: true,
    username: '',
  },
  environments: {
    $bgmVolume: 1,
  },
  modules,
  scenes: [
    'scene-title',
    'scene-ui',
    'scene-start',
    'scene-game',
    'scene-food',
    'scene-stream',
    'scene-outside',
    'scene-bug',
    'scene-sub',
    'scene-ending',
  ],
  characters: {
    'chat': chat,
    'fumika': fumika,
  },
  backgrounds,
  audios,
  assets,
  fallback,
  effects,
})
