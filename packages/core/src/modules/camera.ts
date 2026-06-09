import type { SceneContext } from '../core/SceneContext'
import { define } from '../define/defineCmdUI'
import type { EasingType } from 'leviar'
import { playMotionEffect, type MotionEffectPreset } from '../core/motion'

export type ZoomPreset = 'close-up' | 'medium' | 'wide' | 'reset' | 'inherit'
export type CameraEffectPreset = MotionEffectPreset

/** 카메라를 줌한다 */
export interface CameraZoomCmd {
  /** 줌 배율 프리셋입니다. ('inherit'일 경우 이전 상태 유지) */
  preset: ZoomPreset
  /** 애니메이션의 지속 시간(ms)입니다. */
  duration?: number
  /** 애니메이션의 이징 함수 이름입니다. */
  ease?: EasingType
}

/** 카메라를 패닝한다 */
export interface CameraPanCmd {
  /** 애니메이션의 지속 시간(ms)입니다. */
  duration?: number
  /** X 좌표 (0~1) 또는 '1/5' 등의 비율 표현식입니다. */
  x?: number | string
  /** Y 좌표 (0~1) 또는 '1/5' 등의 비율 표현식입니다. */
  y?: number | string
  /** 애니메이션의 이징 함수 이름입니다. */
  ease?: EasingType
}

/**
 * 카메라 흔들림 등 연출 효과를 재생한다
 *
 * @example
 * { type: 'camera-effect', preset: 'shake', duration: 500, intensity: 5, repeat: 3 }
 */
export interface CameraEffectCmd {
  /** 연출 효과의 프리셋 이름입니다. */
  preset: CameraEffectPreset
  /** 효과의 전체 지속 시간(ms)입니다. */
  duration?: number
  /** 효과의 강도입니다. 프리셋의 기본값을 덮어씁니다. */
  intensity?: number
  /** 효과를 반복할 횟수입니다. (기본값: 1) */
  repeat?: number
}

// ─── 프리셋 테이블 ───────────────────────────────────────────

const ZOOM_PRESETS: Record<Exclude<ZoomPreset, 'inherit'>, { scale: number; duration: number }> = {
  'close-up': { scale: 1.5, duration: 800 },
  'medium': { scale: 1.2, duration: 600 },
  'wide': { scale: 0.92, duration: 800 },
  'reset': { scale: 1.0, duration: 600 },
}

export { MOTION_EFFECT_PRESETS as CAMERA_EFFECT_PRESETS } from '../core/motion'

// ─── 공유 헬퍼 ───────────────────────────────────────────────

export function zoomCamera(ctx: SceneContext, preset: ZoomPreset, duration?: number, ease: EasingType = 'easeInOutQuad') {
  const resolvedPreset = preset === 'inherit' ? ctx.renderer.state.get('_lastZoomPreset') ?? 'reset' : preset
  ctx.renderer.state.set('_lastZoomPreset', resolvedPreset)
  const cfg = ZOOM_PRESETS[resolvedPreset as Exclude<ZoomPreset, 'inherit'>]
  if (!cfg) return

  const focalLength = (ctx.renderer.world.camera as any)?.attribute?.focalLength ?? 100
  const targetZ = focalLength * (1 - 1 / cfg.scale)

  if (ctx.renderer.camBaseObj) {
    const dur = ctx.renderer.dur(duration ?? cfg.duration)
    ctx.renderer.animate(ctx.renderer.camBaseObj, { transform: { position: { z: targetZ } } }, dur, ease)
  }
}

function parseRatioExpression(val: unknown, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    const num = Number(trimmed)
    if (!isNaN(num)) return num

    const m = trimmed.match(/^(\d+)\/(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      const d = parseInt(m[2], 10)
      if (d > 0) return n / (d + 1)
    }
  }
  return fallback
}

export function panCamera(
  ctx: SceneContext,
  duration?: number,
  customX?: number | string,
  customY?: number | string,
  ease: EasingType = 'easeInOutQuad'
) {
  const cam = ctx.renderer.world.camera as any
  const zPos = 2000
  const baseW = ctx.renderer.width
  const baseH = ctx.renderer.height
  const maxPanX = baseW * 0.08
  const maxPanY = baseH * 0.08
  const ratio = cam && typeof cam.calcDepthRatio === 'function' ? cam.calcDepthRatio(zPos, 1) : 1

  const maxCamX = ratio > 0 && !isNaN(ratio) ? (maxPanX * ratio) : maxPanX
  const maxCamY = ratio > 0 && !isNaN(ratio) ? (maxPanY * ratio) : maxPanY

  const currentX = ctx.renderer.camBaseObj?.transform?.position?.x ?? 0
  const currentY = ctx.renderer.camBaseObj?.transform?.position?.y ?? 0

  const hasX = customX !== undefined && customX !== null && customX !== ''
  const hasY = customY !== undefined && customY !== null && customY !== ''

  let targetX = currentX
  if (hasX) {
    const valX = parseRatioExpression(customX, 0.5)
    const clampedX = Math.max(0, Math.min(1, valX))
    targetX = (clampedX - 0.5) * 2 * maxCamX
  }

  let targetY = currentY
  if (hasY) {
    const valY = parseRatioExpression(customY, 0.5)
    const clampedY = Math.max(0, Math.min(1, valY))
    targetY = (0.5 - clampedY) * 2 * maxCamY
  }

  if (isNaN(targetX)) targetX = currentX
  if (isNaN(targetY)) targetY = currentY

  const finalDur = duration ?? 1000

  if (ctx.renderer.camBaseObj) {
    const dur = ctx.renderer.dur(finalDur)
    ctx.renderer.animate(ctx.renderer.camBaseObj, {
      transform: { position: { x: targetX, y: targetY } }
    }, dur, ease)
  }
}

function cameraEffect(
  ctx: SceneContext,
  preset: CameraEffectPreset,
  duration?: number,
  intensity?: number,
  repeat: number = 1,
  motionCallbacks?: {
    onRepeat?: (remaining: number) => void
    onEnd?: () => void
  }
) {
  const offsetObj = ctx.renderer.camOffsetObj
  if (!offsetObj) return

  // renderer state 기반의 stateKey 동작 모방
  const objWrapper = {
    transform: offsetObj.transform,
    get _activeCamEffectStop() { return ctx.renderer.state.get('_activeCamEffectStop') },
    set _activeCamEffectStop(val) { ctx.renderer.state.set('_activeCamEffectStop', val) }
  }

  playMotionEffect(ctx, objWrapper, preset, duration, intensity, repeat, '_activeCamEffectStop', motionCallbacks)
}

// ─── camera-zoom 모듈 ────────────────────────────────────────

export interface CameraZoomSchema { _lastPreset: string }

const cameraZoomModule = define<CameraZoomCmd, CameraZoomSchema>({ _lastPreset: 'reset' })

cameraZoomModule.defineView((_ctx, _data, _setState) => ({ show: () => { }, hide: () => { }, onCleanup: () => { } }))

cameraZoomModule.defineCommand(function* (cmd, ctx, state, setState) {
  const resolved = cmd.preset === 'inherit' ? state._lastPreset : cmd.preset
  setState({ _lastPreset: resolved as string })
  zoomCamera(ctx, resolved as ZoomPreset, cmd.duration, cmd.ease)
  return true
})

export { cameraZoomModule }

// ─── camera-pan 모듈 ────────────────────────────────────────

export interface CameraPanSchema { _lastX: number; _lastY: number }

const cameraPanModule = define<CameraPanCmd, CameraPanSchema>({ _lastX: 0.5, _lastY: 0.5 })

cameraPanModule.defineView((_ctx, _data, _setState) => ({ show: () => { }, hide: () => { }, onCleanup: () => { } }))

cameraPanModule.defineCommand(function* (cmd, ctx, state, setState) {
  const hasX = cmd.x !== undefined && cmd.x !== null && cmd.x !== ''
  const hasY = cmd.y !== undefined && cmd.y !== null && cmd.y !== ''

  const targetX = hasX ? parseRatioExpression(cmd.x, 0.5) : state._lastX
  const targetY = hasY ? parseRatioExpression(cmd.y, 0.5) : state._lastY

  setState({ _lastX: targetX, _lastY: targetY })
  panCamera(ctx, cmd.duration, targetX, targetY, cmd.ease)
  return true
})

export { cameraPanModule }

// ─── camera-effect 모듈 ─────────────────────────────────────

export interface CameraEffectSchema {
  _lastPreset: string
  _activeEffect: {
    preset: CameraEffectPreset
    duration?: number
    intensity?: number
    remaining: number
  } | null
}

const cameraEffectModule = define<CameraEffectCmd, CameraEffectSchema>({
  _lastPreset: 'shake',
  _activeEffect: null,
})

cameraEffectModule.defineView((ctx, data, _setState) => {
  // 복원: 저장된 카메라 효과 재생
  if (data._activeEffect) {
    const { preset, duration, intensity, remaining } = data._activeEffect
    const moduleKey = 'camera-effect'
    cameraEffect(ctx, preset, duration, intensity, remaining, {
      onRepeat: (rem) => {
        const s = ctx.state.get(moduleKey) as CameraEffectSchema | undefined
        if (s?._activeEffect) s._activeEffect.remaining = rem
      },
      onEnd: () => {
        const s = ctx.state.get(moduleKey) as CameraEffectSchema | undefined
        if (s) s._activeEffect = null
      },
    })
  }

  return { show: () => { }, hide: () => { }, onCleanup: () => { } }
})

cameraEffectModule.defineCommand(function* (cmd, ctx, state, setState) {
  const repeat = cmd.repeat ?? 1
  const moduleKey = 'camera-effect'

  if (cmd.preset === 'reset') {
    setState({ _lastPreset: cmd.preset, _activeEffect: null })
  } else {
    setState({
      _lastPreset: cmd.preset,
      _activeEffect: {
        preset: cmd.preset,
        duration: cmd.duration,
        intensity: cmd.intensity,
        remaining: repeat,
      },
    })
  }

  cameraEffect(ctx, cmd.preset, cmd.duration, cmd.intensity, repeat, {
    onRepeat: (remaining) => {
      const s = ctx.state.get(moduleKey) as CameraEffectSchema | undefined
      if (s?._activeEffect) s._activeEffect.remaining = remaining
    },
    onEnd: () => {
      const s = ctx.state.get(moduleKey) as CameraEffectSchema | undefined
      if (s) s._activeEffect = null
    },
  })

  return true
})

export { cameraEffectModule }

