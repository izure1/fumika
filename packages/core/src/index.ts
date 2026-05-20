// =============================================================
// src/index.ts — fumika 공개 API
// =============================================================

// ─── 타입 정의 ───────────────────────────────────────────────
export type {
  // config
  CharBaseDef,
  CharDef,
  CharDefs,
  BgDef,
  BgDefs,
  NovelConfig,
  NovelOption,
  FallbackRuleOf,
  // config 유틸리티 타입
  CharacterKeysOf,
  ImageKeysOf,
  AssetKeysOf,
  BackgroundKeysOf,
  SceneNamesOf,
  SceneNextTarget,
  VariablesOf,
  PointsOf,
  EnvironmentsOf,
  // modules 유틸리티 타입
  ModulesOf,
  ModuleKeysOf,
} from './types/config'

export type * from './types'

// ─── define 헬퍼 함수 ────────────────────────────────────────
export { defineNovelConfig, BUILTIN_MODULES } from './define/defineNovelConfig'
export type { BuiltinModules } from './define/defineNovelConfig'
export { defineCharacter } from './define/defineCharacter'
export { defineAssets, defineBackgrounds, defineAudios, defineEffects, defineFallback, defineCustomModules } from './define/defineConfigHelpers'
export { defineScene, defineInitial } from './define/defineScene'
export type { SceneDefinition, SceneBuilders } from './define/defineScene'

// ─── 모듈 팩토리 ─────────────────────────────────────────────
export { define, defineHook } from './define/defineCmdUI'
export type { NovelModule, NovelModuleMeta, BootCallback, ListenerSignature, DefaultHook, SceneHookDescriptor, AllHooksOf } from './define/defineCmdUI'

// ─── UI 시스템 ───────────────────────────────────────────────
export type { UIRuntimeEntry } from './core/UIRegistry'

// ─── 내장 모듈 ───────────────────────────────────────────────
export { default as dialogueModule, DEFAULT_DIALOGUE_BG, DEFAULT_DIALOGUE_SPEAKER, DEFAULT_DIALOGUE_TEXT, DEFAULT_DIALOGUE_LAYOUT } from './modules/dialogue'
export { default as choiceModule, DEFAULT_CHOICE_STYLE, DEFAULT_CHOICE_LAYOUT } from './modules/choice'
export { default as backgroundModule } from './modules/background'
export { default as characterModule, characterFocusModule, characterHighlightModule } from './modules/character'
export { default as moodModule } from './modules/mood'
export { default as effectModule } from './modules/effect'
export { overlayTextModule, overlayImageModule, overlayEffectModule } from './modules/overlay'
export { screenFadeModule, screenFlashModule, screenWipeModule } from './modules/screen'
export { cameraZoomModule, cameraPanModule, cameraEffectModule } from './modules/camera'
export { default as uiModule } from './modules/ui'
export { default as controlModule } from './modules/control'
export { default as dialogBoxModule, DEFAULT_DIALOG_BOX_STYLE, DEFAULT_DIALOG_BOX_LAYOUT } from './modules/dialogBox'
export { default as inputModule, DEFAULT_INPUT_STYLE, DEFAULT_INPUT_LAYOUT } from './modules/input'
export { default as elementModule } from './modules/element'

// ─── 코어 클래스 ─────────────────────────────────────────────
export { Novel } from './core/Novel'
export type { SaveData, CallStackFrame, NovelHook, NovelVarHookPayload, AllModuleHooksOf } from './core/Novel'
export { Renderer } from './core/Renderer'
export type { RendererOption, RendererState, CameraState } from './core/Renderer'
export { AudioManager } from './core/AudioManager'
export type { PlayOptions as AudioPlayOptions } from './core/AudioManager'
