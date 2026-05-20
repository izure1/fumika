// =============================================================
// blueprint.ts — 블루프린트 모듈 에디터 타입 정의
// =============================================================

// ─── 모듈 정의 데이터 (Schema / Cmd / Hook) ──────────────────

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface PropertyDef {
  name: string
  type: FieldType
  defaultValue?: unknown
  optional?: boolean
  description?: string
}

export interface HookSignatureDef {
  key: string
  paramTypes: PropertyDef[]
  returnType: string
  description?: string
}

/** define<TCmd, TSchema, THook>(schema) 에 대응하는 정의 데이터 */
export interface ModuleDefinitions {
  /** 모듈 이름 (모듈 키) */
  moduleName: string
  /** TSchema — 세이브에 저장되는 직렬화 가능 상태 필드 */
  schemaDef: PropertyDef[]
  /** TCmd — 씬 커맨드의 props 필드 */
  commandDef: PropertyDef[]
  /** THook — 훅 시그니처 맵 */
  hookDef: HookSignatureDef[]
}

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
  exec: '#f1f5f9',
  number: '#10b981',
  string: '#3b82f6',
  boolean: '#ef4444',
  object: '#94a3b8',
  array: '#f59e0b',
  style: '#a855f7',
  vec3: '#06b6d4',
  leviarObj: '#fb923c',
  any: '#cbd5e1',
}

// ─── 노드 카테고리 ───────────────────────────────────────────

export type NodeCategory = 'event' | 'condition' | 'action' | 'data'

export const NODE_CATEGORY_COLORS: Record<NodeCategory, { bg: string, border: string, header: string, text: string }> = {
  event: { bg: 'rgba(20, 20, 23, 0.85)', border: '#f43f5e', header: 'rgba(28, 28, 33, 0.45)', text: '#fda4af' },
  condition: { bg: 'rgba(20, 20, 23, 0.85)', border: '#10b981', header: 'rgba(28, 28, 33, 0.45)', text: '#a7f3d0' },
  action: { bg: 'rgba(20, 20, 23, 0.85)', border: '#3b82f6', header: 'rgba(28, 28, 33, 0.45)', text: '#bfdbfe' },
  data: { bg: 'rgba(20, 20, 23, 0.85)', border: '#d97706', header: 'rgba(28, 28, 33, 0.45)', text: '#fde68a' },
}

// ─── 블루프린트 노드 타입 정의 ────────────────────────────────

export interface BlueprintNodeDef {
  type: string
  label: string
  category: NodeCategory
  description: string
  pins: PinDef[]
  /** 이 노드를 사용할 수 있는 탭 목록. 미지정 시 모든 탭에서 사용 가능 */
  allowedTabs?: GraphTab[]
  /** true면 해당 그래프에서 1개만 존재 가능 (Entry 노드용) */
  singleton?: boolean
}

// ─── 그래프 탭 ───────────────────────────────────────────────

export type GraphTab =
  | 'command'
  | 'view'
  | 'boot'

export const GRAPH_TAB_LABELS: Record<GraphTab, string> = {
  command: 'Command',
  view: 'View',
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
    allowedTabs: ['command'],
    singleton: true,
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
    allowedTabs: ['view'],
    singleton: true,
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
    allowedTabs: ['view'],
    singleton: true,
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
    allowedTabs: ['view'],
    singleton: true,
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
    allowedTabs: ['view'],
    singleton: true,
  },
  {
    type: 'OnCleanupEntry',
    label: 'onCleanup()',
    category: 'event',
    description: '씬 전환 시 정리',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
    singleton: true,
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
    type: 'MakeStyle',
    label: 'Make Style',
    category: 'data',
    description: '시각적 스타일 객체 조립기',
    pins: [
      { id: 'style', label: 'Style', direction: 'output', pinType: 'data', dataType: 'style' },
    ],
  },
]

export interface StylePropertySpec {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: { value: string, label: string }[]
  placeholder?: string
  defaultValue: unknown
}

export const LEVIAR_STYLE_PROPERTIES: StylePropertySpec[] = [
  { key: 'color', label: 'Color (Text)', type: 'text', placeholder: '#ffffff', defaultValue: '#ffffff' },
  { key: 'background', label: 'Background', type: 'text', placeholder: '#3498db', defaultValue: '#3498db' },
  { key: 'backgroundSize', label: 'Bg Size', type: 'select', options: [
    { value: 'cover', label: 'cover' },
    { value: 'contain', label: 'contain' },
    { value: 'auto', label: 'auto' }
  ], defaultValue: 'cover' },
  { key: 'opacity', label: 'Opacity', type: 'number', placeholder: '1', defaultValue: 1 },
  { key: 'width', label: 'Width', type: 'number', placeholder: '100', defaultValue: 100 },
  { key: 'height', label: 'Height', type: 'number', placeholder: '100', defaultValue: 100 },
  { key: 'minWidth', label: 'Min Width', type: 'number', defaultValue: 0 },
  { key: 'maxWidth', label: 'Max Width', type: 'number', defaultValue: 1000 },
  { key: 'minHeight', label: 'Min Height', type: 'number', defaultValue: 0 },
  { key: 'maxHeight', label: 'Max Height', type: 'number', defaultValue: 1000 },
  { key: 'blur', label: 'Blur (px)', type: 'number', placeholder: '0', defaultValue: 0 },
  { key: 'borderColor', label: 'Border Color', type: 'text', placeholder: '#ffffff', defaultValue: '#ffffff' },
  { key: 'borderWidth', label: 'Border Width', type: 'number', placeholder: '0', defaultValue: 0 },
  { key: 'outlineColor', label: 'Outline Color', type: 'text', placeholder: '#ffffff', defaultValue: '#ffffff' },
  { key: 'outlineWidth', label: 'Outline Width', type: 'number', placeholder: '0', defaultValue: 0 },
  { key: 'fontSize', label: 'Font Size', type: 'number', placeholder: '16', defaultValue: 16 },
  { key: 'fontFamily', label: 'Font Family', type: 'text', placeholder: 'Inter', defaultValue: 'Inter' },
  { key: 'fontWeight', label: 'Font Weight', type: 'text', placeholder: 'normal', defaultValue: 'normal' },
  { key: 'fontStyle', label: 'Font Style', type: 'select', options: [
    { value: 'normal', label: 'normal' },
    { value: 'italic', label: 'italic' }
  ], defaultValue: 'normal' },
  { key: 'textAlign', label: 'Text Align', type: 'select', options: [
    { value: 'left', label: 'left' },
    { value: 'center', label: 'center' },
    { value: 'right', label: 'right' }
  ], defaultValue: 'left' },
  { key: 'lineHeight', label: 'Line Height', type: 'number', defaultValue: 1.2 },
  { key: 'display', label: 'Display', type: 'select', options: [
    { value: 'block', label: 'block' },
    { value: 'none', label: 'none' }
  ], defaultValue: 'block' },
  { key: 'pointerEvents', label: 'Pointer Events', type: 'boolean', defaultValue: true },
  { key: 'margin', label: 'Margin', type: 'text', placeholder: '0px', defaultValue: '0px' },
  { key: 'textShadowColor', label: 'Text Shadow Color', type: 'text', placeholder: '#000000', defaultValue: '#000000' },
  { key: 'textShadowBlur', label: 'Text Shadow Blur', type: 'number', defaultValue: 0 },
  { key: 'textShadowOffsetX', label: 'Text Shadow Offset X', type: 'number', defaultValue: 0 },
  { key: 'textShadowOffsetY', label: 'Text Shadow Offset Y', type: 'number', defaultValue: 0 },
  { key: 'boxShadowColor', label: 'Box Shadow Color', type: 'text', placeholder: '#000000', defaultValue: '#000000' },
  { key: 'boxShadowBlur', label: 'Box Shadow Blur', type: 'number', defaultValue: 0 },
  { key: 'boxShadowSpread', label: 'Box Shadow Spread', type: 'number', defaultValue: 0 },
  { key: 'boxShadowOffsetX', label: 'Box Shadow Offset X', type: 'number', defaultValue: 0 },
  { key: 'boxShadowOffsetY', label: 'Box Shadow Offset Y', type: 'number', defaultValue: 0 },
  { key: 'zIndex', label: 'Z Index', type: 'number', defaultValue: 0 },
  { key: 'letterSpacing', label: 'Letter Spacing', type: 'number', defaultValue: 0 },
  { key: 'borderRadius', label: 'Border Radius', type: 'number', placeholder: '0', defaultValue: 0 },
  { key: 'cursor', label: 'Cursor', type: 'select', options: [
    { value: 'default', label: 'default' },
    { value: 'pointer', label: 'pointer' },
    { value: 'grab', label: 'grab' },
    { value: 'text', label: 'text' }
  ], defaultValue: 'default' },
  { key: 'overflow', label: 'Overflow', type: 'select', options: [
    { value: 'hidden', label: 'hidden' },
    { value: 'visible', label: 'visible' }
  ], defaultValue: 'hidden' },
  { key: 'blendMode', label: 'Blend Mode', type: 'select', options: [
    { value: 'source-over', label: 'source-over' },
    { value: 'source-in', label: 'source-in' },
    { value: 'source-out', label: 'source-out' },
    { value: 'source-atop', label: 'source-atop' },
    { value: 'destination-over', label: 'destination-over' },
    { value: 'destination-in', label: 'destination-in' },
    { value: 'destination-out', label: 'destination-out' },
    { value: 'lighter', label: 'lighter' },
    { value: 'copy', label: 'copy' },
    { value: 'xor', label: 'xor' },
    { value: 'multiply', label: 'multiply' },
    { value: 'screen', label: 'screen' },
    { value: 'lighten', label: 'lighten' },
    { value: 'darken', label: 'darken' },
    { value: 'exclusion', label: 'exclusion' },
    { value: 'difference', label: 'difference' }
  ], defaultValue: 'source-over' }
]
