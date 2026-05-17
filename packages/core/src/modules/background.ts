import type { EasingType } from 'leviar'
import type { BgDefs, BackgroundKeysOf } from '../types/config'
import { Z_INDEX } from '../constants/render'
import { define } from '../define/defineCmdUI'

export type BackgroundFitPreset = 'stretch' | 'contain' | 'cover' | 'inherit'

/** 
 * 배경을 전환한다 
 * 
 * @example
 * { type: 'background', name: 'classroom', duration: 1500, fit: 'cover' }
 */
export interface BackgroundCmd<TConfig = any> {
  /** 전환할 배경 이미지의 에셋 키(config.backgrounds에 정의됨)입니다. */
  name: BackgroundKeysOf<TConfig>
  /** 배경 이미지의 화면 맞춤 방식(stretch, cover 등)입니다. */
  fit?: BackgroundFitPreset
  /** 배경 전환 시 크로스페이드(Fade)되는 시간(ms 단위)입니다. (기본값: 1000) */
  duration?: number
  /** 대상 에셋을 비디오(video)로 처리할지 여부입니다. (기본값: false) */
  isVideo?: boolean
  /** 애니메이션의 이징 함수 이름입니다. */
  ease?: EasingType
  /** 대상 에셋이 비디오인 경우 자동재생 여부입니다. (기본값: true) */
  autoplay?: boolean
}

// ─── 스키마 ──────────────────────────────────────────────────

export interface BackgroundSchema {
  /** @internal 현재 배경 키 */
  _key: string | undefined
  /** @internal 현재 fit 모드 */
  _fit: string
  /** @internal 최근 전환 시간 (ms) */
  _lastDuration: number
  /** @internal parallax 여부 */
  _parallax: boolean
  /** @internal 비디오 여부 */
  _isVideo: boolean
  /** @internal 최근 이징 함수 */
  _lastEase?: string
  /** @internal 자동재생 여부 */
  _autoplay: boolean
}

// ─── 모듈 정의 ───────────────────────────────────────────────

/**
 * 배경 모듈. `novel.config`의 `modules: { 'background': backgroundModule }` 형태로 등록합니다.
 */
const backgroundModule = define<BackgroundCmd<any>, BackgroundSchema>({
  _key: undefined,
  _fit: 'cover',
  _lastDuration: 1000,
  _parallax: true,
  _isVideo: false,
  _lastEase: undefined,
  _autoplay: true,
})

backgroundModule.defineView((ctx, data, setState) => {
  // 배경 오브젝트 참조
  let _bgObj: any = null
  let _bgParallax: boolean | null = null

  const _createBg = (key: string, fit: string, parallax: boolean, isVideo: boolean, autoplay: boolean, opacity = 1) => {
    const bgDefs = ctx.renderer.config.backgrounds as BgDefs
    const def = bgDefs[key]
    if (!def) return null

    const src = def.src ?? key
    const cam = ctx.renderer.world.camera as any
    const zPos = 2000 // 기존 ctx.renderer.depth(500) * 4
    const baseW = ctx.renderer.width
    const baseH = ctx.renderer.height
    const maxPanX = baseW * 0.08
    const maxPanY = baseH * 0.08
    const ratio = cam && typeof cam.calcDepthRatio === 'function' ? cam.calcDepthRatio(zPos, 1) : 1
    const exactW = baseW + maxPanX * 2
    const exactH = baseH + maxPanY * 2

    const createFn = isVideo
      ? ctx.renderer.world.createVideo.bind(ctx.renderer.world)
      : ctx.renderer.world.createImage.bind(ctx.renderer.world)

    // 비디오인 경우 VideoManager에 클립이 등록되지 않으면 자동 등록
    if (isVideo) {
      const vm = ctx.renderer.world.videoManager
      if (!vm.get(src)) {
        vm.create({ name: src, src, loop: true })
      }
    }

    const obj = createFn({
      attribute: { src },
      style: {
        width: exactW, height: exactH,
        zIndex: Z_INDEX.BACKGROUND,
        opacity,
        pointerEvents: false,
      },
      transform: { position: { x: 0, y: 0, z: zPos }, scale: { x: ratio, y: ratio, z: 1 } },
    })

    if (fit === 'cover' || fit === 'contain') {
      // cancelled 플래그로 onCleanup 이후의 댕글링 RAF를 방어합니다.
      let cancelled = false
      ;(obj as any).__cancelCheckFit = () => { cancelled = true }

      const checkFit = () => {
        if (cancelled) return
        const rw = (obj as any).__renderedSize?.w
        const rh = (obj as any).__renderedSize?.h
        if (rw > 0 && rh > 0) {
          const imgRatio = rw / rh
          const targetRatio = exactW / exactH
          if (fit === 'cover') {
            if (imgRatio > targetRatio) {
              obj.style.width = exactH * imgRatio
              obj.style.height = exactH
            } else {
              obj.style.width = exactW
              obj.style.height = exactW / imgRatio
            }
          } else if (fit === 'contain') {
            if (imgRatio > targetRatio) {
              obj.style.width = exactW
              obj.style.height = exactW / imgRatio
            } else {
              obj.style.width = exactH * imgRatio
              obj.style.height = exactH
            }
          }
        } else {
          requestAnimationFrame(checkFit)
        }
      }
      checkFit()
    }

    if (!parallax) {
      ctx.renderer.world.camera?.addChild(obj)
    }

    if (isVideo && autoplay && typeof (obj as any).play === 'function') {
      (obj as any).play()
    }

    return obj
  }

  // 복원: 저장된 배경이 있으면 즉시 렌더
  if (data._key) {
    _bgObj = _createBg(data._key, data._fit, data._parallax, data._isVideo, data._autoplay ?? false)
    _bgParallax = data._parallax
  }

  return {
    show: () => { },
    hide: () => { },
    onCleanup: () => {
      if (_bgObj) {
        // checkFit RAF를 즉시 취소합니다.
        if (typeof (_bgObj as any).__cancelCheckFit === 'function') {
          ;(_bgObj as any).__cancelCheckFit()
        }
        // LeviarVideo는 remove()만으로 내부 <video> 요소가 정지되지 않으므로
        // 반드시 stop()을 먼저 호출합니다.
        if (typeof (_bgObj as any).stop === 'function') {
          ;(_bgObj as any).stop()
        }
        _bgObj.remove({ child: true })
        _bgObj = null
      }
    },
    onUpdate: (_ctx, state, _setState) => {
      if (!state._key) return
      const bgDefs = ctx.renderer.config.backgrounds as BgDefs
      const def = bgDefs[state._key]
      if (!def) return

      const src = def.src ?? state._key
      const useParallax = def.parallax ?? true
      const dur = ctx.renderer.dur(state._lastDuration)
      const ease = (state._lastEase ?? 'easeInOutQuad') as EasingType

      ctx.renderer.state.set('backgroundKey', state._key)

      if (_bgObj) {
        const sameParallax = _bgParallax === useParallax
        if (sameParallax) {
          if (dur > 0 && typeof _bgObj.transition === 'function') {
            // leviar의 transition은 현재 duration만 지원합니다.
            _bgObj.transition(src, dur)
          } else {
            if (_bgObj.attribute) _bgObj.attribute.src = src
          }
          _bgParallax = useParallax
          return
        }
        // parallax 모드 변경 → 기존 제거
        _bgObj.remove()
        _bgObj = null
      }

      _bgParallax = useParallax
      _bgObj = _createBg(state._key, state._fit, useParallax, state._isVideo, state._autoplay, dur > 0 ? 0 : 1)
      if (dur > 0 && _bgObj) {
        ctx.renderer.animate(_bgObj, { style: { opacity: 1 } }, dur, ease)
      }
    },
  }
})

backgroundModule.defineCommand(function* (cmd, ctx, state, setState) {
  const bgDefs = ctx.renderer.config.backgrounds as BgDefs
  const def = bgDefs[cmd.name as string]
  if (!def) return true

  const fit = cmd.fit === 'inherit' || !cmd.fit ? 'cover' : cmd.fit

  setState({
    _key: cmd.name as string,
    _fit: fit,
    _lastDuration: cmd.duration ?? 1000,
    _parallax: def.parallax ?? true,
    _isVideo: cmd.isVideo ?? false,
    _autoplay: cmd.autoplay ?? true, // 기본값으로 자동재생
    _lastEase: cmd.ease
  })

  return true
})

export default backgroundModule

