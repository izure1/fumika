// =============================================================
// Renderer.ts — Leviar World 렌더 어댑터 (범용 버전)
// =============================================================

import { World, Animation } from 'leviar'
import type { LeviarObject, EasingType } from 'leviar'
import type { NovelConfig } from '../types/config'
import type { SceneContext } from './SceneContext'

// ─── 내부 헬퍼 ─────────────────────────────────────────────────

/**
 * props 객체로부터 추적 키 목록을 추출한다.
 * ex) { transform: { position: {x,y} }, style: {opacity} }
 *   → ['transform.position', 'style']
 */
function _extractPropKeys(props: any): string[] {
  const keys: string[] = []
  if (props.style) keys.push('style')
  if (props.transform?.position) {
    if (props.transform.position.x !== undefined) keys.push('transform.position.x')
    if (props.transform.position.y !== undefined) keys.push('transform.position.y')
    if (props.transform.position.z !== undefined) keys.push('transform.position.z')
    if (keys.length === (props.style ? 1 : 0)) keys.push('transform.position')
  }
  if (props.transform?.scale) keys.push('transform.scale')
  if (props.transform?.rotation) keys.push('transform.rotation')
  if (keys.length === 0) keys.push('__default__')
  return keys
}

/** props를 obj에 즉시 적용 (duration=0 또는 snap 시) */
function _applyPropsImmediate(obj: any, props: any): void {
  if (props.style) Object.assign(obj.style, props.style)
  if (props.transform?.position) Object.assign(obj.transform.position, props.transform.position)
  if (props.transform?.scale) Object.assign(obj.transform.scale, props.transform.scale)
  if (props.transform?.rotation) Object.assign(obj.transform.rotation, props.transform.rotation)
}

/** 세이브/복원용 카메라 상태 */
export interface CameraState {
  x: number
  y: number
  z: number
  rotationZ?: number
}

export interface RendererState {
  cameraState: CameraState
  pluginState: Record<string, any>
  backgroundKey?: string | null
  activeMoods?: any
  activeEffects?: any
  characters?: any
  transitionState?: any
}

export interface RendererOption {
  width: number
  height: number
}

export class Renderer {
  readonly world: World
  public readonly config: NovelConfig<any, any, any, any>
  public readonly width: number
  public readonly height: number

  private _isSkipping: boolean = false

  /** 카메라 동기화 루프 RAF ID */
  private _syncLoopId: number | null = null

  /** 관리형 타이머 ID 저장소. clear() 시 일괄 취소됩니다. */
  private _timers: Set<ReturnType<typeof setTimeout>> = new Set()

  // 커스텀 명령어들이 저장할 범용 상태 저장소
  public state: Map<string, any> = new Map()

  // ─── 카메라 변환 합성용 ─────────────────────────────────────
  public camBaseObj: LeviarObject | null = null
  public camOffsetObj: LeviarObject | null = null

  constructor(world: World, config: NovelConfig<any, any, any, any>, option: RendererOption) {
    this.world = world
    this.config = config
    this.width = option.width
    this.height = option.height

    if (!this.world.camera) {
      this.world.camera = (this.world as any).createCamera()
    }
    this.world.camera!.transform.position.z = 0

    this._initCameraSync()
  }

  private _initCameraSync(): void {
    this.camBaseObj = this.world.createRectangle({
      style: { width: 1, height: 1, opacity: 0.01, pointerEvents: false } as any,
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 } }
    })
    this.camOffsetObj = this.world.createRectangle({
      style: { width: 1, height: 1, opacity: 0.01, pointerEvents: false } as any,
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 } }
    })
    this.world.camera?.addChild(this.camBaseObj as any)
    this.world.camera?.addChild(this.camOffsetObj as any)

    const syncLoop = () => {
      if (this.world.camera && this.camBaseObj && this.camOffsetObj) {
        this.world.camera.transform.position.x = this.camBaseObj.transform.position.x + this.camOffsetObj.transform.position.x
        this.world.camera.transform.position.y = this.camBaseObj.transform.position.y + this.camOffsetObj.transform.position.y
        this.world.camera.transform.position.z = this.camBaseObj.transform.position.z + this.camOffsetObj.transform.position.z
        if (this.world.camera.transform.rotation && this.camBaseObj.transform.rotation && this.camOffsetObj.transform.rotation) {
          this.world.camera.transform.rotation.z = this.camBaseObj.transform.rotation.z + this.camOffsetObj.transform.rotation.z
        }
      }
      this._syncLoopId = requestAnimationFrame(syncLoop)
    }
    this._syncLoopId = requestAnimationFrame(syncLoop)
  }

  /**
   * 스킵 모드 상태를 설정합니다. 스킵 모드일 경우 애니메이션 시간이 0으로 처리됩니다.
   * @param flag 스킵 활성화 여부
   */
  setSkipping(flag: boolean): void { this._isSkipping = flag }

  /**
   * 스킵 모드 상태를 고려하여 실제 적용할 애니메이션 소요 시간(ms)을 반환합니다.
   * @param d 원본 소요 시간(ms)
   * @returns 스킵 중이면 0, 아니면 원본 시간
   */
  public dur(d: number): number { return this._isSkipping ? 0 : d }

  /**
   * 객체에 애니메이션을 적용합니다. 
   * 이전에 진행 중이던 동일 속성의 애니메이션이 있다면 중단하고 즉시 목표값으로 스냅시킵니다.
   * 스킵 모드이거나 duration이 0인 경우 애니메이션 없이 즉시 속성을 적용합니다.
   * 
   * @param obj 애니메이션을 적용할 대상 객체
   * @param props 변경할 속성 객체 (예: { transform: { position: { x: 100 } } })
   * @param duration 애니메이션 소요 시간(ms)
   * @param easing 애니메이션 이징 함수
   * @param onEnd 애니메이션 종료 시 호출될 콜백 함수
   * @returns 생성된 애니메이션 인스턴스 (즉시 적용 시 null)
   */
  public animate(
    obj: any,
    props: any,
    duration: number,
    easing: EasingType = 'linear',
    onEnd?: () => void,
  ): Animation | null {
    const d = this.dur(duration)

    // prop 경로 키 추출 (ex: 'transform.position', 'style')
    const propKeys = _extractPropKeys(props)

    // 이전 anim 중단 → 목표값 snap
    if (!obj.__activeAnims) obj.__activeAnims = new Map<string, { anim: Animation | null; target: any }>()
    for (const key of propKeys) {
      const existing = obj.__activeAnims.get(key)
      if (existing?.anim) {
        existing.anim.stop?.()
        _applyPropsImmediate(obj, existing.target)
      }
    }

    if (d === 0) {
      _applyPropsImmediate(obj, props)
      for (const key of propKeys) obj.__activeAnims.delete(key)
      onEnd?.()
      return null
    }

    const anim = (obj as any).animate(props, d, easing)
    // 새 anim 등록
    const entry = { anim, target: props }
    for (const key of propKeys) obj.__activeAnims.set(key, entry)
    const cleanup = () => {
      for (const key of propKeys) {
        if (obj.__activeAnims?.get(key) === entry) obj.__activeAnims.delete(key)
      }
    }
    anim.on('end', cleanup)
    if (onEnd) anim.on('end', onEnd)
    return anim
  }

  // ─── 관리형 타이머 ──────────────────────────────────────────

  /**
   * 관리형 setTimeout. 등록된 타이머는 `clear()` 호출 시 자동으로 취소됩니다.
   * 씬 전환이나 세이브 로드 시 잔여 타이머가 남지 않도록 보장합니다.
   *
   * @param fn 실행할 콜백 함수
   * @param ms 지연 시간(ms)
   * @returns 타이머 ID. `clearTimer()`로 개별 취소할 수 있습니다.
   */
  setTimer(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this._timers.delete(id)
      fn()
    }, ms)
    this._timers.add(id)
    return id
  }

  /**
   * 특정 관리형 타이머를 취소합니다.
   */
  clearTimer(id: ReturnType<typeof setTimeout>): void {
    clearTimeout(id)
    this._timers.delete(id)
  }

  /**
   * 등록된 모든 관리형 타이머를 취소합니다.
   * `clear()` 내부에서 자동 호출됩니다.
   */
  clearAllTimers(): void {
    for (const id of this._timers) {
      clearTimeout(id)
    }
    this._timers.clear()
  }

  /**
   * 세이브 저장을 위해 현재 렌더러의 뷰포트/카메라 상태와 커스텀 플러그인 상태를 캡처하여 반환합니다.
   */
  captureState(): RendererState {
    const cam = this.world.camera

    const getCamPos = (axis: 'x' | 'y' | 'z') => {
      if (this.camBaseObj) {
        const anims = (this.camBaseObj as any).__activeAnims as Map<string, any> | undefined
        const entry = anims?.get(`transform.position.${axis}`) || anims?.get('transform.position')
        if (entry?.target?.transform?.position?.[axis] !== undefined) {
          return entry.target.transform.position[axis] as number
        }
        return this.camBaseObj.transform.position[axis]
      }
      return cam?.transform.position[axis] ?? 0
    }

    const getCamRot = () => {
      if (this.camBaseObj) {
        const anims = (this.camBaseObj as any).__activeAnims as Map<string, any> | undefined
        const entry = anims?.get('transform.rotation.z') || anims?.get('transform.rotation')
        if (entry?.target?.transform?.rotation?.z !== undefined) {
          return entry.target.transform.rotation.z as number
        }
        return this.camBaseObj.transform.rotation?.z ?? 0
      }
      return cam?.transform.rotation?.z ?? 0
    }

    return {
      cameraState: {
        x: getCamPos('x'),
        y: getCamPos('y'),
        z: getCamPos('z'),
        rotationZ: getCamRot(),
      },
      pluginState: Object.fromEntries(
        Array.from(this.state.entries()).filter(([key, value]) => {
          // _ prefix 키는 런타임 내부 참조(LeviarObject 등) → 무조건 제외
          if (key.startsWith('_')) return false
          // 직렬화 가능 여부 검사: 순환 참조 객체는 stringify 시 throw → 제외
          try { JSON.stringify(value); return true } catch { return false }
        })
      )
    }
  }

  /**
   * 로드 시 저장된 상태(state)를 기반으로 렌더러의 카메라 위치 및 커스텀 플러그인 상태를 복원합니다.
   */
  restoreState(state: RendererState): void {
    const cam = this.world.camera
    if (cam && state.cameraState) {
      if (this.camBaseObj) {
        this.camBaseObj.transform.position.x = state.cameraState.x
        this.camBaseObj.transform.position.y = state.cameraState.y
        this.camBaseObj.transform.position.z = state.cameraState.z
        if (this.camBaseObj.transform.rotation) {
          this.camBaseObj.transform.rotation.z = state.cameraState.rotationZ ?? 0
        }
      }
      if (this.camOffsetObj) {
        this.camOffsetObj.transform.position.x = 0
        this.camOffsetObj.transform.position.y = 0
        this.camOffsetObj.transform.position.z = 0
        if (this.camOffsetObj.transform.rotation) this.camOffsetObj.transform.rotation.z = 0
      }
      cam.transform.position.x = state.cameraState.x
      cam.transform.position.y = state.cameraState.y
      cam.transform.position.z = state.cameraState.z
      if (cam.transform.rotation) {
        cam.transform.rotation.z = state.cameraState.rotationZ ?? 0
      }
    }
    this.state = new Map(Object.entries(state.pluginState || {}))
  }


  /**
   * 커스텀 플러그인 상태 및 카메라 오프셋을 초기화합니다.
   * 주로 씬(Scene) 전환이나 종료 시 호출됩니다.
   * 렌더 오브젝트의 제거는 각 모듈의 onCleanup()이 담당합니다.
   */
  clear(): void {
    this.clearAllTimers()
    this.state.clear()
    if (this.camOffsetObj) {
      this.camOffsetObj.transform.position.x = 0
      this.camOffsetObj.transform.position.y = 0
      this.camOffsetObj.transform.position.z = 0
      if (this.camOffsetObj.transform.rotation) this.camOffsetObj.transform.rotation.z = 0
    }
  }

  /**
   * 카메라 동기화 RAF 루프를 취소합니다.
   * Novel.destroy() 시 호출하여 orphaned RAF가 남지 않도록 합니다.
   */
  cancelSyncLoop(): void {
    if (this._syncLoopId !== null) {
      cancelAnimationFrame(this._syncLoopId)
      this._syncLoopId = null
    }
  }
}

// ─── 복원용 SceneContext stub ────────────────────────────────

function _makeRestoreCtx(renderer: Renderer): SceneContext {
  const noop = () => { /* no-op */ }
  return {
    novel: null as any,
    world: renderer.world,
    renderer,
    globalVars: {},
    localVars: {},
    environments: {},
    callbacks: {
      getNovel: () => null as any,
      getGlobalVars: () => ({}),
      setGlobalVar: noop as any,
      getEnvironments: () => ({}),
      setEnvironment: noop as any,
      loadScene: noop as any,
      callScene: noop as any,
      captureRenderer: () => renderer.captureState(),
      isSkipping: () => true,
      disableInput: noop as any,
      getStateStore: () => new Map(),
      getUIRegistry: () => new Map(),
      syncUIState: noop,
      advance: noop,
      executeCmd: function* () { return false },
      getActiveActions: () => undefined,
      getActiveLocalVars: () => ({}),
      getSceneActions: () => undefined,
      getCurrentSceneName: () => '',
      getSceneLocalVars: () => ({}),
    },
    state: {
      set: noop as any,
      get: () => undefined,
    },
    ui: {
      register: noop as any,
      get: () => undefined,
      show: noop as any,
      hide: noop as any,
    },
    scene: {
      getTextSubIndex: () => 0,
      setTextSubIndex: noop as any,
      interpolateText: (t: string) => t,
      jumpToLabel: noop as any,
      hasLabel: () => false,
      getVars: () => ({}),
      setGlobalVar: noop as any,
      setLocalVar: noop as any,
      loadScene: noop as any,
      end: noop,
      callScene: noop as any,
    },
    execute: function* () { return false },
    actions: {
      get: () => undefined,
    },
  }
}
