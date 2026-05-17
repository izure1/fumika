// =============================================================
// Novel.ts — 전역 vars 관리 + 씬 로딩 오케스트레이터
// =============================================================

import { World } from 'leviar'
import { Renderer } from './Renderer'
import { AudioManager } from './AudioManager'
import { DialogueScene } from './Scene'
import type { SceneCallbacks } from './Scene'
import type { RendererState } from './Renderer'
import type { SceneDefinition } from '../define/defineScene'
export type { SceneDefinition }
import type { NovelConfig, NovelOption } from '../types/config'
import type { UIRuntimeEntry } from './UIRegistry'
import type { SceneContext } from './SceneContext'
import type { NovelModule, DefaultHook } from '../define/defineCmdUI'
import type { IHookallSync } from 'hookall'
import { useHookallSync } from 'hookall'
import audioModule from '../modules/audio'
import type { AudioHook } from '../modules/audio'
import { createVarSetterProxy } from '../types/utils'

// =============================================================
// 내부 타입
// =============================================================

type AnySceneDef = SceneDefinition<any, any, any, any, any, any>
type ActiveScene = DialogueScene

type InputMode = 'advance' | 'block'

/** novel.save()가 반환하는 세이브 데이터 */
export interface SaveData {
  /** 저장 시점의 씬 이름 */
  sceneName: string
  /** 저장 시점의 dialogues 배열 인덱스 */
  cursor: number
  /** 전역 변수 스냅샷 */
  globalVars: Record<string, any>
  /** 지역 변수 스냅샷 */
  localVars: Record<string, any>
  /** 렌더러 상태 (배경, 캐릭터, 카메라 등) 스냅샷 */
  rendererState: RendererState
  /**
   * 각 모듈이 저장하는 상태 스냅샷.
   * 'dialogue' → { subIndex, lines, speaker }
   * 'background' → { key, fit } 등
   */
  states: Record<string, any>
  /**
   * scene call 콜 스택.
   * 서브씬 호출 도중 세이브 시 호출자 씬 체인이 여기에 저장됩니다.
   */
  callStack: CallStackFrame[]
}

/**
 * scene call 호출자 씬의 스냅샷.
 * 서브씬 종료 시 이 프레임으로 호출자 환경을 복원합니다.
 */
export interface CallStackFrame {
  /** 호출자 씬 이름 */
  sceneName: string
  /** 재개할 커서 위치 (call 커맨드 다음 인덱스) */
  cursor: number
  /** 호출자 지역 변수 스냅샷 */
  localVars: Record<string, any>
  /** 서브텍스트 인덱스 */
  textSubIndex: number
  /** 호출 시점의 렌더러 상태 스냅샷 */
  rendererState: RendererState
  /** 호출 시점의 stateStore 스냅샷 */
  storeSnapshot: Record<string, any>
  /**
   * 서브씬 시작 시 현재 상태를 이어받았는지 여부.
   * true: 서브씬은 caller의 렌더러·state·오디오 상태를 이어받아 시작했음.
   */
  preserve: boolean
  /**
   * 서브씬 종료 후 caller 상태를 완전 복원할지 여부.
   * preserve=true일 때만 유효.
   * - false (기본): 커서·localVars만 복원, 화면/오디오는 서브씬 상태 그대로 이어감
   * - true: caller 시점의 렌더러·stateStore 완전 복원
   */
  restore: boolean
}

export interface NovelVarHookPayload {
  name: string
  oldValue: any
  newValue: any
}

// ─── NovelHook 타입 ──────────────────────────────────────────

/**
 * Novel 인스턴스가 방출하는 훅 이벤트 목록.
 * `useHookallSync(novel.hooker)` 또는 `ctx.novel.hooker`로 구독합니다.
 *
 * @example
 * useHookallSync<NovelHook>(novel.hooker)
 *   .onBefore('novel:next', (value) => {
 *     console.log('next called')
 *     return value
 *   })
 */
export interface NovelHook {
  /** novel.save() 호출 시 방출. initialValue = 저장될 SaveData */
  'novel:save': (value: SaveData) => SaveData
  /** novel.loadSave() 호출 시 방출. initialValue = 복원될 SaveData */
  'novel:load': (value: SaveData) => SaveData
  /** novel.next() 호출 시 방출. initialValue = 진행 가능 여부 */
  'novel:next': (value: boolean) => boolean
  /** novel.start() / loadScene() 호출 시 방출. initialValue = 씬 이름 */
  'novel:scene': (value: string) => string
  /**
   * 변수 값 변경 시 방출. 씨이 없으면 에러 발생 (novel.start() 이후 사용 가능).
   * @param ctx - 변경이 발생한 시점의 SceneContext
   */
  'novel:var': (payload: NovelVarHookPayload, ctx: SceneContext) => NovelVarHookPayload
}

// =============================================================
// AllModuleHooksOf — config.modules 훅 유니온 추출
// =============================================================

/** @internal 유니온 타입을 인터섹션으로 변환 */
type UnionToIntersectionLocal<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

/**
 * `NovelConfig`의 `modules`에서 각 모듈의 `THook` 타입을 합친 인터섹션 타입.
 * `novel.hooker`의 타입 매개변수로 사용됩니다.
 */
export type AllModuleHooksOf<TConfig> =
  TConfig extends NovelConfig<any, any, any, any, any, any, infer TMods, any>
  ? UnionToIntersectionLocal<{
    [K in keyof TMods]: TMods[K] extends NovelModule<any, any, infer THook> ? THook : DefaultHook
  }[keyof TMods]>
  : DefaultHook



// =============================================================
// Novel 클래스
// =============================================================

export class Novel<TConfig extends NovelConfig<any, any, any, any, any, any, any, any>> {
  /** 전역 변수. 씬 전환에도 유지됩니다 */
  readonly variables: TConfig['variables']

  /** 환경변수. 모든 세이브에서 공유됩니다 */
  readonly environments: TConfig['environments']

  /** 엔진 전용 컨테이너 (캔버스와 UI 요소들을 감싸는 래퍼) */
  readonly container: HTMLDivElement

  private readonly _config: TConfig
  private readonly _option: { element: HTMLElement; canvas: HTMLCanvasElement; width: number; height: number }
  private readonly _world: World
  private readonly _renderer: Renderer
  /** Novel 인스턴스 내 오디오 관리 클래스 */
  readonly audio: AudioManager
  private readonly _scenes: Map<string, AnySceneDef> = new Map()

  /** State — 씬 전환 후에도 유지, 세이브/로드 대상 */
  private readonly _stateStore: Map<string, any> = new Map()

  /**
   * 모듈 레지스트리 — Novel 생성 시 config.modules에서 자동 수집.
   * key: 모듈 이름, value: NovelModule 객체
   */
  private readonly _modules: Map<string, NovelModule<any>> = new Map()

  /** UI 런타임 레지스트리 — scene 실행 중 view 빌더가 등록 */
  private readonly _uiRegistry: Map<string, UIRuntimeEntry> = new Map()

  /** _suppressUIs에 의해 임시로 숨겨진 엔트리 목록 */
  private _suppressedEntries: Set<UIRuntimeEntry> = new Set()

  /** Novel 전용 훅 시스템 (novel:* 이벤트 전용) */
  private readonly _novelHooker: IHookallSync<NovelHook> = useHookallSync<NovelHook>({})

  /**
   * 통합 훅 프록시. `novel:*` 키 는 내부 Novel 훅으로, 구모듈 훅은 해당 모듈의 `hooker`로 라우팅합니다.
   * 
   * @example
   * // novel 레벨 훅
   * novel.hooker.onBefore('novel:next', (v) => v)
   * // 모듈 훅 (dialogue모듈의 DialogueHook)
   * novel.hooker.onBefore('dialogue:text', (v) => v)
   */
  // @ts-ignore — AllModuleHooksOf<TConfig>는 조건부 타입이라 ListenerSignature<M> 제약을 TS가 검증 불가. 런타임 정상.
  readonly hooker!: IHookallSync<NovelHook & AllModuleHooksOf<TConfig>>

  private _currentScene: ActiveScene | null = null
  private _currentSceneDef: AnySceneDef | null = null
  private _inputMode: InputMode = 'block'
  private _isSkipping: boolean = false
  /** scene call 콜 스택 */
  private readonly _callStack: CallStackFrame[] = []
  /**
   * callScene() 경로로 서브씬 진입 중임을 표시하는 플래그.
   * true이면 loadScene / _loadPreserveSubScene이 부모씬 훅을 해제하지 않습니다.
   */
  private _callingSubScene: boolean = false
  /**
   * 콜백 세대 카운터.
   * _buildCallbacks() 호출 시마다 증가하여 advance() 콜백이
   * 자신이 속한 씬에서만 발화되도록 보장합니다.
   */
  private _sceneGeneration: number = 0
  /** 사용자 입력 무시 만료 시간 (ms) */
  private _inputDisabledUntil: number = 0
  /** fullscreenchange 핸들러 참조 (정리용) */
  private readonly _onFullscreenChange: () => void

  constructor(
    config: TConfig,
    option: NovelOption & { scenes: Record<TConfig['scenes'][number], AnySceneDef> }
  ) {
    this._config = config

    const container = option.element
    this.container = container as HTMLDivElement

    // 래퍼 스타일 초기화
    this.container.classList.add('fumika-container')
    this.container.style.position = 'relative'
    this.container.style.overflow = 'hidden'

    // 캔버스 동적 생성
    const canvas = document.createElement('canvas')
    this.container.appendChild(canvas)

    // 기본 해상도 결정
    const width = config.width ?? container.clientWidth ?? 1920
    const height = config.height ?? container.clientHeight ?? 1080


    this._option = {
      element: container,
      canvas,
      width,
      height,
    }

    canvas.width = width
    canvas.height = height

    this._world = new World({ canvas })

    // World 객체 생성 시 내부적으로 캔버스의 인라인 스타일(width/height)에
    // 픽셀 고정값을 부여하는 것을 방지하고 항상 부모 요소를 꽉 채우도록 100%로 강제합니다.
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.objectFit = 'contain'

    this._renderer = new Renderer(this._world, config, {
      width: this._option.width,
      height: this._option.height,
    })

    // AudioManager 초기화 — audioModule.hooker를 공유하여 audio:* 훅 라우팅 유지
    this.audio = new AudioManager(audioModule.hooker as IHookallSync<AudioHook>)
    this.audio.setCtxProvider(() => this._makeCurrentCtx())

    this.variables = { ...(config.variables as object) } as TConfig['variables']
    this.environments = { ...(config.environments ?? {} as object) } as TConfig['environments']

    // config.modules 수집 및 key 주입
    this._collectModules(config.modules)

      // 훅 프록시 초기화 (_modules 수집 후에 호출)
      ; (this as any).hooker = this._createHookerProxy()

    this._world.start()

    for (const [name, scene] of Object.entries(option.scenes) as [string, AnySceneDef][]) {
      scene.name = name
      this._scenes.set(name, scene)
    }

    // 전체화면 전환 시 canvas 스케일 조정 (기존 로직 주석 처리)
    this._onFullscreenChange = () => { /* this._handleFullscreenChange() */ }
  }

  /**
   * config.modules를 순회하며 모듈을 _modules에 등록하고 key를 주입합니다.
   */
  private _collectModules(modules?: Record<string, NovelModule<any>>): void {
    if (!modules) return
    for (const [key, module] of Object.entries(modules)) {
      if (module && typeof module.__setKey === 'function') {
        module.__setKey(key)
        this._modules.set(key, module)
      }
    }
  }

  /**
   * novel:* 키는 _novelHooker로, 나머지 키는 접두사로 찾은 모듈의 hooker로
   * 자동 라우팅하는 IHookallSync 프록시를 생성합니다.
   */
  private _createHookerProxy(): IHookallSync<any> {
    const getHooker = (command: string): IHookallSync<any> => {
      if (command.startsWith('novel:')) return this._novelHooker
      const moduleKey = command.split(':')[0]
      const mod = this._modules.get(moduleKey)
      return (mod as any)?.hooker ?? this._novelHooker
    }

    const proxy: IHookallSync<any> = {
      onBefore: (cmd, cb) => { getHooker(cmd).onBefore(cmd, cb); return proxy },
      onAfter: (cmd, cb) => { getHooker(cmd).onAfter(cmd, cb); return proxy },
      onceBefore: (cmd, cb) => { getHooker(cmd).onceBefore(cmd, cb); return proxy },
      onceAfter: (cmd, cb) => { getHooker(cmd).onceAfter(cmd, cb); return proxy },
      offBefore: (cmd, cb) => { getHooker(cmd).offBefore(cmd, cb); return proxy },
      offAfter: (cmd, cb) => { getHooker(cmd).offAfter(cmd, cb); return proxy },
      trigger: (cmd, initialValue, callback, ...params) =>
        getHooker(cmd).trigger(cmd, initialValue, callback, ...params),
    }
    return proxy
  }

  private _setGlobalVar(name: string, value: any): void {
    const oldValue = (this.variables as any)[name]
    if (Object.is(oldValue, value)) return

    const ctx = this._makeCurrentCtx()
    const payload = this._novelHooker.trigger(
      'novel:var',
      { name, oldValue, newValue: value },
      (data) => data,
      ctx
    )
    const variables = this.variables as any
    variables[name] = payload.newValue
  }

  private _setEnvironment(name: string, value: any): void {
    const oldValue = (this.environments as any)[name]
    if (Object.is(oldValue, value)) return

    const ctx = this._makeCurrentCtx()
    const payload = this._novelHooker.trigger(
      'novel:var',
      { name, oldValue, newValue: value },
      (data) => data,
      ctx
    )
    const environments = this.environments as any
    environments[name] = payload.newValue
  }

  private _createGlobalVarsProxy(): Record<string, any> {
    return createVarSetterProxy(
      () => this.variables as Record<string, any>,
      (name, value) => { this._setGlobalVar(name, value) },
    )
  }

  private _createEnvironmentsProxy(): Record<string, any> {
    return createVarSetterProxy(
      () => this.environments as Record<string, any>,
      (name, value) => { this._setEnvironment(name, value) },
    )
  }

  private _createSceneLocalVarsProxy(
    getTarget: () => Record<string, any>,
    getCtx: () => SceneContext,
  ): Record<string, any> {
    return createVarSetterProxy(
      getTarget,
      (name, value) => {
        const scene = this._currentScene
        if (scene instanceof DialogueScene) {
          (scene as any)._setLocalVar(name, value, getCtx())
        }
      },
    )
  }

  // ─── 에셋 로딩 ───────────────────────────────────────────────

  async load(): Promise<void> {
    if (this._config.assets) {
      await this._world.loader.load(this._config.assets)
    }
  }

  /** config.assets 외 추가 에셋을 로드합니다 (SVG 인라인 등 런타임 생성 에셋). */
  async loadAssets(assets: Record<string, string>): Promise<void> {
    await this._world.loader.load(assets)
  }

  /**
   * 등록된 모든 모듈의 `onBoot` 콜백을 순차적으로 실행합니다.
   * `load()` 이후, `start()` 이전에 한 번 호출하십시오.
   *
   * @example
   * await novel.load()
   * await novel.boot()
   * novel.start('scene-intro')
   */
  async boot(): Promise<void> {
    for (const module of this._modules.values()) {
      if (module.__bootFn) {
        await module.__bootFn(this._world)
      }
    }
  }

  // ─── 씬 등록 ─────────────────────────────────────────────────

  register(scene: AnySceneDef): this {
    this._scenes.set(scene.name as string, scene)
    return this
  }

  // ─── 씬 시작/전환 ────────────────────────────────────────────

  start(name: TConfig['scenes'][number]): void {
    this.loadScene(name as string)
  }

  loadScene(target: string | { scene: string; preserve: boolean }): void {
    const rawSceneName = typeof target === 'string' ? target : target.scene
    const preserve = typeof target === 'object' && target.preserve === true

    const sceneName = this._novelHooker.trigger(
      'novel:scene',
      rawSceneName,
      (name) => name
    )


    const def = this._scenes.get(sceneName)
    if (!def) {
      console.error(`[fumika] 씬 '${sceneName}'이 등록되어 있지 않습니다.`)
      return
    }

    // 이전 씬의 훅 해제
    // _callingSubScene=true(call 경로)일 때는 부모씬 훅을 유지합니다.
    if (!this._callingSubScene) {
      this._currentSceneDef?.hooks?._unregister(this)
    }


    // 하드 전환(loadScene 직접 호출)일 때 콜스택을 초기화합니다.
    // 상위씬 훅에서 ctx.scene.loadScene을 호출하거나,
    // 하위씬 내부에서 next 커맨드로 이탈할 때 잔여 call frame이 남지 않도록 합니다.
    // _callingSubScene=true(= _callScene 내부에서 호출)는 제외합니다.
    if (!this._callingSubScene && this._callStack.length > 0) {
      // 아직 등록된 모든 조상씬 훅을 역순으로 해제
      for (let i = this._callStack.length - 1; i >= 0; i--) {
        const frame = this._callStack[i]
        const ancestorDef = this._scenes.get(frame.sceneName)
        ancestorDef?.hooks?._unregister(this)
      }
      this._callStack.length = 0
    }

    const prevState: RendererState | null = (!preserve && this._currentScene)
      ? this._renderer.captureState()
      : null

    this._currentScene = null

    if (!preserve) {
      // 씬 전환 시 UI 정리 (preserve=true 시에는 오브젝트 유지)
      this._cleanupUI()
      this._renderer.clear()
      if (prevState) {
        this._renderer.restoreState(prevState)
      }
      // UI 레지스트리 초기화 (새 씬에서 view 빌더가 재등록)
      this._uiRegistry.clear()
      this._suppressedEntries.clear()
    }
    // preserve=true 시: 추적 오브젝트, state 맵 모두 유지

    const callbacks = this._buildCallbacks()
    const scene = new DialogueScene(this._renderer, callbacks, def)

    this._currentScene = scene
    this._currentSceneDef = def
    this._inputMode = 'block'

    // 새 씬의 훅 등록
    def.hooks?._register(this)

    scene.start(preserve ? { skipInitial: true } : undefined)
    this._syncUIState()
  }

  /** 씬 전환 시 모든 UI 엔트리의 onCleanup() 호출 */
  private _cleanupUI(): void {
    for (const entry of this._uiRegistry.values()) {
      entry.onCleanup()
    }
    this._suppressedEntries.clear()
  }

  // ─── 스킵 기능 ───────────────────────────────────────────────

  /** 현재 스킵(빠른 감기) 중인지 여부 */
  get isSkipping(): boolean { return this._isSkipping }

  /** 빠른 감기를 시작합니다. 선택지 또는 씬 종료 시 자동 중지됩니다. */
  skip(): void {
    if (this._isSkipping) return
    this._isSkipping = true
    this._renderer.setSkipping(true)
    this._tickSkip()
  }

  /** 빠른 감기를 중지합니다. */
  stopSkip(): void {
    this._isSkipping = false
    this._renderer.setSkipping(false)
  }

  private _tickSkip(): void {
    if (!this._isSkipping) return

    if (!this._currentScene || this._currentScene.isEnded) {
      this.stopSkip()
      return
    }
    if (!(this._currentScene instanceof DialogueScene)) {
      this.stopSkip()
      return
    }

    if (this._currentScene.getCurrentChoice()) {
      this.stopSkip()
      return
    }

    if (this._currentScene.isWaitingInput) {
      this._currentScene.advance()
      this._syncUIState()
    }

    if (this._isSkipping) {
      setTimeout(() => this._tickSkip(), 0)
    }
  }

  /**
   * hideable:true 로 등록된 모든 UI 요소를 숨깁니다.
   */
  hideUI(duration = 250): void {
    for (const entry of this._uiRegistry.values()) {
      entry.hide(duration)
    }
  }

  /**
   * hideUI()로 숨겼던 UI 요소를 다시 표시합니다.
   */
  showUI(duration = 250): void {
    const stepType = this._currentScene?.getCurrentStepType()
    const activeEntry = stepType ? this._uiRegistry.get(stepType) : undefined
    const suppressedTags = activeEntry?.hideTags ?? []

    for (const entry of this._uiRegistry.values()) {
      if (entry === activeEntry) {
        entry.show(duration)
        continue
      }
      if (entry.uiTags && entry.uiTags.some(tag => suppressedTags.includes(tag))) {
        continue
      }
      entry.show(duration)
    }
  }

  // ─── 세이브 / 로드 ───────────────────────────────────────────

  /**
   * 현재 진행 상태를 SaveData로 반환합니다.
   */
  save(): SaveData {
    if (
      !this._currentScene ||
      !(this._currentScene instanceof DialogueScene) ||
      !this._currentSceneDef
    ) {
      throw new Error('[fumika] save()는 DialogueScene 진행 중에만 호출할 수 있습니다.')
    }

    const rawData: SaveData = {
      sceneName: this._currentSceneDef.name as string,
      cursor: this._currentScene.getCursor(),
      globalVars: { ...this.variables as object },
      localVars: this._currentScene.getLocalVars(),
      rendererState: this._renderer.captureState(),
      states: Object.fromEntries(this._stateStore),
      callStack: this._callStack.map(frame => ({
        ...frame,
        localVars: { ...frame.localVars },
        storeSnapshot: { ...frame.storeSnapshot },
        preserve: frame.preserve,
        restore: frame.restore,
      })),
    }

    return this._novelHooker.trigger(
      'novel:save',
      rawData,
      (data) => data
    )
  }

  /**
   * 현재 환경변수 상태를 스냅샷으로 반환합니다.
   * 반환된 객체를 외부 스토리지(localStorage 등)에 수동 저장하십시오.
   */
  saveEnv(): Record<string, any> {
    return { ...(this.environments ?? {}) as object }
  }

  /**
   * 외부 스토리지에서 불러온 데이터로 환경변수를 복원합니다.
   */
  loadEnv(data: Record<string, any>): void {
    Object.assign(this.environments as object, data)
  }

  /**
   * SaveData로부터 진행 상태를 복원합니다.
   */
  loadSave(data: SaveData): void {
    const resolvedData = this._novelHooker.trigger(
      'novel:load',
      data,
      (d) => d
    )

    const def = this._scenes.get(resolvedData.sceneName)
    if (!def || def.kind !== 'dialogue') {
      console.error(`[fumika] load() 실패: 씬 '${resolvedData.sceneName}'을 찾을 수 없습니다.`)
      return
    }

    // 이전 씬 훅 해제
    this._currentSceneDef?.hooks?._unregister(this)

    this._cleanupUI()
    this.stopSkip()
    // audioModule이 config.modules에 없어도 로드 시 오디오 즉시 정지
    // _rebuildModuleViews()에서 audio 모듈이 등록된 경우 저장 상태로 복원됨
    this.audio.stopAll(0)

    // 전역 변수 복원
    Object.assign(this.variables as object, resolvedData.globalVars)

    // State 복원
    this._stateStore.clear()
    for (const [k, v] of Object.entries(resolvedData.states ?? {})) {
      this._stateStore.set(k, v)
    }

    // 렌더러 초기화 + 상태 복원
    this._uiRegistry.clear()
    this._suppressedEntries.clear()
    this._renderer.clear()
    this._renderer.restoreState(resolvedData.rendererState)

    // callStack 복원 (preserve/restore 기본값 fallback 포함)
    this._callStack.length = 0
    for (const frame of resolvedData.callStack) {
      this._callStack.push({
        ...frame,
        localVars: { ...frame.localVars },
        storeSnapshot: { ...frame.storeSnapshot },
        preserve: frame.preserve ?? false,
        restore: frame.restore ?? false,
      })
    }

    // 모듈 View 재생성 (state에서 스키마 읽어 빌더 실행)
    this._currentSceneDef = def
    this._rebuildModuleViews()

    // 새 씬 인스턴스 생성 (start() 호출 없이)
    const callbacks = this._buildCallbacks()
    const scene = new DialogueScene(this._renderer, callbacks, def as SceneDefinition<any, any, any, any, any>)

    // 지역 변수 + cursor 복원
    this._currentScene = scene
    this._inputMode = 'block'

    // 새 씬 훅 등록
    def.hooks?._register(this)

    const subIndex = (resolvedData.states?.['dialogue'] as any)?.subIndex ?? 0
    scene.restoreState(resolvedData.cursor, resolvedData.localVars, subIndex)

    this._syncUIState()
  }

  /**
   * 모든 등록된 모듈의 View 빌더를 실행하여 UI를 재생성합니다.
   * loadSave() 호출 후 실행됩니다.
   * 저장된 state를 각 모듈의 View에 주입하여 상태를 복원합니다.
   */
  private _rebuildModuleViews(): void {
    const ctx = this._makeRebuildCtx(this._currentSceneDef)

    for (const [name, module] of this._modules) {
      if (!module.__viewBuilder) continue
      const savedState = this._stateStore.get(name) ?? {}
      const entry = module.__viewBuilder(ctx, savedState)
      this._uiRegistry.set(name, entry)
    }
  }

  // ─── 콜백 팩토리 ─────────────────────────────────────────────

  /**
   * 현재 활성 씨 기반으로 ctx를 생성합니다.
   * 율 시작 전 (novel.start() 이전)에 호출되면 에러를 발생합니다.
   */
  private _makeCurrentCtx(): SceneContext {
    const scene = this._currentScene
    if (!(scene instanceof DialogueScene)) {
      throw new Error('[fumika] Variable and audio operations require an active scene. Call novel.start() first.')
    }

    const globalVars = this.variables as Record<string, any>
    const envVars = this.environments as Record<string, any>
    const getLocalVars = () => this._currentScene instanceof DialogueScene
      ? (this._currentScene as any).localVars as Record<string, any>
      : scene.getLocalVars()

    // _buildCallbacks()는 _sceneGeneration을 증가시키므로 안정적 콜백 직접 구성
    const stableCallbacks: SceneCallbacks = {
      getNovel: () => this as any,
      getGlobalVars: () => this.variables as Record<string, any>,
      setGlobalVar: (n, v) => { this._setGlobalVar(n, v) },
      getEnvironments: () => this.environments as Record<string, any>,
      setEnvironment: (n, v) => { this._setEnvironment(n, v) },
      loadScene: (target) => { this.loadScene(target) },
      callScene: () => { },
      captureRenderer: () => this._renderer.captureState(),
      isSkipping: () => this._isSkipping,
      disableInput: () => { },
      getStateStore: () => this._stateStore,
      getUIRegistry: () => this._uiRegistry,
      syncUIState: () => { },
      advance: () => { },
      executeCmd: () => (function* () { return false as const })(),
      getActiveActions: (name) => this._currentScene instanceof DialogueScene
        ? (this._currentScene as DialogueScene).definition.actions?.[name]
        : undefined,
      getActiveLocalVars: () => this._currentScene instanceof DialogueScene
        ? (this._currentScene as DialogueScene).getLocalVars()
        : {},
      getSceneActions: (sceneName, actionName) => {
        const def = this._scenes.get(sceneName)
        return (def as any)?.actions?.[actionName]
      },
      getCurrentSceneName: () => this._currentSceneDef?.name as string ?? '',
      getSceneLocalVars: (sceneName) => {
        if (this._currentSceneDef?.name === sceneName && this._currentScene instanceof DialogueScene) {
          return (this._currentScene as any).localVars
        }
        for (let i = this._callStack.length - 1; i >= 0; i--) {
          if (this._callStack[i].sceneName === sceneName) return this._callStack[i].localVars
        }
        const def = this._scenes.get(sceneName)
        return { ...(def as any)?.localVars ?? {} }
      },
    }

    let ctx: SceneContext
    ctx = {
      novel: this as any,
      world: this._world as any,
      renderer: this._renderer,
      get globalVars() { return this.novel._createGlobalVarsProxy() },
      get localVars() { return this.novel._createSceneLocalVarsProxy(getLocalVars, () => ctx) as any },
      get environments() { return this.novel._createEnvironmentsProxy() },
      callbacks: stableCallbacks,
      scene: {
        getTextSubIndex: () => 0,
        setTextSubIndex: () => { },
        interpolateText: (text) => text,
        jumpToLabel: () => { },
        hasLabel: () => false,
        getVars: () => ({
          ...this.environments as object,
          ...this.variables as object,
          ...getLocalVars(),
        }) as any,
        setGlobalVar: (key, value) => { this._setGlobalVar(key, value) },
        setLocalVar: () => { },
        loadScene: (target) => { this.loadScene(target) },
        end: () => { },
        callScene: () => { },
      },
      state: {
        set: (n, data) => { this._stateStore.set(n, data) },
        get: (n) => this._stateStore.get(n),
      },
      ui: {
        register: (n, entry) => { this._uiRegistry.set(n, entry) },
        get: (n) => this._uiRegistry.get(n),
        show: (n, duration) => { this._uiRegistry.get(n)?.show?.(duration) },
        hide: (n, duration) => { this._uiRegistry.get(n)?.hide?.(duration) },
      },
      execute: function* () { return false },
      actions: { get: () => undefined },
    }

    return ctx
  }

  private _buildCallbacks(): SceneCallbacks {
    const gen = ++this._sceneGeneration
    return {
      getNovel: () => this as any,
      getGlobalVars: () => this.variables as Record<string, any>,
      setGlobalVar: (name, value) => { this._setGlobalVar(name, value) },
      getEnvironments: () => this.environments as Record<string, any>,
      setEnvironment: (name, value) => { this._setEnvironment(name, value) },
      loadScene: (target) => { this.loadScene(target) },
      callScene: (name, callerCursor, callerLocalVars, callerTextSubIndex, preserve, restore) => {
        this._callScene(name, callerCursor, callerLocalVars, callerTextSubIndex, preserve, restore)
      },
      captureRenderer: () => this._renderer.captureState(),
      isSkipping: () => this._isSkipping,
      disableInput: (duration) => { this._inputDisabledUntil = Date.now() + duration },
      getStateStore: () => this._stateStore,
      getUIRegistry: () => this._uiRegistry,
      syncUIState: () => { this._syncUIState() },
      advance: () => {
        // gen이 현재 _sceneGeneration과 일치하지 않으면 stale 콜백 — 실행 거부
        if (this._sceneGeneration !== gen) return
        const scene = this._currentScene
        if (scene instanceof DialogueScene && scene.isWaitingInput) {
          scene.advance()
          this._syncUIState()
        }
      },
      executeCmd: (cmd: any) => {
        // 항상 현재 활성 씬 기준으로 커맨드를 실행합니다.
        // 상위씬의 hook에서 ctx.execute를 호출해도 하위씬의 _executeCmd가 사용됩니다.
        const active = this._currentScene
        if (active instanceof DialogueScene) {
          return (active as any)._executeCmd(cmd)
        }
        return (function* (): Generator<any, any, any> { return false })()
      },
      getActiveActions: (name) => this._currentScene instanceof DialogueScene
        ? (this._currentScene as DialogueScene).definition.actions?.[name]
        : undefined,
      getActiveLocalVars: () => this._currentScene instanceof DialogueScene
        ? (this._currentScene as DialogueScene).getLocalVars()
        : {},
      getSceneActions: (sceneName, actionName) => {
        const def = this._scenes.get(sceneName)
        return (def as any)?.actions?.[actionName]
      },
      getCurrentSceneName: () => this._currentSceneDef?.name as string ?? '',
      getSceneLocalVars: (sceneName) => {
        if (this._currentSceneDef?.name === sceneName && this._currentScene instanceof DialogueScene) {
          return (this._currentScene as any).localVars
        }
        for (let i = this._callStack.length - 1; i >= 0; i--) {
          if (this._callStack[i].sceneName === sceneName) return this._callStack[i].localVars
        }
        const def = this._scenes.get(sceneName)
        return { ...(def as any)?.localVars ?? {} }
      },
    }
  }

  // ─── 사용자 입력 ─────────────────────────────────────────────

  /**
   * 대화를 한 단계 진행합니다.
   */
  next(): void {
    const canAdvance = this._novelHooker.trigger(
      'novel:next',
      true,
      (value) => value
    )
    if (!canAdvance) return

    if (Date.now() < this._inputDisabledUntil) return
    if (this._inputMode !== 'advance') return
    if (!this._currentScene || this._currentScene.isEnded) return

    // 타이핑 중이면 canAdvance()로 작업 위임
    for (const entry of this._uiRegistry.values()) {
      if (!entry.canAdvance) continue
      const result = entry.canAdvance()
      if (!result) return
    }

    this._currentScene.advance()
    this._syncUIState()
  }

  private _syncUIState(): void {
    if (!this._currentScene || this._currentScene.isEnded) {
      this._inputMode = 'block'
      if (this._currentScene?.isEnded && this._currentSceneDef?.kind === 'dialogue') {
        const next = (this._currentSceneDef as SceneDefinition<any, any, any, any, any>).nextScene
        if (next) {
          if (this._callStack.length > 0) {
            // 서브씬 체이닝: 현재 씬의 훅은 해제하되, callStack은 유지
            this._currentSceneDef?.hooks?._unregister(this)
            this._callingSubScene = true
            this.loadScene(next)
            this._callingSubScene = false
          } else {
            this.loadScene(next)
          }
          return
        }
        if (this._callStack.length > 0) {
          this._resumeCallerScene()
          return
        }
      }
      return
    }
    if (!(this._currentScene instanceof DialogueScene)) return

    const stepType = this._currentScene.getCurrentStepType()

    // stepType에 해당하는 UI 엔트리 직접 조회 → hideTags 발동
    const activeEntry = stepType ? this._uiRegistry.get(stepType) : undefined
    this._suppressUIs(activeEntry)

    this._inputMode = this._currentScene.isWaitingInput ? 'advance' : 'block'
  }

  /**
   * scene call 시 콜 스택에 호출자 프레임을 push하고 서브씬을 로드합니다.
   *
   * - preserve=false: 기존 동작 — 렌더러/stateStore 초기화 후 서브씬 시작
   * - preserve=true: 렌더러/stateStore 유지, uiRegistry만 재빌드(preserved state + initial 병합)
   */
  private _callScene(
    name: string,
    callerCursor: number,
    callerLocalVars: Record<string, any>,
    callerTextSubIndex: number,
    preserve: boolean,
    restore: boolean
  ): void {
    // 재생 중인 오디오의 현재 위치를 _tracks.start에 동기화
    const audioState = this._stateStore.get('audio') as { _tracks: Record<string, any> } | undefined
    if (audioState) {
      this.audio.syncPositions(audioState._tracks)
    }

    this._callStack.push({
      sceneName: this._currentSceneDef!.name as string,
      cursor: callerCursor,
      localVars: { ...callerLocalVars },
      textSubIndex: callerTextSubIndex,
      rendererState: this._renderer.captureState(),
      storeSnapshot: Object.fromEntries(this._stateStore),
      preserve,
      restore,
    })

    this._callingSubScene = true
    if (preserve) {
      this._loadPreserveSubScene(name)
    } else {
      this.loadScene(name)
    }
    this._callingSubScene = false
  }

  /**
   * preserve=true 서브씬 시작.
   * 렌더러·stateStore·uiRegistry를 모두 유지한 채 서브씬의 스크립트만 시작합니다.
   * _cleanupUI / _uiRegistry.clear / _runInitial을 호출하지 않아
   * 월드 오브젝트의 중복 생성을 방지합니다.
   * restore 시에는 _renderer.clear() + restoreState()가 서브씬 추가분을 포함해
   * 전부 정리하고 caller 상태를 복원합니다.
   */
  private _loadPreserveSubScene(name: string): void {
    const def = this._scenes.get(name)
    if (!def) {
      console.error(`[fumika] 씬 '${name}'이 등록되어 있지 않습니다.`)
      return
    }

    // _callingSubScene=true(call 경로)일 때는 부모씬 훅을 유지합니다.
    if (!this._callingSubScene) {
      this._currentSceneDef?.hooks?._unregister(this)
    }
    // preserve=true: 렌더러·stateStore·uiRegistry 전부 유지 (cleanupUI·clear 호출 안 함)

    const callbacks = this._buildCallbacks()
    const scene = new DialogueScene(this._renderer, callbacks, def)

    this._currentScene = scene
    this._currentSceneDef = def
    this._inputMode = 'block'

    def.hooks?._register(this)

    // skipInitial: true → _runInitial 건너뜀, 월드 오브젝트/UI 상태 그대로 이어받음
    scene.start({ skipInitial: true })
    this._syncUIState()
  }

  /**
   * 콜 스택에서 프레임을 pop하여 호출자 씬 환경을 복원합니다.
   *
   * - frame.preserve=false OR frame.restore=true: 렌더러·stateStore·UI 완전 복원 (기존 동작)
   * - frame.preserve=true AND frame.restore=false: 커서·localVars만 복원, 화면/오디오는 서브씬 상태 이어감
   */
  private _resumeCallerScene(): void {
    const frame = this._callStack.pop()!
    const def = this._scenes.get(frame.sceneName)
    if (!def) {
      console.error(`[fumika] callStack 복원 실패: 씬 '${frame.sceneName}'을 찾을 수 없습니다.`)
      return
    }

    const needsFullRestore = !frame.preserve || frame.restore

    // 런타임 상태 캡처 (behaviors가 수정한 attribute/style/transform 등)
    // cleanup 전에 수행하여 Leviar 오브젝트가 파괴되기 전 상태를 보존합니다.
    const runtimeSnapshots = new Map<string, Record<string, any>>()
    for (const [name, entry] of this._uiRegistry) {
      if (entry.captureRuntime) {
        runtimeSnapshots.set(name, entry.captureRuntime())
      }
    }

    // 서브씬 훅만 해제합니다. 부모씬 훅은 call 진입 시점에 유지되었으므로 이미 활성 상태입니다.
    this._currentSceneDef?.hooks?._unregister(this)
    this._currentSceneDef = def
    this._cleanupUI()
    this.stopSkip()

    if (needsFullRestore) {
      // 렌더러·stateStore·UI 완전 복원
      this._renderer.clear()
      this._renderer.restoreState(frame.rendererState)

      this._stateStore.clear()
      for (const [k, v] of Object.entries(frame.storeSnapshot)) {
        this._stateStore.set(k, v)
      }

      this._uiRegistry.clear()
      this._suppressedEntries.clear()
      this._rebuildModuleViews()
    } else {
      // preserve=true, restore=false: uiRegistry만 재빌드 (현재 렌더러/stateStore 유지)
      this._uiRegistry.clear()
      this._suppressedEntries.clear()
      this._rebuildModuleViews()
    }

    // 런타임 상태 복원 — rebuild된 새 Leviar 오브젝트에 캡처된 상태를 재적용
    for (const [name, snapshot] of runtimeSnapshots) {
      const entry = this._uiRegistry.get(name)
      if (entry?.restoreRuntime) {
        entry.restoreRuntime(snapshot)
      }
    }

    // 호출자 씬 복원 (커서·localVars)
    const callbacks = this._buildCallbacks()
    const scene = new DialogueScene(this._renderer, callbacks, def as SceneDefinition<any, any, any, any, any>)
    this._currentScene = scene
    this._inputMode = 'block'

    // 부모씬 훅은 call 진입 시점부터 유지되어 이미 등록 상태입니다.
    // 중복 등록을 방지하기 위해 _register를 생략합니다.

    scene.restoreState(frame.cursor, frame.localVars, frame.textSubIndex)

    this._syncUIState()
  }

  /**
   * `hideTags`에 나열된 태그를 하나라도 가진 엔트리에 `hide()`를 직접 호출합니다. (자기 자신 제외)
   * 이전에 숨겼던 엔트리가 더 이상 대상이 아니면 다시 `show()`를 호출하여 복구합니다.
   */
  private _suppressUIs(activeEntry?: UIRuntimeEntry): void {
    const nextSuppressed = new Set<UIRuntimeEntry>()
    const tags = activeEntry?.hideTags ?? []

    if (activeEntry && tags.length > 0) {
      for (const entry of this._uiRegistry.values()) {
        if (entry === activeEntry) continue
        if (entry.uiTags && entry.uiTags.some(tag => tags.includes(tag))) {
          nextSuppressed.add(entry)
        }
      }
    }

    // 이전에 숨겨졌으나 이번엔 대상이 아닌 경우 복구
    for (const entry of this._suppressedEntries) {
      if (!nextSuppressed.has(entry)) {
        entry.show(250)
      }
    }

    // 새로 숨겨져야 할 대상 숨김
    for (const entry of nextSuppressed) {
      if (!this._suppressedEntries.has(entry)) {
        entry.hide(250)
      }
    }

    this._suppressedEntries = nextSuppressed
  }

  // ─── 전체화면 ─────────────────────────────────────────────

  /** 현재 전체화면 모드인지 확인합니다. */
  get isFullscreen(): boolean {
    return document.fullscreenElement === this.container
  }

  /** 전체화면 모드로 전환합니다.
   * 엔진 전용 컨테이너를 전체화면 타겟으로 삼아
   * 내부 요소(hidden input 등)의 포커스가 전체화면 해제를 유발하지 않도록 방지합니다.
   */
  async requestFullscreen(): Promise<void> {
    if (!this.isFullscreen) {
      await this.container.requestFullscreen()
    }
  }

  /** 전체화면 모드를 해제합니다. */
  async exitFullscreen(): Promise<void> {
    if (this.isFullscreen) {
      await document.exitFullscreen()
    }
  }

  /** 전체화면 모드를 토글합니다. */
  async toggleFullscreen(): Promise<void> {
    if (this.isFullscreen) {
      await this.exitFullscreen()
    } else {
      await this.requestFullscreen()
    }
  }

  // ─── 디버그 모드 ─────────────────────────────────────────────

  /** 
   * 현재 렌더링 엔진(Leviar)의 디버그 모드 활성화 여부를 가져옵니다. 
   * 디버그 모드일 경우 UI의 레이아웃 영역이 화면에 표시됩니다.
   */
  get debugMode(): boolean {
    return this._world.debugMode ?? false
  }

  /** 
   * 렌더링 엔진(Leviar)의 디버그 모드를 설정합니다. 
   */
  set debugMode(value: boolean) {
    this._world.debugMode = value
  }

  // ─── rebuild용 SceneContext stub ────────────────────────────

  private _makeRebuildCtx(sceneDef?: AnySceneDef | null): SceneContext {
    const noop = () => { /* no-op */ }
    const stateStore = this._stateStore
    const uiRegistry = this._uiRegistry
    let ctx: SceneContext
    ctx = {
      novel: this as any,
      world: this._world,
      renderer: this._renderer,
      get globalVars() { return this.novel._createGlobalVarsProxy() },
      get localVars() {
        return this.novel._createSceneLocalVarsProxy(
          () => this.callbacks.getActiveLocalVars(),
          () => ctx,
        ) as any
      },
      get environments() { return this.novel._createEnvironmentsProxy() },
      callbacks: {
        getNovel: () => this as any,
        getGlobalVars: () => this.variables as Record<string, any>,
        setGlobalVar: noop as any,
        getEnvironments: () => ({ ...(this.environments ?? {}) as object }),
        setEnvironment: (name: string, value: any) => { this._setEnvironment(name, value) },
        loadScene: noop as any,
        callScene: noop as any,
        captureRenderer: () => this._renderer.captureState(),
        isSkipping: () => true,
        disableInput: noop as any,
        getStateStore: () => stateStore,
        getUIRegistry: () => uiRegistry,
        syncUIState: noop,
        advance: noop,
        executeCmd: (cmd: any) => {
          const active = this._currentScene
          if (active instanceof DialogueScene) {
            return (active as any)._executeCmd(cmd)
          }
          return (function* (): Generator<any, any, any> { return false })()
        },
        getActiveActions: (name) => this._currentScene instanceof DialogueScene
          ? (this._currentScene as DialogueScene).definition.actions?.[name]
          : undefined,
        getActiveLocalVars: () => this._currentScene instanceof DialogueScene
          ? (this._currentScene as DialogueScene).getLocalVars()
          : {},
        getSceneActions: (sceneName, actionName) => {
          const def = this._scenes.get(sceneName)
          return (def as any)?.actions?.[actionName]
        },
        getCurrentSceneName: () => sceneDef?.name as string ?? '',
        getSceneLocalVars: (sceneName) => {
          if (this._currentSceneDef?.name === sceneName && this._currentScene instanceof DialogueScene) {
            return (this._currentScene as any).localVars
          }
          for (let i = this._callStack.length - 1; i >= 0; i--) {
            if (this._callStack[i].sceneName === sceneName) return this._callStack[i].localVars
          }
          const def = this._scenes.get(sceneName)
          return { ...(def as any)?.localVars ?? {} }
        },
      },
      state: {
        set: (name, data) => { stateStore.set(name, data) },
        get: (name) => stateStore.get(name),
      },
      ui: {
        register: (name, entry) => { uiRegistry.set(name, entry) },
        get: (name) => uiRegistry.get(name),
        show: (name, dur) => uiRegistry.get(name)?.show(dur),
        hide: (name, dur) => uiRegistry.get(name)?.hide(dur),
      },
      scene: {
        getTextSubIndex: () => 0,
        setTextSubIndex: noop as any,
        interpolateText: (t: string) => t,
        jumpToLabel: noop as any,
        hasLabel: () => false,
        getVars: () => ({
          ...(this.environments ?? {}) as object,
          ...this.variables as object,
          ...(this._currentScene instanceof DialogueScene ? (this._currentScene as any).localVars : {}),
        }),
        setGlobalVar: noop as any,
        setLocalVar: noop as any,
        loadScene: noop as any,
        end: noop,
        callScene: noop as any, // rebuild ctx에서는 callScene 호출 없음
      },
      execute: (cmd: any) => {
        const scene = this._currentScene
        if (scene && scene instanceof DialogueScene) {
          return (scene as any)._executeCmd(cmd)
        }
        return (function* () { return false })()
      },
      actions: {
        get: (name) => (sceneDef as any)?.actions?.[name],
      },
    }
    return ctx
  }

  /**
   * Novel 인스턴스의 모든 자원을 해제합니다.
   *
   * 1. 오디오 풀 즉시 정지
   * 2. UI 레지스트리 및 씬 훅 해제
   * 3. 관리형 타이머 취소 및 렌더러 상태 초기화
   * 4. 카메라 동기화 RAF 루프 취소
   * 5. Leviar World 완전 파괴 (오브젝트·비디오·물리·WebGL 컨텍스트 포함)
   *
   * 프리뷰 컴포넌트처럼 단기 수명의 Novel 인스턴스를 사용할 때
   * 언마운트 시 반드시 호출하여 메모리 누수를 방지하십시오.
   */
  destroy(): void {
    // fumika 레벨 정리: 오디오, 훅, UI 콜백, 관리형 타이머
    this.audio.stopAll(0)
    this._currentSceneDef?.hooks?._unregister(this)
    this._cleanupUI()
    this._renderer.clear()

    // Renderer._initCameraSync()가 등록한 독립적인 RAF 루프를 취소합니다.
    // world.destroy()는 이 루프를 알지 못하므로 fumika에서 직접 취소해야 합니다.
    this._renderer.cancelSyncLoop()

    // Leviar World 완전 파괴.
    // 렌더 루프 중지, 모든 오브젝트·비디오 정지, 물리 엔진,
    // WebGL 컨텍스트, 이벤트 리스너까지 모두 정리합니다.
    this._world.destroy()
  }
}
