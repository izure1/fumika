import type { Style } from 'leviar'
import type { VarResolvable } from '../types/utils'
import { applyVarResolvable } from '../types/utils'
import { define } from '../define/defineCmdUI'
import { Z_INDEX } from '../constants/render'

// ─── DialogBoxSchema ──────────────────────────────────────────

/**
 * 대화상자 내부 간격 레이아웃 설정.
 * `defineInitial` 또는 커맨드의 `layout` 필드로 씬/커맨드별 지정 가능.
 */
export interface DialogBoxLayout {
  /**
   * 패널 내부 좌측(수평) 패딩 (px).
   * @default 28
   */
  panelPaddingLeft?: number
  /**
   * 패널 내부 우측(수평) 패딩 (px).
   * @default 28
   */
  panelPaddingRight?: number
  /**
   * 패널 내부 상단(수직) 패딩 (px).
   * @default 28
   */
  panelPaddingTop?: number
  /**
   * 패널 내부 하단(수직) 패딩 (px).
   * @default 28
   */
  panelPaddingBottom?: number
  /**
   * title과 content 사이 간격 (px). title/content 모두 있을 때만 적용.
   * @default 12
   */
  titleContentGap?: number
  /**
   * content 영역과 버튼 영역 사이 간격 (px).
   * @default 30
   */
  contentButtonGap?: number
  /**
   * 버튼 행 간 세로 간격 (px).
   * @default 10
   */
  buttonRowGap?: number
  /**
   * 같은 행 버튼 간 가로 간격 (px).
   * @default 8
   */
  buttonColumnGap?: number
  /**
   * 버튼 내부 좌측 패딩 (px). 버튼 너비 추정 시 사용.
   * @default 24
   */
  buttonPaddingLeft?: number
  /**
   * 버튼 내부 우측 패딩 (px). 버튼 너비 추정 시 사용.
   * @default 24
   */
  buttonPaddingRight?: number
  /**
   * 버튼 내부 상단 패딩 (px). 버튼 높이 계산 시 사용.
   * @default 10
   */
  buttonPaddingTop?: number
  /**
   * 버튼 내부 하단 패딩 (px). 버튼 높이 계산 시 사용.
   * @default 10
   */
  buttonPaddingBottom?: number
}

/**
 * dialogBoxModule이 공유하는 데이터 스키마.
 * 스타일 필드는 `defineInitial`로 씬별 커스터마이징 가능.
 */
export interface DialogBoxSchema {
  /** 전체 화면 오버레이(반투명 배경) 스타일 */
  overlay?: Partial<Style>
  /** 대화상자 패널 스타일 */
  panel?: Partial<Style>
  /** 제목 텍스트 스타일 */
  titleStyle?: Partial<Style>
  /** 본문 텍스트 스타일 */
  contentStyle?: Partial<Style>
  /** 버튼 기본 스타일 */
  button?: Partial<Style>
  /** 버튼 호버 스타일 */
  buttonHover?: Partial<Style>
  /** 버튼 텍스트 스타일 */
  buttonText?: Partial<Style>
  /** 버튼 텍스트 호버 스타일 */
  buttonTextHover?: Partial<Style>
  /** 내부 간격 레이아웃. `defineInitial`로 씬 전체에 적용 가능 */
  layout?: DialogBoxLayout

  // ─── 런타임 상태 ────────────────────────────────────────────
  _title: string
  _content: string
  _buttons: { text: string }[]
  _resolve: ((index: number) => void) | null
  _duration: number
  _persist: boolean

}

// ─── 기본값 ──────────────────────────────────────────────────

export const DEFAULT_DIALOG_BOX_STYLE: Required<Pick<
  DialogBoxSchema,
  'overlay' | 'panel' | 'titleStyle' | 'contentStyle' | 'button' | 'buttonHover' | 'buttonText' | 'buttonTextHover'
>> = {
  overlay: { background: 'rgba(0,0,0,0.45)' },
  panel: {
    background: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: '4%',
    minWidth: 480,
    height: undefined,
  },
  titleStyle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: '"Noto Sans KR","Malgun Gothic",sans-serif',
    textAlign: 'center',
    textShadowBlur: 8,
    textShadowColor: 'rgba(150,200,255,0.6)',
    textShadowOffsetX: 0,
    textShadowOffsetY: 0,
  },
  contentStyle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.66)',
    lineHeight: 1.5,
    fontFamily: '"Noto Sans KR","Malgun Gothic",sans-serif',
    textAlign: 'center',
    textShadowBlur: 0,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffsetX: 2,
    textShadowOffsetY: 2,
  },
  button: {
    background: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.30)',
    borderWidth: 1,
    borderRadius: '10%',
    minWidth: 120,
  },
  buttonHover: {
    background: 'rgba(255,255,255,0.28)',
    borderColor: 'rgba(255,255,255,0.70)',
  },
  buttonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    fontFamily: '"Noto Sans KR","Malgun Gothic",sans-serif',
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowBlur: 0,
    textShadowColor: 'rgba(0,0,0,1)',
    textShadowOffsetX: 2,
    textShadowOffsetY: 2,
  },
  buttonTextHover: { color: '#ffffff' },
}

// ─── DialogBoxCmd 타입 ────────────────────────────────────────

/**
 * 커스텀 버튼 대화상자를 표시합니다.
 *
 * @example
 * // alert
 * { type: 'dialogBox', title: '알림', content: '저장되었습니다.', buttons: [{ text: '확인' }] }
 *
 * // overlay 클릭으로 닫히지 않게
 * { type: 'dialogBox', title: '선택', content: '반드시 선택하세요.', persist: true, buttons: [...] }
 *
 * // 등장 시간 커스텀
 * { type: 'dialogBox', title: '..', duration: 500, buttons: [...] }
 */
export interface DialogBoxCmd<TConfig = any, TLocalVars = Record<never, never>> {
  /** 대화상자 제목 */
  title: string
  /** 대화상자 본문 내용 */
  content: string
  /**
   * 등장/퇴장 fadeIn/fadeOut 시간(ms). 기본값 200.
   */
  duration?: number
  /**
   * true이면 오버레이 클릭으로 닫히지 않음.
   * false(기본)이면 오버레이 클릭 시 -1 인덱스로 resolve되고 닫힘.
   */
  persist?: boolean

  /**
   * 버튼 목록. 1개 이상 필수.
   * - `text`: 버튼 레이블
   * - `var`: 버튼 클릭 시 설정할 전역 변수를 반환하는 콜백 (선택)
   */
  buttons: {
    text: string
    var?: VarResolvable<TConfig, TLocalVars>
  }[]
}

// ─── DialogBoxHook 타입 ────────────────────────────────────────

export type ResolvedDialogBoxButton = DialogBoxCmd<any, any>['buttons'][number]

import type { SceneContext } from '../core/SceneContext'

export interface DialogBoxHook {
  'dialogBox:show': (value: DialogBoxCmd<any, any>, ctx: SceneContext) => DialogBoxCmd<any, any>
  'dialogBox:select': (value: { index: number, selected?: ResolvedDialogBoxButton }, ctx: SceneContext) => { index: number, selected?: ResolvedDialogBoxButton }
}

// ─── 모듈 정의 ───────────────────────────────────────────────

// ─── 레이아웃 기본값 ─────────────────────────────────────────

export const DEFAULT_DIALOG_BOX_LAYOUT: Required<DialogBoxLayout> = {
  panelPaddingLeft: 28,
  panelPaddingRight: 28,
  panelPaddingTop: 28,
  panelPaddingBottom: 28,
  titleContentGap: 12,
  contentButtonGap: 30,
  buttonRowGap: 10,
  buttonColumnGap: 8,
  buttonPaddingLeft: 24,
  buttonPaddingRight: 24,
  buttonPaddingTop: 10,
  buttonPaddingBottom: 10,
}

const dialogBoxModule = define<DialogBoxCmd<any, any>, DialogBoxSchema, DialogBoxHook>({
  overlay: DEFAULT_DIALOG_BOX_STYLE.overlay,
  panel: DEFAULT_DIALOG_BOX_STYLE.panel,
  titleStyle: DEFAULT_DIALOG_BOX_STYLE.titleStyle,
  contentStyle: DEFAULT_DIALOG_BOX_STYLE.contentStyle,
  button: DEFAULT_DIALOG_BOX_STYLE.button,
  buttonHover: DEFAULT_DIALOG_BOX_STYLE.buttonHover,
  buttonText: DEFAULT_DIALOG_BOX_STYLE.buttonText,
  buttonTextHover: DEFAULT_DIALOG_BOX_STYLE.buttonTextHover,
  layout: DEFAULT_DIALOG_BOX_LAYOUT,
  _title: '',
  _content: '',
  _buttons: [],
  _resolve: null,
  _duration: 200,
  _persist: false,
})

dialogBoxModule.defineView((ctx, data, setState) => {
  const cam = ctx.world.camera
  const w = ctx.renderer.width
  const h = ctx.renderer.height

  const toLocal = (cx: number, cy: number) =>
    (cam && typeof cam.canvasToLocal === 'function')
      ? cam.canvasToLocal(cx, cy)
      : { x: cx - w / 2, y: -(cy - h / 2), z: cam?.attribute?.focalLength ?? 100 }

  const mergeStyle = <T extends object>(def: T, override?: Partial<T>): T =>
  ({ ...def, ...(override ?? {}) } as T)

  // ─── overlayObj: camera 직접 자식 ─────────────────────────
  // display:'none' → cascade로 자손 전체 숨김 (v1.0.6+)
  // fadeIn/fadeOut 하나로 전체 제어
  const overlayCfg = data.overlay ?? DEFAULT_DIALOG_BOX_STYLE.overlay
  const overlayObj = ctx.world.createRectangle({
    style: {
      ...overlayCfg,
      width: w,
      height: h,
      zIndex: Z_INDEX.DIALOG_BOX,
      opacity: 1,
      display: 'none',
      pointerEvents: true,
    },
    transform: { position: toLocal(w / 2, h / 2) },
  })
  ctx.world.camera?.addChild(overlayObj)
  // __fadeOpacity 초기값=1이므로 첫 fadeIn이 1→1로 동작 안 함.
  // fadeOut(0).stop()으로 즉시 __fadeOpacity=0, display=none 초기화
  overlayObj.fadeOut(0).stop()

  // ─── panelObj: overlayObj 자식 ────────────────────────────
  const panelCfgInit = data.panel ?? DEFAULT_DIALOG_BOX_STYLE.panel
  // 초기 PANEL_W: _render 시 갱신되므로 임시값으로 초기화
  const _initMinW = (panelCfgInit.minWidth as number) ?? 400
  const _initMaxW = (panelCfgInit.maxWidth as number) ?? Infinity
  const _initW = (panelCfgInit.width as number) ?? 480
  const INIT_PANEL_W = Math.max(_initMinW, Math.min(_initW, _initMaxW))

  const panelObj = ctx.world.createRectangle({
    style: {
      ...panelCfgInit,
      width: INIT_PANEL_W,
      height: 10,
      zIndex: Z_INDEX.DIALOG_BOX + 1,
      pointerEvents: true,
    },
    transform: { position: { x: 0, y: 0, z: 0 } },
  })
  overlayObj.addChild(panelObj)

  // ─── 동적 자식 (매 _render마다 panelObj 자식으로 새로 생성) ─
  // - animate() 없이 생성 위치 = 최종 위치 → fadeIn 충돌 없음
  // - overlay cascade로 자동 숨김/표시
  let _dynamicObjs: any[] = []

  const _clearDynamic = () => {
    _dynamicObjs.forEach(obj => obj.remove({ child: true }))
    _dynamicObjs = []
  }

  // ─── overlay 클릭 핸들러 (persist 제어) ────────────────
  // _render마다 갱신되는 현재 resolve/persist 참조
  let _currentResolve: ((i: number) => void) | null = null
  let _currentPersist = false
  let _currentPanelW = INIT_PANEL_W
  let _currentPanelH = 0

  overlayObj.on('click', (e: MouseEvent) => {
    e.stopPropagation()
    e.stopImmediatePropagation()

    if (!_currentPersist && _currentResolve) {
      // panel 영역 클릭이면 dismiss 차단
      // canvas 중앙기준 마우스 좌표 vs panel 반폭관 비교
      const canvasRect = (ctx.renderer as any)._world?._canvas?.getBoundingClientRect?.() ||
      { left: 0, top: 0, width: w, height: h }
      const mouseX = e.clientX - canvasRect.left - canvasRect.width / 2
      const mouseY = e.clientY - canvasRect.top - canvasRect.height / 2
      const inPanel = Math.abs(mouseX) <= _currentPanelW / 2 && Math.abs(mouseY) <= _currentPanelH / 2
      if (inPanel) return
      _currentResolve(-1)
    }
  })

  // ─── 레이아웃 계산 & 렌더 ─────────────────────────────────
  // panel-local 좌표: y축 위=+, 아래=-, 중심={0,0}
  const _render = (
    title: string,
    content: string,
    buttons: { text: string }[],
    resolve: (i: number) => void,
    duration: number,
    persist: boolean,
    cfg: DialogBoxSchema,
  ) => {
    _currentResolve = resolve
    _currentPersist = persist

    const btnCfg = cfg.button ?? DEFAULT_DIALOG_BOX_STYLE.button
    const btnHoverCfg = cfg.buttonHover ?? DEFAULT_DIALOG_BOX_STYLE.buttonHover
    const btnTxtCfg = cfg.buttonText ?? DEFAULT_DIALOG_BOX_STYLE.buttonText
    const btnTxtHoverCfg = cfg.buttonTextHover ?? DEFAULT_DIALOG_BOX_STYLE.buttonTextHover
    const titleCfgR = cfg.titleStyle ?? DEFAULT_DIALOG_BOX_STYLE.titleStyle
    const contentCfgR = cfg.contentStyle ?? DEFAULT_DIALOG_BOX_STYLE.contentStyle

    // ─── 패널 너비: _render마다 cfg 기반으로 재계산 ─────────
    const panelCfg = cfg.panel ?? DEFAULT_DIALOG_BOX_STYLE.panel
    const _minW = (panelCfg.minWidth as number) ?? 400
    const _maxW = (panelCfg.maxWidth as number) ?? Infinity
    const _w = (panelCfg.width as number) ?? 480
    const PANEL_W = Math.max(_minW, Math.min(_w, _maxW))
    panelObj.style.width = panelCfg.width ?? PANEL_W
    if (panelCfg.minWidth !== undefined) panelObj.style.minWidth = panelCfg.minWidth
    if (panelCfg.maxWidth !== undefined) panelObj.style.maxWidth = panelCfg.maxWidth
    _currentPanelW = PANEL_W

    const titleFontSize = (titleCfgR.fontSize as number) ?? 22
    const contentFontSize = (contentCfgR.fontSize as number) ?? 18
    const btnFontSize = (btnTxtCfg.fontSize as number) ?? 16

    // ─── 레이아웃 간격 (schema.layout > DEFAULT_LAYOUT) ─────
    const layoutCfg: Required<DialogBoxLayout> = { ...DEFAULT_DIALOG_BOX_LAYOUT, ...(cfg.layout ?? {}) }
    const PANEL_PAD_L = layoutCfg.panelPaddingLeft
    const PANEL_PAD_R = layoutCfg.panelPaddingRight
    const PANEL_PAD_T = layoutCfg.panelPaddingTop
    const PANEL_PAD_B = layoutCfg.panelPaddingBottom
    const BTN_H_GAP = layoutCfg.buttonColumnGap
    const GAP = title && content ? layoutCfg.titleContentGap : 0
    const CONTENT_BTN_GAP = layoutCfg.contentButtonGap
    const TITLE_H = title ? titleFontSize * 1.6 : 0
    const CONTENT_H = content ? contentFontSize * 2.4 : 0
    const BTN_PAD_Y_SUM = layoutCfg.buttonPaddingTop + layoutCfg.buttonPaddingBottom
    const BTN_PAD_X_SUM = layoutCfg.buttonPaddingLeft + layoutCfg.buttonPaddingRight
    const BTN_H = btnFontSize * 1.2 + BTN_PAD_Y_SUM
    const BTN_ROW_GAP = layoutCfg.buttonRowGap
    const AVAILABLE_W = PANEL_W - PANEL_PAD_L - PANEL_PAD_R

    // ─── 버튼 너비 계산 ───────────────────────────────────────
    const btnWidths = buttons.map(buttonDef => {
      const estimatedW = buttonDef.text.length * btnFontSize * 0.8
      const rawW = (btnCfg.width as number) ?? (estimatedW + BTN_PAD_X_SUM)
      const minW = (btnCfg.minWidth as number) ?? 100
      const maxW = (btnCfg.maxWidth as number) ?? 400
      return Math.max(minW, Math.min(rawW, maxW))
    })

    // ─── greedy 행 분배 ───────────────────────────────────────
    type BtnRow = { indices: number[]; totalWidth: number }
    const rows: BtnRow[] = []
    let currentRow: BtnRow = { indices: [], totalWidth: 0 }

    buttons.forEach((_, i) => {
      const bw = btnWidths[i]
      const needed = currentRow.indices.length > 0
        ? currentRow.totalWidth + BTN_H_GAP + bw
        : bw
      if (needed <= AVAILABLE_W || currentRow.indices.length === 0) {
        currentRow.indices.push(i)
        currentRow.totalWidth = needed
      } else {
        rows.push(currentRow)
        currentRow = { indices: [i], totalWidth: bw }
      }
    })
    if (currentRow.indices.length > 0) rows.push(currentRow)

    // ─── 전체 패널 높이 ───────────────────────────────────────
    const buttonsH = rows.length * BTN_H + Math.max(0, rows.length - 1) * BTN_ROW_GAP
    const contentsTotalH = TITLE_H + GAP + CONTENT_H + (buttons.length > 0 ? CONTENT_BTN_GAP : 0) + buttonsH
    const PANEL_H = PANEL_PAD_T + contentsTotalH + PANEL_PAD_B
    if (panelCfg.height === undefined) {
      panelObj.style.height = PANEL_H
    }
    _currentPanelH = PANEL_H

    _clearDynamic()

    // ─── 자식 요소 배치 (y축 위가 양수) ────────────────────────
    let currentY = PANEL_H / 2 - PANEL_PAD_T

    // 1. 타이틀
    if (title) {
      const tObj = ctx.world.createText({
        attribute: { text: title },
        style: mergeStyle(titleCfgR, { width: AVAILABLE_W, height: TITLE_H }),
        transform: { position: { x: (PANEL_PAD_L - PANEL_PAD_R) / 2, y: currentY - TITLE_H / 2, z: 0 } },
      })
      panelObj.addChild(tObj)
      _dynamicObjs.push(tObj)
      currentY -= (TITLE_H + GAP)
    }

    // 2. 컨텐츠
    if (content) {
      const cObj = ctx.world.createText({
        attribute: { text: content },
        style: mergeStyle(contentCfgR, { width: AVAILABLE_W, height: CONTENT_H }),
        transform: { position: { x: (PANEL_PAD_L - PANEL_PAD_R) / 2, y: currentY - CONTENT_H / 2, z: 0 } },
      })
      panelObj.addChild(cObj)
      _dynamicObjs.push(cObj)
      currentY -= (CONTENT_H + CONTENT_BTN_GAP)
    }

    // 3. 버튼 배치
    rows.forEach((row, rowIdx) => {
      const rowLocalY = currentY - BTN_H / 2
      let xOffset = -(row.totalWidth + (row.indices.length - 1) * BTN_H_GAP) / 2 + (PANEL_PAD_L - PANEL_PAD_R) / 2

      row.indices.forEach(i => {
        const bw = btnWidths[i]
        const btnLocalX = xOffset + bw / 2
        xOffset += bw + BTN_H_GAP

        const btnStyle: Partial<Style> = {
          ...btnCfg,
          width: bw,
          height: BTN_H,
          zIndex: 603,
          pointerEvents: true,
          cursor: 'pointer',
        }

        const btnObj = ctx.world.createRectangle({
          style: btnStyle,
          transform: { position: { x: btnLocalX, y: rowLocalY, z: 0 } },
        })

        const txtObj = ctx.world.createText({
          attribute: { text: buttons[i].text },
          style: { ...btnTxtCfg, zIndex: 604, pointerEvents: false },
          transform: { position: { x: 0, y: 0, z: 0 } },
        })

        // hover에서 변경한 키만 원본값으로 복원
        const normalBtnProps = Object.fromEntries(
          Object.keys(btnHoverCfg).map(key => [key, (btnStyle as any)[key]])
        )
        const normalTxtProps = Object.fromEntries(
          Object.keys(btnTxtHoverCfg).map(key => [key, (btnTxtCfg as any)[key]])
        )

        btnObj.on('mouseover', () => {
          btnObj.animate({ style: btnHoverCfg as any }, 150)
          txtObj.animate({ style: btnTxtHoverCfg as any }, 150)
        })
        btnObj.on('mouseout', () => {
          btnObj.animate({ style: normalBtnProps as any }, 150)
          txtObj.animate({ style: normalTxtProps as any }, 150)
        })
        btnObj.on('click', (e: MouseEvent) => {
          e.stopPropagation()
          e.stopImmediatePropagation()
          resolve(i)
        })

        btnObj.addChild(txtObj)
        panelObj.addChild(btnObj)
        _dynamicObjs.push(btnObj)
      })
    })

    // overlayObj.fadeIn 하나로 전체 표시 (cascade)
    overlayObj.fadeIn(duration, 'easeOut')
  }


  const _hide = (duration: number) => {
    _currentResolve = null
    overlayObj.fadeOut(duration, 'easeIn')
    // _clearDynamic은 다음 _render 시작 시 처리
  }

  return {
    show: (duration) => {
      if (_currentResolve) overlayObj.fadeIn(duration, 'easeOut')
    },
    hide: (duration) => {
      if (_currentResolve) overlayObj.fadeOut(duration, 'easeIn')
    },

    // ─── 입력 역할 선언 ────────────────────────────────
    uiTags: ['dialogBox', 'default-ui'],
    hideTags: ['default-ui'],

    onCleanup: () => {
      _clearDynamic()
      overlayObj.remove({ child: true })
    },

    onUpdate: (_ctx, state, _setState) => {
      if (state._resolve && state._buttons.length > 0) {
        _render(
          state._title,
          state._content,
          state._buttons,
          state._resolve,
          state._duration,
          state._persist,
          state
        )
      }
    },
    _hide,
  }
})

dialogBoxModule.defineCommand(function* (cmd, ctx, _state, setState) {
  const entry = ctx.ui.get(dialogBoxModule.__key!)

  if (!entry) {
    console.warn('[fumika] dialogBox UI entry not found. Ensure it is defined in novel.config.ts modules.')
    return true
  }

  // 대화창 숨김 — suppressRoles를 통해 onSuppress() 이벤트로 자동 처리됨

  // 'dialogBox:show' 훅 방출
  const finalCmd = dialogBoxModule.hooker.trigger('dialogBox:show', cmd, (value) => value, ctx)

  const duration = finalCmd.duration ?? 200
  const persist = finalCmd.buttons.length > 0 ? true : (finalCmd.persist ?? false)

  let _resolved = false

  const resolve = (i: number) => {
    if (_resolved) return
    _resolved = true;
    (entry as any)._hide(duration)

    const selectedObj = i >= 0 ? finalCmd.buttons[i] : undefined

    // 'dialogBox:select' 훅 방출
    const selectData = dialogBoxModule.hooker.trigger(
      'dialogBox:select',
      { index: i, selected: selectedObj },
      (value) => value,
      ctx
    )

    const finalSelected = selectData.selected

    if (finalSelected?.var) {
      applyVarResolvable(finalSelected.var, ctx)
    }
    // 모듈의 역할이 끝났음을 명시적으로 선언하고 씬을 진행시킵니다.
    // (클릭 이벤트 버블링은 상단의 e.stopPropagation()으로 방어합니다)
    ctx.callbacks.advance()
  }

  // command 시작 즉시 blocking (애니메이션 중에도 novel.next 차단)
  setState({
    _title: finalCmd.title,
    _content: finalCmd.content,
    _buttons: finalCmd.buttons.map(b => ({ text: b.text })),
    _resolve: resolve,
    _duration: duration,
    _persist: persist,

  })

  while (_resolved === false) {
    yield false
  }

  setState({ _resolve: null, _buttons: [], _title: '', _content: '' })

  return true
})

export default dialogBoxModule
