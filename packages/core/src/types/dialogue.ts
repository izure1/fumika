// =============================================================
// dialogue.ts — 모든 DialogueEntry 유니온 타입 정의
// =============================================================

import type { ModulesOf, VariablesOf } from './config'
import type { ResolvableProps } from '../define/defineCmd'
import type { NovelModule } from '../define/defineCmdUI'

// 인터페이스 import
import type { DialogueCmd } from '../modules/dialogue'
import type { ChoiceCmd } from '../modules/choice'
import type { BackgroundCmd } from '../modules/background'
import type { MoodCmd } from '../modules/mood'
import type { EffectCmd } from '../modules/effect'
import type { OverlayTextCmd, OverlayImageCmd, OverlayEffectCmd } from '../modules/overlay'
import type { CharacterCmd, CharacterFocusCmd, CharacterHighlightCmd, CharacterEffectCmd } from '../modules/character'
import type { CameraZoomCmd, CameraPanCmd, CameraEffectCmd } from '../modules/camera'
import type { ScreenFadeCmd, ScreenFlashCmd, ScreenWipeCmd } from '../modules/screen'
import type { UICmd } from '../modules/ui'
import type { ControlCmd } from '../modules/control'
import type { AudioCmd } from '../modules/audio'
import type { DialogBoxCmd } from '../modules/dialogBox'
import type { InputCmd } from '../modules/input'
import type { ElementCmd } from '../modules/element'

// 인터페이스 export
export type * from '../modules/dialogue'
export type * from '../modules/choice'
export type * from '../modules/background'
export type * from '../modules/mood'
export type * from '../modules/effect'
export type * from '../modules/overlay'
export type * from '../modules/character'
export type * from '../modules/camera'
export type * from '../modules/ui'
export type * from '../modules/control'
export type * from '../modules/audio'
export type * from '../modules/dialogBox'
export type * from '../modules/input'
export type * from '../modules/screen'
export type * from '../modules/element'


// ─── 흐름제어 예약어 타입 ────────────────────────────────────

/** 라벨 마커. 씬 내부 점프 위치를 정의합니다. */
export interface LabelCmd {
  name: string
}

/** 라벨 위치로 실행 커서를 이동합니다. */
export interface GotoCmd {
  label: string
}

/** 다른 씬으로 전환합니다. */
export interface NextCmd {
  scene: string
  preserve?: boolean
}

/** 다른 씬을 서브루틴으로 호출합니다. */
export interface CallCmd {
  scene: string
  preserve?: boolean
  restore?: boolean
}

/** 빌드타임 평탄화된 조건 분기. 조건이 거짓이면 elseGoto로 점프합니다. */
export interface ConditionFlowCmd {
  if: ((vars: any) => boolean) | boolean
  elseGoto?: string
}

/** 변수 값을 설정합니다. `_` 접두사는 지역변수, 아니면 전역변수. */
export interface SetCmd {
  name: string
  value: any
}

// ─── 스텝 공통 필드 ──────────────────────────────────────────

/** 모든 DialogueEntry에 공통으로 붙는 메타 필드 */
interface _StepBase {
  /** true일 경우, 사용자 입력을 기다리지 않고 즉시 다음 스텝으로 넘어갑니다. */
  skip?: boolean
}

// ─── 빌트인 명령어 룩업 테이블 ───────────────────────────────

/**
 * `type` 문자열 → Cmd 인터페이스 매핑 테이블.
 * 새 빌트인 명령어 추가 시 여기에 한 줄 추가하면 됩니다.
 * 흐름제어 예약어(label, goto, next, call, condition)는 포함하지 않습니다.
 */
export type BuiltinCmdMap<TConfig = any, TVars = any, TLocalVars = any> = {
  'dialogue': DialogueCmd<TConfig>
  'choice': ChoiceCmd<TConfig, TLocalVars>
  'background': BackgroundCmd<TConfig>
  'mood': MoodCmd
  'effect': EffectCmd<TConfig>
  'overlay-text': OverlayTextCmd
  'overlay-image': OverlayImageCmd<TConfig>
  'overlay-effect': OverlayEffectCmd
  'character': CharacterCmd<TConfig>
  'character-focus': CharacterFocusCmd<TConfig>
  'character-highlight': CharacterHighlightCmd<TConfig>
  'character-effect': CharacterEffectCmd<TConfig>
  'camera-zoom': CameraZoomCmd
  'camera-pan': CameraPanCmd
  'camera-effect': CameraEffectCmd
  'screen-fade': ScreenFadeCmd
  'screen-flash': ScreenFlashCmd
  'screen-wipe': ScreenWipeCmd
  'ui': UICmd<TConfig>
  'control': ControlCmd
  'audio': AudioCmd<TConfig>
  'dialogBox': DialogBoxCmd<TConfig>
  'input': InputCmd<TConfig, TLocalVars>
  'element': ElementCmd<TConfig>
}

/**
 * 흐름제어 예약어 매핑 테이블.
 * defineScene의 builder에서만 생성되며, ctx.execute에서는 접근 불가.
 */
type FlowControlMap = {
  'label': LabelCmd
  'goto': GotoCmd
  'next': NextCmd
  'call': CallCmd
  'condition': ConditionFlowCmd
  'var': SetCmd
}

/** 흐름제어 유니온 (defineScene 전용) */
export type FlowControlEntry = {
  [K in keyof FlowControlMap]: { type: K } & FlowControlMap[K] & _StepBase
}[keyof FlowControlMap]

// ─── 유니온 생성 ─────────────────────────────────────────────

/**
 * 빌트인 명령어 유니온.
 * `BuiltinCmdMap`의 각 엔트리에 `{ type: K } & _StepBase`를 합치고
 * `ResolvableProps`로 감싸 **단일 mapped type**으로 만듭니다.
 *
 * intersection(`A & MappedType`)이 아닌 단일 mapped type이므로
 * IDE가 모든 속성을 eager하게 열거할 수 있습니다.
 */
type _BuiltinEntryUnion<TConfig, TVars, TLocalVars> = {
  [K in keyof BuiltinCmdMap<TConfig, TVars, TLocalVars>]:
  ResolvableProps<
    BuiltinCmdMap<TConfig, TVars, TLocalVars>[K] & { type: K } & _StepBase,
    TVars,
    TLocalVars
  >
}[keyof BuiltinCmdMap<TConfig, TVars, TLocalVars>]

/**
 * 사용자 정의 모듈 명령어 유니온.
 * `config.modules`에 등록된 각 모듈의 TCmd 스키마로부터 생성됩니다.
 *
 * `BuiltinCmdMap` 키는 제외합니다. 내장 모듈은 `_BuiltinEntryUnion`에서
 * `TConfig`가 전파된 상태로 이미 포함되므로, `CustomCmd`에서 중복 생성하면
 * `TConfig = any`로 인해 `AssetKeysOf` 등이 `string`으로 풀려 타입 체크가 무력화됩니다.
 */
export type CustomCmd<TConfig, TVars = any, TLocalVars = any> = {
  [K in Exclude<keyof ModulesOf<TConfig> & string, keyof BuiltinCmdMap<TConfig, TVars, TLocalVars>>]:
  ModulesOf<TConfig>[K] extends NovelModule<infer TSchema>
  ? ResolvableProps<TSchema & { type: K } & _StepBase, TVars, TLocalVars>
  : never
}[Exclude<keyof ModulesOf<TConfig> & string, keyof BuiltinCmdMap<TConfig, TVars, TLocalVars>>]

// ─── 최종 타입 ───────────────────────────────────────────────

/** 모듈 커맨드 유니온. ctx.execute 파라미터 타입으로 사용됩니다. */
export type DialogueEntry<TConfig, TVars, TLocalVars> =
  | _BuiltinEntryUnion<TConfig, TVars, TLocalVars>
  | CustomCmd<TConfig, TVars, TLocalVars>

/** 씬 스텝 유니온. 모듈 커맨드 + 흐름제어 예약어 모두 포함합니다. */
export type DialogueStep<TConfig, TLocalVars = Record<never, never>, TVars = VariablesOf<TConfig>> =
  | DialogueEntry<TConfig, TVars, TLocalVars>
  | FlowControlEntry

// ─── Fallback 룰 ─────────────────────────────────────────────

/** 모듈 스키마를 기반으로 폴백 규칙의 타입을 추론하는 제네릭입니다. */
export type FallbackRuleOf<
  TModules extends Record<string, NovelModule<any>> = Record<never, never>
> = _BuiltinEntryUnion<
  { modules?: TModules },
  any,
  any
> extends infer E
  ? E extends { type: infer Type }
  ? { type: Type } & Partial<Omit<E, 'type' | 'skip'>> & { defaults?: Partial<Omit<E, 'skip'>> }
  : never
  : never
