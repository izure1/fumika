// =============================================================
// config.ts — Novel config 기반 타입 정의
// =============================================================

import type { World, Style, Attribute } from 'leviar'
import type { FallbackRuleOf, EffectType } from './dialogue'
import type { NovelModule } from '../define/defineCmdUI'
import type { Novel } from '../core/Novel'

/**
 * 캐릭터 베이스(신체) 이미지 정의.
 * `points`에 감정 파트를 배치할 앵커 좌표를 기록합니다.
 *
 * @example
 * const base: CharBaseDef = {
 *   src: 'girl_normal',
 *   width: 560,
 *   naturalWidth: 1120, // 원본 이미지 너비 (파트 스케일 계산용)
 *   points: {
 *     eyes:  { x: 0.5, y: 0.18 },
 *     mouth: { x: 0.5, y: 0.22, width: 120 },
 *   }
 * }
 */
export interface CharBaseDef {
  /** 베이스 이미지 에셋 키 */
  src?: string
  /** 렌더링 너비(px). 파트 이미지 스케일 계산의 기준이 됩니다. */
  width?: number
  /** 렌더링 높이(px). character-focus 높이 계산에 사용됩니다. */
  height?: number
  /**
   * 원본(소스) 이미지의 실제 너비(px).
   * scale = width / naturalWidth 로 파트 이미지 크기를 계산합니다.
   * 미지정 시 scale = 1 (파트 이미지를 그대로 사용).
   */
  naturalWidth?: number
  /**
   * 감정 파트를 배치할 앵커 포인트 목록 (정규화 좌표 0–1).
   * x: 좌→우, y: 위→아래.
   * `width`: 이 포인트에 배치될 파트 이미지의 렌더링 너비(px).
   *          미지정 시 파트 이미지 naturalWidth × scale 을 자동 계산합니다.
   */
  points?: Record<string, { x: number; y: number; width?: number }>
}

/**
 * 단일 캐릭터 정의: bases(신체) + emotions(표정 파트) 분리 구조.
 *
 * @example
 * const heroDef: CharDef = {
 *   name: '히어로',
 *   bases: {
 *     normal: { src: 'hero_body', width: 400, points: { eyes: { x: 0.5, y: 0.18 } } }
 *   },
 *   emotions: {
 *     normal: { eyes: 'hero_eyes_normal' },
 *     angry:  { eyes: 'hero_eyes_angry'  },
 *   }
 * }
 */
export interface CharDef {
  /** 캐릭터 표시용 이름 (대사창 등에 사용) */
  name?: string
  /** 신체(베이스) 이미지 목록: baseKey → CharBaseDef */
  bases: Record<string, CharBaseDef>
  /**
   * 감정(표정 파트) 목록: emotionKey → { pointKey: assetKey }.
   * pointKey는 베이스의 `points` 키와 일치해야 합니다.
   */
  emotions: Record<
    string,
    Record<
      string,
      | string
      | {
          src: string
          offset?: {
            x?: number
            y?: number
          }
        }
    >
  >
}
/** 캐릭터 목록 정의: charKey → CharDef 매핑 */
export type CharDefs = Record<string, CharDef>


/** 
 * 단일 배경 이미지 정의 
 * 
 * @example
 * const skyBg: BgDef = {
 *   src: 'sky_img',
 *   parallax: true // 카메라 이동 시 원근감 적용
 * }
 */
export interface BgDef {
  /** 
   * 배경 이미지의 에셋 키 또는 파일 경로입니다. 
   */
  src: string
  /**
   * 패럴럭스 스크롤 효과 활성화 여부입니다. 기본값은 `true`입니다.
   * - `true`  : 배경이 월드 좌표의 Z-depth에 배치되어, 카메라 이동 시 원근감에 따라 약간 느리게 움직입니다.
   * - `false` : 배경이 카메라의 자식 요소로 부착되어, 항상 화면에 고정된 상태로 표시됩니다.
   */
  parallax?: boolean
}
/** 배경 목록 정의: bgKey → BgDef 매핑 */
export type BgDefs = Record<string, BgDef>

/** 
 * 특수 효과(날씨, 파티클 등)의 상세 속성 정의입니다. 미지정 속성은 Renderer 내부 폴백 값을 따릅니다. 
 * 
 * @example
 * const rainEffect: EffectDef = {
 *   clip: { interval: 2, lifespan: 60, size: [[2, 2], [2, 2]] },
 *   particle: { attribute: { src: 'raindrop', strictPhysics: true } }
 * }
 */
export interface EffectDef {
  /** 
   * 파티클 매니저가 파티클을 방출할 때 사용하는 설정입니다. 
   * 클립(Clip) 객체의 속성으로 매핑됩니다.
   */
  clip?: Partial<{
    /** 방출 시 파티클에 가해지는 초기 물리 충격량(속도)입니다. */
    impulse: number
    /** 파티클의 생존 시간(프레임 단위)입니다. */
    lifespan: number
    /** 파티클 방출 주기(프레임 단위)입니다. 값이 작을수록 자주 방출됩니다. */
    interval: number
    /** 입자 크기의 단계별 변화 범위입니다. [[Min, Max], [Min, Max], ...] 형태로 각 단계에서 랜덤하게 결정됩니다. */
    size: [number, number][]
    /** 입자 투명도의 단계별 변화 범위입니다. [[Min, Max], [Min, Max], ...] 형태로 각 단계에서 랜덤하게 결정됩니다. */
    opacity: [number, number][]
    /** 파티클 애니메이션 루프 여부입니다. */
    loop: boolean
    /** 방출 시 파티클에 가해지는 초기 회전 충격량(각속도)입니다. */
    angularImpulse: number
  }>
  /** 방출되어 화면에 렌더링 되는 개별 파티클 객체의 스타일 및 속성 설정입니다. */
  particle?: {
    /** 파티클 객체의 물리, 이미지 소스, 질량 등 기본 속성 설정입니다. */
    attribute?: Partial<Attribute & { src?: string; strictPhysics?: boolean }>
    /** 파티클 객체의 크기, 색상, 정렬 등 시각적 스타일 설정입니다. */
    style?: Partial<Style>
  }
}

/** 
 * 커스텀/내장 명령어 실행 시 제공되는 컨텍스트 객체 
 */
export interface CustomCmdContext<TVars = any, TLocalVars = any, TEnvs = Record<string, any>> {
  /** Leviar 엔진의 World 인스턴스 */
  world: World
  /** Novel 인스턴스 */
  novel: Novel<any>
  /** 게임의 전역 변수 목록 */
  globalVars: TVars
  /** 현재 진행 중인 씬의 지역 변수 목록 */
  localVars: TLocalVars
  /** 환경변수 (모든 세이브 공유) */
  environments: TEnvs
}

/** 
 * Novel 시스템의 최상위 설정 객체 타입입니다.
 * 게임 내 모든 변수, 씬, 캐릭터, 배경, 효과, 모듈 및 폴백 규칙을 정의합니다.
 * 
 * @example
 * const config: NovelConfig<MyVars, MyScenes, MyChars, MyBgs> = {
 *   variables: { score: 0, flags: [] },
 *   scenes: ['intro', 'chapter1'],
 *   characters: { hero: { images: { normal: { src: 'hero_img' } } } },
 *   backgrounds: { classroom: { src: 'class_img' } },
 *   assets: { hero_img: './assets/hero.png' },
 *   modules: { 'dialogue': dialogueModule, 'character': characterModule },
 * }
 */
export interface NovelConfig<
  TVars extends Record<string, any>,
  TScenes extends readonly string[],
  TCharacters extends CharDefs,
  TBackgrounds extends BgDefs,
  TAssets extends Record<string, string> = Record<string, string>,
  TAudios extends Record<string, string> = Record<string, string>,
  TModules extends Record<string, NovelModule<any>> = Record<string, NovelModule<any>>,
  TEnvs extends Record<string, any> = Record<never, never>,
> {
  /** 
   * 씬의 논리적 렌더링 너비(px 단위)입니다. 
   * 미지정 시 캔버스의 실제 크기(canvas.width)를 사용합니다.
   */
  width?: number
  /** 
   * 씬의 논리적 렌더링 높이(px 단위)입니다. 
   * 미지정 시 캔버스의 실제 크기(canvas.height)를 사용합니다.
   */
  height?: number

  /** 게임의 전역 변수 초기값 목록입니다. */
  variables: TVars
  /** 게임에 포함된 모든 씬(Scene) 이름 목록입니다. */
  scenes: TScenes
  /** 게임에 등장하는 모든 캐릭터의 정의 목록입니다. */
  characters: TCharacters
  /** 게임에 사용되는 모든 배경 이미지 정의 목록입니다. */
  backgrounds: TBackgrounds
  /** 
   * 이펙트(비, 눈 등)의 상세 물리/시각적 설정 목록입니다. 
   * 미지정 시 렌더러(Renderer)의 기본값이 사용됩니다.
   */
  effects?: Partial<Record<EffectType, EffectDef>>
  /** 
   * 에셋의 키와 경로 매핑 목록입니다. 
   * 엔진 초기화 시점에 이 경로를 바탕으로 에셋을 자동 로드합니다.
   */
  assets?: TAssets
  /**
   * 오디오의 키와 경로 매핑 목록입니다.
   */
  audios?: TAudios
  /** 
   * 스크립트 실행 중 에셋이나 명령어가 누락되었을 때 적용할 기본값(폴백) 규칙 목록입니다. 
   * 배열의 첫 번째부터 순차적으로 매칭되어 적용됩니다.
   */
  fallback?: FallbackRuleOf<any>[]
  /**
   * Novel 모듈 목록입니다. key가 커맨드 타입(`type`)과 UIRegistry 등록 키가 됩니다.
   * `define()`으로 생성된 모듈을 등록하세요.
   *
   * @example
   * modules: {
   *   'dialogue': dialogueModule,
   *   'choices':  choiceModule,
   *   'background': backgroundModule,
   * }
   */
  modules?: TModules
  /**
   * 환경변수 초기값 목록입니다.
   * 모든 세이브 슬롯에서 공유되며, `novel.saveEnv()` / `novel.loadEnv()`로 수동 관리합니다.
   * 키는 반드시 `$`로 시작해야 합니다.
   *
   * @example
   * environments: {
   *   $textSpeed: 'normal',
   *   $seenEnding: false,
   * }
   */
  environments?: TEnvs
}

export type { FallbackRuleOf } from './dialogue'
export type { NovelModule, NovelModuleMeta } from '../define/defineCmdUI'



/** 
 * Novel 인스턴스를 생성할 때 전달하는 초기화 옵션 객체입니다.
 * 
 * @example
 * const option: NovelOption = {
 *   canvas: document.getElementById('game-canvas') as HTMLCanvasElement,
 *   width: 1920,
 *   height: 1080
 * }
 */
export interface NovelOption {
  /** 엔진을 마운트할 대상 HTML 엘리먼트입니다. 캔버스와 UI가 이 엘리먼트 내부에 생성됩니다. */
  element: HTMLElement
}

// =============================================================
// Config 유틸리티 타입
// =============================================================

/**
 * `NovelConfig`에서 캐릭터 키(`characters`의 key) 유니온을 추출합니다.
 *
 * @example
 * import config from './novel.config'
 * type CharKey = CharacterKeysOf<typeof config>
 */
export type CharacterKeysOf<TConfig> =
  TConfig extends NovelConfig<any, any, infer TChars, any, any, any, any, any>
  ? keyof TChars & string
  : string

/**
 * `NovelConfig`에서 특정 캐릭터의 이미지 키 유니온을 추출합니다.
 *
 * @example
 * type AriImg = ImageKeysOf<typeof config, 'arisiero'>  // 'normal' | 'smile'
 */
type _BasesKeysOf<TConfig, TCharKey extends string> =
  TConfig extends NovelConfig<any, any, infer TChars, any, any, any, any, any>
  ? TCharKey extends keyof TChars
  ? TChars[TCharKey] extends { bases: infer TBases }
  ? keyof TBases & string
  : string
  : string
  : string

type _EmotionsKeysOf<TConfig, TCharKey extends string> =
  TConfig extends NovelConfig<any, any, infer TChars, any, any, any, any, any>
  ? TCharKey extends keyof TChars
  ? TChars[TCharKey] extends { emotions: infer TEmotions }
  ? keyof TEmotions & string
  : string
  : string
  : string

/**
 * `NovelConfig`에서 특정 캐릭터의 이미지 키 유니온을 추출합니다.
 * `'base:emotion'` 형태의 템플릿 리터럴 타입을 반환합니다.
 *
 * @example
 * type FumikaImg = ImageKeysOf<typeof config, 'fumika'>  // 'normal:normal' | 'normal:smile' | ...
 */
export type ImageKeysOf<TConfig, TCharKey extends CharacterKeysOf<TConfig>> =
  `${_BasesKeysOf<TConfig, TCharKey>}:${_EmotionsKeysOf<TConfig, TCharKey>}`

/**
 * `NovelConfig`에서 에셋 키(`assets`의 key) 유니온을 추출합니다.
 *
 * @example
 * type Asset = AssetKeysOf<typeof config>  // 'bg_floor' | 'girl_normal' | ...
 */
export type AssetKeysOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, infer TAssets, any, any, any>
  ? keyof TAssets & string
  : string

/**
 * `NovelConfig`에서 배경 키(`backgrounds`의 key) 유니온을 추출합니다.
 *
 * @example
 * type BgKey = BackgroundKeysOf<typeof config>  // 'bg-floor' | 'bg-library' | ...
 */
export type BackgroundKeysOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, infer TBgs, any, any, any, any>
  ? keyof TBgs & string
  : string

/**
 * `NovelConfig`에서 씬 이름(`scenes`의 원소) 유니온을 추출합니다.
 *
 * @example
 * type Scene = SceneNamesOf<typeof config>  // 'scene-intro' | 'scene-a' | ...
 */
export type SceneNamesOf<TConfig> =
  TConfig extends NovelConfig<any, infer TScenes, any, any, any, any, any, any>
  ? TScenes[number]
  : string

/**
 * 씬 전환 대상 타입입니다.
 * - `string`: 씬 이름 (현재 씬의 오브젝트 전부 파기 후 전환)
 * - `{ scene, preserve }`: preserve가 true이면 현재씬의 렌더러 추적 오브젝트를 파기하지 않고 다음 씬을 시작합니다.
 *
 * @example
 * // 단순 전환
 * next: 'scene-b'
 *
 * // preserve 모드 (배경·캐릭터·무드·파티클 유지)
 * next: { scene: 'scene-b', preserve: true }
 */
export type SceneNextTarget<TConfig> =
  | SceneNamesOf<TConfig>
  | { scene: SceneNamesOf<TConfig>; preserve: boolean }

/**
 * `NovelConfig`에서 전역 변수 타입(`vars`)을 추출합니다.
 *
 * @example
 * type Vars = VariablesOf<typeof config>  // { likeability: number; metHeroine: boolean; ... }
 */
export type VariablesOf<TConfig> =
  TConfig extends NovelConfig<infer TVars, any, any, any, any, any, any, any>
  ? TVars
  : Record<string, any>

/**
 * `NovelConfig`에서 특정 캐릭터(`TName`)의 모든 이미지에 정의된 `points` 키 유니온을 추출합니다.
 * `character-focus`의 `point` 자동완성에 사용됩니다.
 *
 * @example
 * type AriPoints = PointsOf<typeof config, 'arisiero'>  // 'face' | 'chest'
 */
export type PointsOf<TConfig, TName extends CharacterKeysOf<TConfig> = CharacterKeysOf<TConfig>> =
  TConfig extends NovelConfig<any, any, infer TChars, any, any, any, any, any>
  ? TName extends keyof TChars
  ? TChars[TName] extends { bases: infer TBases }
  ? TBases[keyof TBases] extends { points?: infer P }
  ? keyof P & string
  : string
  : string
  : string
  : string

/**
 * `NovelConfig`에서 모듈 맵(`modules`)을 추출합니다.
 *
 * @example
 * type Mods = ModulesOf<typeof config>  // { 'dialogue': NovelModule<...>, ... }
 */
export type ModulesOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, any, any, infer TMods, any>
  ? TMods
  : Record<never, never>

/**
 * `NovelConfig`에서 모듈 키(`modules`의 key) 유니온을 추출합니다.
 *
 * @example
 * type ModKey = ModuleKeysOf<typeof config>  // 'dialogue' | 'choices' | 'background'
 */
export type ModuleKeysOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, any, any, infer TMods, any>
  ? keyof TMods & string
  : string

/**
 * `NovelConfig`에서 오디오 키(`audios`의 key) 유니온을 추출합니다.
 *
 * @example
 * type AudioKey = AudioKeysOf<typeof config>  // 'bgm-01' | 'sfx-02' | ...
 */
export type AudioKeysOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, any, infer TAudios, any, any>
  ? keyof TAudios & string
  : string

/**
 * `NovelConfig`에서 환경변수 타입(`environments`)을 추출합니다.
 *
 * @example
 * type Envs = EnvironmentsOf<typeof config>  // { $textSpeed: string; $seenEnding: boolean; ... }
 */
export type EnvironmentsOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, any, any, any, infer TEnvs>
  ? TEnvs
  : Record<string, any>
