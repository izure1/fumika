import type { CharDef, CharDefs, CharBaseDef, CharacterKeysOf, ImageKeysOf, PointsOf } from '../types/config'
import type { ZoomPreset, CameraPanCmd, CameraZoomCmd, CameraEffectPreset } from './camera'
import { playMotionEffect } from '../core/motion'
import type { LeviarObject, EasingType } from 'leviar'
import type { CommandResult } from '../core/SceneContext'
import type { SceneContext } from '../core/SceneContext'
import { Z_INDEX } from '../constants/render'
import { define } from '../define/defineCmdUI'
import type { SetStateFn } from '../define/defineCmdUI'

export type CharacterPositionPreset = 'inherit' | 'far-left' | 'left' | 'center' | 'right' | 'far-right' | (string & {})

/** 
 * 캐릭터를 등장 또는 이동시키거나 퇴장시킨다 
 */
export type CharacterCmd<TConfig = any> = {
  [Name in CharacterKeysOf<TConfig>]:
  | {
    /** 캐릭터에 수행할 동작입니다. ('show') */
    action: 'show'
    /** 조작할 캐릭터의 이름(키)입니다. */
    name: Name
    /** 캐릭터의 위치 프리셋입니다. */
    position?: CharacterPositionPreset
    /** 표시할 캐릭터 이미지의 키입니다. */
    image?: ImageKeysOf<TConfig, Name>
    /** 캐릭터 등장 시 카메라를 해당 캐릭터에 포커스할지 여부입니다. */
    focus?: boolean | PointsOf<TConfig, Name> | (string & {})
    /** 등장 애니메이션의 지속 시간(ms)입니다. */
    duration?: number
    /** 등장 애니메이션의 이징 함수 이름입니다. */
    ease?: EasingType
  }
  | {
    /** 캐릭터에 수행할 동작입니다. ('remove') */
    action: 'remove'
    /** 조작할 캐릭터의 이름(키)입니다. */
    name: Name
    /** 퇴장 애니메이션의 지속 시간(ms)입니다. */
    duration?: number
    /** 퇴장 애니메이션의 이징 함수 이름입니다. */
    ease?: EasingType
  }
}[CharacterKeysOf<TConfig>]

/** 카메라를 캐릭터에 포커스한다 */
export type CharacterFocusCmd<TConfig = any> = {
  [Name in CharacterKeysOf<TConfig>]: {
    /** 포커스할 캐릭터의 이름입니다. */
    name: Name
    /** 포커스할 포인트(부위)의 키 또는 'inherit'입니다. */
    point?: PointsOf<TConfig, Name> | 'inherit' | (string & {})
    /** 줌 배율 프리셋입니다. */
    zoom?: ZoomPreset
    /** 포커스 이동 애니메이션의 지속 시간(ms)입니다. */
    duration?: number
    /** 포커스 이동 애니메이션의 이징 함수 이름입니다. */
    ease?: EasingType
  }
}[CharacterKeysOf<TConfig>]

/** 캐릭터를 컷인(전면) 레이어로 올리거나 복원한다 */
export type CharacterHighlightCmd<TConfig = any> = {
  [Name in CharacterKeysOf<TConfig>]: {
    /** 하이라이트할 캐릭터의 이름입니다. */
    name: Name
    /** 하이라이트 효과를 켜거나 끕니다. */
    action: 'on' | 'off'
    /** 전환 애니메이션의 지속 시간(ms)입니다. */
    duration?: number
    /** 전환 애니메이션의 이징 함수 이름입니다. */
    ease?: EasingType
  }
}[CharacterKeysOf<TConfig>]

/** 캐릭터 효과(흔들림 등)를 재생한다 */
export interface CharacterEffectCmd<TConfig = any> {
  /** 효과를 적용할 캐릭터의 이름입니다. */
  name: CharacterKeysOf<TConfig>
  /** 연출 효과의 프리셋 이름입니다. */
  preset: CameraEffectPreset
  /** 효과의 전체 지속 시간(ms)입니다. */
  duration?: number
  /** 효과의 강도입니다. 프리셋의 기본값을 덮어씁니다. */
  intensity?: number
  /** 효과를 반복할 횟수입니다. (기본값: 1, 음수일 경우 무한반복) */
  repeat?: number
}

// ─── 스키마 ──────────────────────────────────────────────────

export interface CharacterSchema {
  /** @internal name → { position, imageKey } 맵 */
  _characters: Record<string, { position: string; imageKey: string }>
  /** @internal 최근 전환 애니메이션 지속 시간 (ms) */
  _lastDuration?: number
  /** @internal 최근 전환 애니메이션 이징 함수 이름 */
  _lastEase?: string
}

// ─── 위치/포커스 헬퍼 ────────────────────────────────────────

const CHARACTER_X_RATIO: Record<string, number> = {
  'far-left': 0.1,
  'left': 0.25,
  'center': 0.5,
  'right': 0.75,
  'far-right': 0.9,
}

function resolvePositionX(position: string): number {
  if (CHARACTER_X_RATIO[position] !== undefined) return CHARACTER_X_RATIO[position]
  const m = position.match(/^(\d+)\/(\d+)$/)
  if (m) {
    const n = parseInt(m[1], 10)
    const d = parseInt(m[2], 10)
    if (d > 0) return n / (d + 1)
  }
  return 0.5
}

// ─── 모듈 정의 ───────────────────────────────────────────────

export interface CharacterRenderObj extends LeviarObject<Record<string, any>, Record<string, any>> {
  _currentBaseKey?: string
  _currentEmotionKey?: string
  /** pointKey → part LeviarObject */
  _partObjs?: Record<string, LeviarObject<Record<string, any>, Record<string, any>>>
  transition?: (src: string, dur: number) => void
  __activeCharEffectStop?: (() => void) | null
}

interface CharacterViewEntry {
  show: () => void
  hide: () => void
  getObj: (name: string) => CharacterRenderObj | undefined
  onUpdate: (ctx: SceneContext, state: CharacterSchema, setState: SetStateFn<CharacterSchema>) => void
}

/**
 * 캐릭터 모듈. `novel.config`의 `modules: { 'character': characterModule }` 형태로 등록합니다.
 */
const characterModule = define<CharacterCmd<any>, CharacterSchema>({
  _characters: {},
})

characterModule.defineView((ctx, data, setState) => {
  // 내부 canvas 오브젝트 맵
  const _charObjs: Record<string, CharacterRenderObj> = {}

  // ─── 헬퍼: imageKey 파싱 ──────────────────────────────────

  function parseImageKey(imageKey: string): { baseKey: string; emotionKey: string } {
    const idx = imageKey.indexOf(':')
    if (idx === -1) return { baseKey: imageKey, emotionKey: imageKey }
    return { baseKey: imageKey.slice(0, idx), emotionKey: imageKey.slice(idx + 1) }
  }

  // ─── 헬퍼: loader.assets에서 이미지 읽기 ─────

  function getLoadedImage(key: string): HTMLImageElement | undefined {
    return ctx.renderer.world.loader.assets[key] as HTMLImageElement | undefined
  }

  // ─── 헬퍼: emotion 파트 생성/업데이트 ──────────────────────

  const _updateEmotionParts = (
    baseObj: CharacterRenderObj,
    baseDef: CharBaseDef,
    emotionDef: Record<
      string,
      | string
      | {
          src: string
          offset?: {
            x?: number
            y?: number
          }
        }
    >,
    dur: number,
    ease: EasingType = 'easeInOutQuad'
  ) => {
    if (!baseDef.points) return
    if (!baseObj._partObjs) baseObj._partObjs = {}

    const baseSrc = baseDef.src ?? (baseObj._currentBaseKey ?? '')
    const baseImg = getLoadedImage(baseSrc)

    const baseWidth = baseDef.width ?? 500
    const baseNaturalW = baseDef.naturalWidth ?? baseImg?.naturalWidth ?? baseWidth
    const scale = baseWidth / baseNaturalW

    const baseHeight = baseDef.height ?? (
      (baseObj.__renderedSize?.h ?? 0) > 0 ? baseObj.__renderedSize!.h :
        (baseImg ? baseWidth * (baseImg.naturalHeight / baseImg.naturalWidth) : baseWidth * 2)
    )

    for (const [pointKey, point] of Object.entries(baseDef.points)) {
      const partVal = emotionDef[pointKey]
      if (!partVal) continue

      let partSrc: string
      let offsetX = 0
      let offsetY = 0

      if (typeof partVal === 'string') {
        partSrc = partVal
      } else {
        partSrc = partVal.src
        if (partVal.offset) {
          offsetX = partVal.offset.x ?? 0
          offsetY = partVal.offset.y ?? 0
        }
      }

      // base 로컬 좌표 (addChild → base 기준 상대 좌표)
      const localX = baseWidth * (point.x + offsetX - 0.5)
      const localY = baseHeight * (0.5 - (point.y + offsetY))

      const existingPart = baseObj._partObjs[pointKey]

      if (existingPart) {
        // src 교체, 위치 animate
        if (existingPart.attribute && existingPart.attribute.src !== partSrc) {
          if (dur > 0 && typeof (existingPart as any).transition === 'function') {
            (existingPart as any).transition(partSrc, dur)
          } else {
            existingPart.attribute.src = partSrc
          }
        }
        ctx.renderer.animate(existingPart, { transform: { position: { x: localX, y: localY } } }, dur, ease)
      } else {
        // 파트 너비: point.width 우선, 없으면 loader.assets에서 naturalWidth × scale
        const partNaturalW = getLoadedImage(partSrc)?.naturalWidth
        const partWidth = point.width ?? (partNaturalW !== undefined ? Math.round(partNaturalW * scale) : undefined)

        // 신규 파트 생성 → base의 자식으로 등록
        const partObj = ctx.renderer.world.createImage({
          attribute: { src: partSrc },
          style: {
            width: partWidth,
            zIndex: Z_INDEX.CHARACTER_NORMAL + 1,
          },
          transform: { position: { x: localX, y: localY, z: 0 } }
        }) as LeviarObject<Record<string, any>, Record<string, any>>
        baseObj.addChild(partObj)
        baseObj._partObjs[pointKey] = partObj
      }
    }

    // 더 이상 필요 없는 파트 제거
    for (const [pointKey, partObj] of Object.entries(baseObj._partObjs)) {
      if (!baseDef.points[pointKey] || !emotionDef[pointKey]) {
        baseObj.removeChild(partObj)
        partObj.remove()
        delete baseObj._partObjs[pointKey]
      }
    }
  }

  // ─── 캐릭터 표시 ─────────────────────────────────────────────

  const _showCharacter = (
    name: string,
    position: string,
    imageKey: string,
    duration?: number,
    ease: EasingType = 'easeInOutQuad',
    immediate = false
  ) => {
    const charDefs = ctx.renderer.config.characters as CharDefs
    const def = charDefs[name] as CharDef
    if (!def) return

    const allBaseKeys = Object.keys(def.bases)
    const allEmotionKeys = Object.keys(def.emotions)
    const { baseKey, emotionKey } = parseImageKey(
      imageKey || `${allBaseKeys[0]}:${allEmotionKeys[0]}`
    )

    const baseDef = def.bases[baseKey]
    const emotionDef = def.emotions[emotionKey]
    if (!baseDef || !emotionDef) return

    const src = baseDef.src ?? baseKey
    const xPos = ctx.renderer.width * (resolvePositionX(position) - 0.5)
    const zPos = (ctx.renderer.world.camera)?.attribute?.focalLength ?? 100
    const dur = immediate ? 0 : ctx.renderer.dur(duration ?? 400)
    const baseWidth = baseDef.width ?? 500

    const existing = _charObjs[name]
    if (existing) {
      ctx.renderer.animate(existing, { transform: { position: { x: xPos } } }, dur, ease)

      // base 교체
      if (baseKey !== existing._currentBaseKey) {
        if (dur > 0 && typeof existing.transition === 'function') {
          existing.transition(src, dur)
        } else {
          if (existing.attribute) existing.attribute.src = src
        }
        if (existing.style) existing.style.width = baseWidth
        existing._currentBaseKey = baseKey
      }

      // emotion 파트 교체
      if (emotionKey !== existing._currentEmotionKey || baseKey !== existing._currentBaseKey) {
        _updateEmotionParts(existing, baseDef, emotionDef, dur, ease)
        existing._currentEmotionKey = emotionKey
      }
      return
    }

    // 신규 오브젝트 생성
    const obj = ctx.renderer.world.createImage({
      attribute: { src },
      style: {
        width: baseWidth,
        opacity: dur > 0 ? 0 : 1,
        zIndex: Z_INDEX.CHARACTER_NORMAL,
      },
      transform: { position: { x: xPos, y: 0, z: zPos } }
    }) as CharacterRenderObj
    obj._currentBaseKey = baseKey
    obj._currentEmotionKey = emotionKey
    obj._partObjs = {}
    _charObjs[name] = obj

    _updateEmotionParts(obj, baseDef, emotionDef, 0)

    if (dur > 0) {
      // base opacity 0→1 → child(part)도 자동 상속
      ctx.renderer.animate(obj, { style: { opacity: 1 } }, dur)
    }
  }

  const _removeCharacter = (name: string, duration?: number, ease: EasingType = 'easeInOutQuad') => {
    const obj = _charObjs[name]
    if (obj) {
      delete _charObjs[name]
      const dur = ctx.renderer.dur(duration ?? 400)

      if (dur > 0) {
        // base opacity 0으로 → child(part)도 자동 fade out
        ctx.renderer.animate(obj, { style: { opacity: 0 } }, dur, ease, () => {
          obj.remove({ child: true })
          obj._partObjs = {}
        })
      } else {
        obj.remove({ child: true })
        obj._partObjs = {}
      }
    }
  }

  // 복원: 저장된 캐릭터들 즉시 렌더
  for (const [name, info] of Object.entries(data._characters)) {
    _showCharacter(name, info.position, info.imageKey, undefined, 'easeInOutQuad', true)
  }

  return {
    show: () => { },
    hide: () => { },
    onCleanup: () => {
      for (const obj of Object.values(_charObjs)) {
        obj.remove({ child: true })
      }
      Object.keys(_charObjs).forEach(k => delete _charObjs[k])
    },
    getObj: (name: string) => _charObjs[name],
    onUpdate: (_ctx, d: CharacterSchema, _setState) => {
      const dur = d._lastDuration
      const ease = (d._lastEase ?? 'easeInOutQuad') as EasingType
      const newNames = new Set(Object.keys(d._characters))
      for (const name of Object.keys(_charObjs)) {
        if (!newNames.has(name)) {
          _removeCharacter(name, dur, ease)
        }
      }
      for (const [name, info] of Object.entries(d._characters)) {
        _showCharacter(name, info.position, info.imageKey, dur, ease)
      }
    },
  }
})

characterModule.defineCommand(function* (cmd, ctx, state, setState) {
  const newChars = { ...state._characters }

  if (cmd.action === 'show') {
    const showCmd = cmd
    const charDefs = ctx.renderer.config.characters as CharDefs
    const def = charDefs[showCmd.name] as CharDef
    if (!def) return true

    const allBaseKeys = Object.keys(def.bases)
    const allEmotionKeys = Object.keys(def.emotions)

    const existingState = newChars[showCmd.name]
    const resolvedPosition = (!showCmd.position || showCmd.position === 'inherit')
      ? (existingState?.position ?? 'center')
      : showCmd.position
    const resolvedKey = showCmd.image ?? `${allBaseKeys[0]}:${allEmotionKeys[0]}`

    newChars[showCmd.name] = { position: resolvedPosition, imageKey: resolvedKey as string }
    setState({ _characters: newChars, _lastDuration: cmd.duration, _lastEase: showCmd.ease })

    // focus 처리 (view의 getObj 사용)
    // state.characters 변경 → proxy microtask로 update() 예약됨
    // → 동기 호출 시 _charObjs 미갱신 → Promise.resolve().then()으로 연기
    if (showCmd.focus) {
      const focusType = typeof showCmd.focus === 'string' ? showCmd.focus : undefined
      const focusDuration = showCmd.duration ?? 800

      const entry = ctx.ui.get('character') as CharacterViewEntry | undefined
      const charObj = entry?.getObj(showCmd.name)
      if (charObj) {
        if (!charObj.__renderedSize || charObj.__renderedSize.h <= 0) {
          const checkSize = () => {
            if (charObj.__renderedSize && charObj.__renderedSize.h > 0) {
              ctx.callbacks.advance()
            } else {
              requestAnimationFrame(checkSize)
            }
          }
          requestAnimationFrame(checkSize)
          yield false
        }
        const cmds = _calcFocusCommands(ctx, showCmd.name, charObj, def, focusType, 'inherit', focusDuration, showCmd.ease)
        for (const c of cmds) {
          const res = ctx.execute(c)
          if (res && typeof (res as Generator).next === 'function') {
            yield* (res as Generator<CommandResult, CommandResult, unknown>)
          }
        }
      }
    }
  } else {
    delete newChars[cmd.name]
    setState({ _characters: newChars, _lastDuration: cmd.duration, _lastEase: cmd.ease })
  }

  return true
})

export default characterModule

// ─── character-focus 모듈 ────────────────────────────────────

function _calcFocusCommands(
  ctx: SceneContext,
  name: string,
  target: CharacterRenderObj | undefined | null,
  def: CharDef,
  focusType?: string,
  fit: ZoomPreset = 'inherit',
  duration: number = 800,
  ease?: EasingType
): [(CameraPanCmd & { type: 'camera-pan' }), (CameraZoomCmd & { type: 'camera-zoom' })] | [] {
  if (!target) return []
  const activeBaseKey = target._currentBaseKey ?? Object.keys(def.bases)[0]
  const baseDef = def.bases[activeBaseKey]
  const fp = (focusType && baseDef?.points) ? baseDef.points[focusType] : { x: 0.5, y: 0.5 }

  const targetX = Number(target.transform?.position?.x ?? 0)
  const charW = Number(target.style?.width ?? 500)
  const rendH = target.__renderedSize?.h
  const charH = Number(baseDef?.height ?? ((rendH && Number(rendH) > 0) ? Number(rendH) : charW * 2))

  const panX = targetX + charW * (fp.x - 0.5)
  const panY = charH * (0.5 - fp.y)

  const cam = ctx.renderer.world.camera as any
  const zPos = 2000
  const baseW = ctx.renderer.width
  const baseH = ctx.renderer.height
  const maxPanX = baseW * 0.08
  const maxPanY = baseH * 0.08
  const ratio = cam && typeof cam.calcDepthRatio === 'function' ? cam.calcDepthRatio(zPos, 1) : 1

  const maxCamX = ratio > 0 && !isNaN(ratio) ? (maxPanX * ratio) : maxPanX
  const maxCamY = ratio > 0 && !isNaN(ratio) ? (maxPanY * ratio) : maxPanY

  let ratioX = 0.5
  let ratioY = 0.5

  if (maxCamX > 0 && !isNaN(maxCamX)) {
    ratioX = (panX / (2 * maxCamX)) + 0.5
  }
  if (maxCamY > 0 && !isNaN(maxCamY)) {
    ratioY = 0.5 - (panY / (2 * maxCamY))
  }

  if (isNaN(ratioX)) ratioX = 0.5
  if (isNaN(ratioY)) ratioY = 0.5

  const clampedX = Math.max(0, Math.min(1, ratioX))
  const clampedY = Math.max(0, Math.min(1, ratioY))

  return [
    { type: 'camera-pan', duration, ease, x: clampedX, y: clampedY },
    { type: 'camera-zoom', preset: fit, duration, ease }
  ]
}

export interface CharacterFocusSchema { _unused: undefined }

const characterFocusModule = define<CharacterFocusCmd<any>, CharacterFocusSchema>({ _unused: undefined })

characterFocusModule.defineView((_ctx, _data, _setState) => ({
  show: () => { },
  hide: () => { },
  onCleanup: () => { },
}))

characterFocusModule.defineCommand(function* (cmd, ctx) {
  const entry = ctx.ui.get('character') as CharacterViewEntry | undefined
  const charObj = entry?.getObj(cmd.name)
  if (!charObj) return true

  const charDefs = ctx.renderer.config.characters as CharDefs
  const def = charDefs[cmd.name] as CharDef
  if (!def) return true

  if (!charObj.__renderedSize || charObj.__renderedSize.h <= 0) {
    const checkSize = () => {
      if (charObj.__renderedSize && charObj.__renderedSize.h > 0) {
        ctx.callbacks.advance()
      } else {
        requestAnimationFrame(checkSize)
      }
    }
    requestAnimationFrame(checkSize)
    yield false
  }
  const cmds = _calcFocusCommands(ctx, cmd.name, charObj, def, cmd.point, cmd.zoom ?? 'inherit', cmd.duration ?? 800, cmd.ease)
  for (const c of cmds) {
    const res = ctx.execute(c)
    if (res && typeof (res as Generator).next === 'function') {
      yield* (res as Generator<CommandResult, CommandResult, unknown>)
    }
  }
  return true
})

export { characterFocusModule }

// ─── character-highlight 모듈 ────────────────────────────────

export interface CharacterHighlightSchema { _unused: undefined }

const characterHighlightModule = define<CharacterHighlightCmd<any>, CharacterHighlightSchema>({ _unused: undefined })

characterHighlightModule.defineView((_ctx, _data, _setState) => ({
  show: () => { },
  hide: () => { },
  onCleanup: () => { },
}))

characterHighlightModule.defineCommand(function* (_cmd, _ctx) {
  // 구현 미완, skip
  return true
})

export { characterHighlightModule }

// ─── character-effect 모듈 ───────────────────────────────────

export interface CharacterEffectSchema {
  _activeEffects: Record<string, {
    preset: CameraEffectPreset
    duration?: number
    intensity?: number
    remaining: number
  }>
}

const characterEffectModule = define<CharacterEffectCmd<any>, CharacterEffectSchema>({
  _activeEffects: {},
})

characterEffectModule.defineView((ctx, data, _setState) => {
  // 복원: 저장된 캐릭터 효과 재생
  // 다른 모듈(character)의 뷰 빌드 완료를 보장하기 위해 지연 실행합니다.
  if (Object.keys(data._activeEffects).length > 0) {
    setTimeout(() => {
      const charEntry = ctx.ui.get('character') as CharacterViewEntry | undefined
      if (!charEntry) return
      const moduleKey = 'character-effect'

      for (const [name, effect] of Object.entries(data._activeEffects)) {
        const charObj = charEntry.getObj(name)
        if (!charObj) continue

        playMotionEffect(
          ctx, charObj, effect.preset, effect.duration, effect.intensity,
          effect.remaining, '__activeCharEffectStop', {
            onRepeat: (rem) => {
              const s = ctx.state.get(moduleKey) as CharacterEffectSchema | undefined
              if (s?._activeEffects[name]) s._activeEffects[name].remaining = rem
            },
            onEnd: () => {
              const s = ctx.state.get(moduleKey) as CharacterEffectSchema | undefined
              if (s) delete s._activeEffects[name]
            },
          }
        )
      }
    }, 0)
  }

  return {
    show: () => { },
    hide: () => { },
    onCleanup: () => { },
  }
})

characterEffectModule.defineCommand(function* (cmd, ctx, _state, setState) {
  const entry = ctx.ui.get('character') as CharacterViewEntry | undefined
  const charObj = entry?.getObj(cmd.name)
  if (!charObj) return true

  const repeat = cmd.repeat ?? 1
  const moduleKey = 'character-effect'
  const name = cmd.name as string

  if (cmd.preset === 'reset') {
    setState((prev) => {
      const updated = { ...prev._activeEffects }
      delete updated[name]
      return { _activeEffects: updated }
    })
  } else {
    setState((prev) => ({
      _activeEffects: {
        ...prev._activeEffects,
        [name]: {
          preset: cmd.preset,
          duration: cmd.duration,
          intensity: cmd.intensity,
          remaining: repeat,
        },
      },
    }))
  }

  playMotionEffect(
    ctx, charObj, cmd.preset, cmd.duration, cmd.intensity,
    repeat, '__activeCharEffectStop', {
      onRepeat: (remaining) => {
        const s = ctx.state.get(moduleKey) as CharacterEffectSchema | undefined
        if (s?._activeEffects[name]) s._activeEffects[name].remaining = remaining
      },
      onEnd: () => {
        const s = ctx.state.get(moduleKey) as CharacterEffectSchema | undefined
        if (s) delete s._activeEffects[name]
      },
    }
  )

  return true
})

export { characterEffectModule }

