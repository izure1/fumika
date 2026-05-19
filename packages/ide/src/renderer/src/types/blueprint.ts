// =============================================================
// blueprint.ts — 블루프린트 모듈 에디터 타입 정의
// =============================================================

// ─── 핀 타입 ─────────────────────────────────────────────────

export type PinDataType =
  | 'exec'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'array'
  | 'style'
  | 'vec3'
  | 'leviarObj'
  | 'any'

export interface PinDef {
  id: string
  label: string
  direction: 'input' | 'output'
  pinType: 'exec' | 'data'
  dataType?: PinDataType
}

// ─── 핀 색상 룩업 테이블 ──────────────────────────────────────

export const PIN_COLORS: Record<PinDataType, string> = {
  exec: '#ffffff',
  number: '#4CAF50',
  string: '#2196F3',
  boolean: '#F44336',
  object: '#9E9E9E',
  array: '#FF9800',
  style: '#9C27B0',
  vec3: '#00BCD4',
  leviarObj: '#FF9800',
  any: '#9E9E9E',
}

// ─── 노드 카테고리 ───────────────────────────────────────────

export type NodeCategory = 'event' | 'condition' | 'action' | 'data'

export const NODE_CATEGORY_COLORS: Record<NodeCategory, { bg: string, border: string, header: string, text: string }> = {
  event: { bg: '#1a0a0a', border: '#dc2626', header: '#7f1d1d', text: '#fca5a5' },
  condition: { bg: '#0a1a0a', border: '#16a34a', header: '#14532d', text: '#86efac' },
  action: { bg: '#0a0a1a', border: '#2563eb', header: '#1e3a8a', text: '#93c5fd' },
  data: { bg: '#1a1a0a', border: '#ca8a04', header: '#713f12', text: '#fde047' },
}

// ─── 블루프린트 노드 타입 정의 ────────────────────────────────

export interface BlueprintNodeDef {
  type: string
  label: string
  category: NodeCategory
  description: string
  pins: PinDef[]
}

// ─── 그래프 탭 ───────────────────────────────────────────────

export type GraphTab =
  | 'command'
  | 'view'
  | 'view:show'
  | 'view:hide'
  | 'view:onUpdate'
  | 'view:onCleanup'
  | 'boot'

export const GRAPH_TAB_LABELS: Record<GraphTab, string> = {
  command: 'Command',
  view: 'View (Mount)',
  'view:show': 'show()',
  'view:hide': 'hide()',
  'view:onUpdate': 'onUpdate()',
  'view:onCleanup': 'onCleanup()',
  boot: 'Boot',
}

// ─── 노드 카탈로그 ───────────────────────────────────────────

export const NODE_CATALOG: BlueprintNodeDef[] = [
  // ── Event ──────────────────────────────────────────────────
  {
    type: 'CommandEntry',
    label: 'Command Entry',
    category: 'event',
    description: 'defineCommand의 진입점',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'cmd', label: 'cmd', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'ctx', label: 'ctx', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'state', label: 'state', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'setState', label: 'setState', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'ViewMountEntry',
    label: 'View Mount',
    category: 'event',
    description: 'defineView 호출 시 실행 (마운트)',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'ctx', label: 'ctx', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'state', label: 'state', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'setState', label: 'setState', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'ShowEntry',
    label: 'show()',
    category: 'event',
    description: 'UI 표시 시 호출',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'duration', label: 'duration', direction: 'output', pinType: 'data', dataType: 'number' },
    ],
  },
  {
    type: 'HideEntry',
    label: 'hide()',
    category: 'event',
    description: 'UI 숨김 시 호출',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'duration', label: 'duration', direction: 'output', pinType: 'data', dataType: 'number' },
    ],
  },
  {
    type: 'OnUpdateEntry',
    label: 'onUpdate()',
    category: 'event',
    description: 'setState 호출 시 자동 실행',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'ctx', label: 'ctx', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'state', label: 'state', direction: 'output', pinType: 'data', dataType: 'object' },
      { id: 'setState', label: 'setState', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'OnCleanupEntry',
    label: 'onCleanup()',
    category: 'event',
    description: '씬 전환 시 정리',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },

  // ── Condition ──────────────────────────────────────────────
  {
    type: 'Branch',
    label: 'Branch',
    category: 'condition',
    description: 'if/else 분기',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'condition', label: 'Condition', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'true', label: 'True', direction: 'output', pinType: 'exec' },
      { id: 'false', label: 'False', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'Compare',
    label: 'Compare',
    category: 'condition',
    description: '두 값 비교',
    pins: [
      { id: 'a', label: 'A', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'b', label: 'B', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'boolean' },
    ],
  },

  // ── Action ─────────────────────────────────────────────────
  {
    type: 'Return',
    label: 'Return',
    category: 'action',
    description: '커맨드 종료 (true=완료, false=대기)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'boolean' },
    ],
  },
  {
    type: 'Yield',
    label: 'Yield',
    category: 'action',
    description: '사용자 입력 대기 후 재개',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetState',
    label: 'Set State',
    category: 'action',
    description: 'setState({ field: value })',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'field', label: 'Field', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetVariable',
    label: 'Set Variable',
    category: 'action',
    description: '변수 설정 (global/local/env)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'CreateRectangle',
    label: 'Create Rectangle',
    category: 'action',
    description: 'ctx.world.createRectangle()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
  },
  {
    type: 'CreateText',
    label: 'Create Text',
    category: 'action',
    description: 'ctx.world.createText()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'text', label: 'Text', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
  },
  {
    type: 'FadeIn',
    label: 'Fade In',
    category: 'action',
    description: 'object.fadeIn(duration, easing)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'duration', label: 'Duration', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'FadeOut',
    label: 'Fade Out',
    category: 'action',
    description: 'object.fadeOut(duration, easing)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'duration', label: 'Duration', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'RemoveObject',
    label: 'Remove Object',
    category: 'action',
    description: 'object.remove({ child: true })',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'BindEvent',
    label: 'Bind Event',
    category: 'action',
    description: '오브젝트에 이벤트 핸들러 바인딩',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'Log',
    label: 'Log',
    category: 'action',
    description: 'console.log(message)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'message', label: 'Message', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },

  // ── Data ───────────────────────────────────────────────────
  {
    type: 'Constant',
    label: 'Constant',
    category: 'data',
    description: '리터럴 값',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetState',
    label: 'Get State',
    category: 'data',
    description: 'state[field] 읽기',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetCmd',
    label: 'Get Cmd',
    category: 'data',
    description: 'cmd[property] 읽기',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetVariable',
    label: 'Get Variable',
    category: 'data',
    description: '변수 읽기 (global/local/env)',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'MathOp',
    label: 'Math',
    category: 'data',
    description: '사칙연산',
    pins: [
      { id: 'a', label: 'A', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'b', label: 'B', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'number' },
    ],
  },
  {
    type: 'MakePosition',
    label: 'Make Position',
    category: 'data',
    description: '{ x, y, z } 벡터 생성',
    pins: [
      { id: 'x', label: 'X', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'y', label: 'Y', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'z', label: 'Z', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Position', direction: 'output', pinType: 'data', dataType: 'vec3' },
    ],
  },
  {
    type: 'GetViewVar',
    label: 'Get View Var',
    category: 'data',
    description: 'View 스코프 로컬 변수 읽기',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'SetViewVar',
    label: 'Set View Var',
    category: 'action',
    description: 'View 스코프 로컬 변수에 저장',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
]
