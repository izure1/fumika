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
  | 'null'
  | 'style'
  | 'attribute'
  | 'vec3'
  | 'leviarObj'
  | 'any'
  | 'function'

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
  null: '#64748b',
  style: '#a855f7',
  attribute: '#ec4899',
  vec3: '#06b6d4',
  leviarObj: '#fb923c',
  any: '#cbd5e1',
  function: '#6366f1',
}

// ─── 노드 카테고리 ───────────────────────────────────────────

export type NodeCategory =
  | 'system'
  | 'flow'
  | 'variable'
  | 'utility'
  | 'object'
  | 'style-class'
  | 'motion'
  | 'effect'
  | 'interaction'
  | 'novel'

export const NODE_CATEGORY_COLORS: Record<NodeCategory, { bg: string, border: string, header: string, text: string }> = {
  system: { bg: 'rgba(20, 20, 23, 0.85)', border: '#f43f5e', header: 'rgba(28, 28, 33, 0.45)', text: '#fda4af' },
  flow: { bg: 'rgba(20, 20, 23, 0.85)', border: '#38bdf8', header: 'rgba(28, 28, 33, 0.45)', text: '#bae6fd' },
  variable: { bg: 'rgba(20, 20, 23, 0.85)', border: '#a78bfa', header: 'rgba(28, 28, 33, 0.45)', text: '#ddd6fe' },
  utility: { bg: 'rgba(20, 20, 23, 0.85)', border: '#64748b', header: 'rgba(28, 28, 33, 0.45)', text: '#cbd5e1' },
  object: { bg: 'rgba(20, 20, 23, 0.85)', border: '#fb7185', header: 'rgba(28, 28, 33, 0.45)', text: '#fecdd3' },
  'style-class': { bg: 'rgba(20, 20, 23, 0.85)', border: '#84cc16', header: 'rgba(28, 28, 33, 0.45)', text: '#d9f99d' },
  motion: { bg: 'rgba(20, 20, 23, 0.85)', border: '#10b981', header: 'rgba(28, 28, 33, 0.45)', text: '#a7f3d0' },
  effect: { bg: 'rgba(20, 20, 23, 0.85)', border: '#ec4899', header: 'rgba(28, 28, 33, 0.45)', text: '#fbcfe8' },
  interaction: { bg: 'rgba(20, 20, 23, 0.85)', border: '#f59e0b', header: 'rgba(28, 28, 33, 0.45)', text: '#fde68a' },
  novel: { bg: 'rgba(20, 20, 23, 0.85)', border: '#f472b6', header: 'rgba(28, 28, 33, 0.45)', text: '#fbcfe8' },
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
  // ── System ─────────────────────────────────────────────────
  {
    type: 'CommandEntry',
    label: 'Command Entry',
    category: 'system',
    description: 'defineCommand의 진입점',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['command'],
    singleton: true,
  },
  {
    type: 'ViewMountEntry',
    label: 'View Mount',
    category: 'system',
    description: 'defineView 호출 시 실행 (마운트)',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
    singleton: true,
  },
  {
    type: 'ShowEntry',
    label: 'show()',
    category: 'system',
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
    category: 'system',
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
    category: 'system',
    description: 'setState 호출 시 자동 실행',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
    singleton: true,
  },
  {
    type: 'OnCleanupEntry',
    label: 'onCleanup()',
    category: 'system',
    description: '씬 전환 시 정리',
    pins: [
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
    singleton: true,
  },

  // ── Flow ───────────────────────────────────────────────────
  {
    type: 'Branch',
    label: 'Branch',
    category: 'flow',
    description: 'if/else 분기',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'condition', label: 'Condition', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'true', label: 'True', direction: 'output', pinType: 'exec' },
      { id: 'false', label: 'False', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'Return',
    label: 'Return',
    category: 'flow',
    description: '커맨드 종료 (true=완료, false=대기)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'boolean' },
    ],
    allowedTabs: ['command'],
  },
  {
    type: 'Yield',
    label: 'Yield',
    category: 'flow',
    description: '사용자 입력 대기 후 재개 (true=완료, false=대기)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['command'],
  },
  {
    type: 'MakeFunction',
    label: 'Make Function',
    category: 'flow',
    description: '실행 흐름을 Function으로 변환 (우측 패널에서 매개변수를 등록할 수 있습니다)',
    pins: [
      { id: 'callback', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'fn', label: 'Callback', direction: 'output', pinType: 'data', dataType: 'function' }
    ]
  },
  {
    type: 'Log',
    label: 'Log',
    category: 'flow',
    description: 'console.log(message)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'message', label: 'Message', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetTimer',
    label: 'Set Timer',
    category: 'flow',
    description: '지연 시간 후 지정된 콜백 함수를 실행하는 타이머를 작동시킵니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'ms', label: 'Delay (ms)', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'callback', label: 'Callback', direction: 'input', pinType: 'data', dataType: 'function' },
      { id: 'respectSkip', label: 'Respect Skip', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'timerId', label: 'Timer ID', direction: 'output', pinType: 'data', dataType: 'any' }
    ]
  },
  {
    type: 'ClearTimer',
    label: 'Clear Timer',
    category: 'flow',
    description: '생성된 타이머의 작동을 중지시킵니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'timerId', label: 'Timer ID', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'Execute',
    label: 'Execute',
    category: 'flow',
    description: '타 모듈 커맨드를 호출합니다. 우측 패널에서 인자를 추가할 수 있습니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'type', label: 'Type', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ForOf',
    label: 'For Of',
    category: 'flow',
    description: '배열을 순회하며 매 루프마다 콜백 함수를 실행합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'callback', label: 'Callback', direction: 'input', pinType: 'data', dataType: 'function' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'index', label: 'Index', direction: 'output', pinType: 'data', dataType: 'number' },
      { id: 'element', label: 'Element', direction: 'output', pinType: 'data', dataType: 'any' }
    ]
  },
  {
    type: 'While',
    label: 'While',
    category: 'flow',
    description: '조건이 만족하는 동안 루프하며 콜백 함수를 순회 실행합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'condition', label: 'Condition', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'callback', label: 'Callback', direction: 'input', pinType: 'data', dataType: 'function' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },

  // ── Variable ───────────────────────────────────────────────
  {
    type: 'SetState',
    label: 'Set State',
    category: 'variable',
    description: 'setState({ field: value })',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetVariable',
    label: 'Set Variable',
    category: 'variable',
    description: '변수 설정 (global/local/env)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetValue',
    label: 'Set Value (Local)',
    category: 'variable',
    description: '현재 실행 흐름 내에서 유지되는 변수 저장 및 수정(재할당 가능)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'SetGlobal',
    label: 'Set Value (Global)',
    category: 'variable',
    description: '모든 흐름과 공유되는 변수 저장 및 수정(재할당 가능)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
  },
  {
    type: 'Constant',
    label: 'Constant',
    category: 'variable',
    description: '리터럴 값',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetState',
    label: 'Get State',
    category: 'variable',
    description: 'state[field] 읽기',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetCmd',
    label: 'Get Cmd',
    category: 'variable',
    description: 'cmd[property] 읽기',
    pins: [
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetVariable',
    label: 'Get Variable',
    category: 'variable',
    description: '변수 읽기 (global/local/env)',
    pins: [
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetValue',
    label: 'Get Value (Local)',
    category: 'variable',
    description: '현재 실행 흐름 내의 변수 읽기',
    pins: [
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetGlobal',
    label: 'Get Value (Global)',
    category: 'variable',
    description: '모든 흐름과 공유되는 변수 읽기',
    pins: [
      { id: 'name', label: 'Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' },
    ],
  },
  {
    type: 'GetArgument',
    label: 'Get Argument',
    category: 'variable',
    description: '현재 실행 흐름(콜백)의 N번째 매개변수 값을 조회합니다.',
    pins: [
      { id: 'index', label: 'Index', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' }
    ]
  },

  // ── Utility ────────────────────────────────────────────────
  {
    type: 'Compare',
    label: 'Compare',
    category: 'utility',
    description: '두 값 비교',
    pins: [
      { id: 'a', label: 'A', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'b', label: 'B', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'boolean' },
    ],
  },
  {
    type: 'MathOp',
    label: 'Math',
    category: 'utility',
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
    category: 'utility',
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
    category: 'utility',
    description: '시각적 스타일 객체 조립기',
    pins: [
      { id: 'style', label: 'Style', direction: 'output', pinType: 'data', dataType: 'style' },
    ],
  },
  {
    type: 'MakeAttribute',
    label: 'Make Attribute',
    category: 'utility',
    description: '오브젝트 어트리뷰트 속성 조립기',
    pins: [
      { id: 'attribute', label: 'Attribute', direction: 'output', pinType: 'data', dataType: 'attribute' },
    ],
  },
  {
    type: 'ArrayLength',
    label: 'Array Length',
    category: 'utility',
    description: '배열의 총 길이를 반환합니다.',
    pins: [
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'length', label: 'Length', direction: 'output', pinType: 'data', dataType: 'number' }
    ]
  },
  {
    type: 'ArrayGet',
    label: 'Array Get',
    category: 'utility',
    description: '배열의 특정 인덱스 위치의 값을 가져옵니다.',
    pins: [
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'index', label: 'Index', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' }
    ]
  },
  {
    type: 'ArraySet',
    label: 'Array Set',
    category: 'utility',
    description: '배열의 특정 인덱스 위치의 값을 변경합니다 (덮어쓰기).',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'index', label: 'Index', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ArrayAdd',
    label: 'Array Add',
    category: 'utility',
    description: '배열의 맨 끝에 새로운 값을 추가합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'index', label: 'Index', direction: 'output', pinType: 'data', dataType: 'number' }
    ]
  },
  {
    type: 'ArrayInsert',
    label: 'Array Insert',
    category: 'utility',
    description: '배열의 특정 인덱스 위치에 값을 새로 삽입합니다 (splice).',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'index', label: 'Index', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ArrayRemove',
    label: 'Array Remove',
    category: 'utility',
    description: '배열에서 특정 인덱스 위치의 요소를 삭제합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'index', label: 'Index', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ArrayClear',
    label: 'Array Clear',
    category: 'utility',
    description: '배열의 모든 요소를 완전히 비웁니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ArrayContains',
    label: 'Array Contains',
    category: 'utility',
    description: '배열에 특정 값이 포함되어 있는지 확인합니다.',
    pins: [
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'boolean' }
    ]
  },
  {
    type: 'ArrayReverse',
    label: 'Array Reverse',
    category: 'utility',
    description: '배열의 요소 순서를 완전히 뒤집습니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ArraySlice',
    label: 'Array Slice',
    category: 'utility',
    description: '배열의 일부분을 복사하여 새 배열을 추출합니다.',
    pins: [
      { id: 'array', label: 'Array', direction: 'input', pinType: 'data', dataType: 'array' },
      { id: 'start', label: 'Start', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'end', label: 'End', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'array' }
    ]
  },
  {
    type: 'ObjectGet',
    label: 'Object Get',
    category: 'utility',
    description: '객체에서 특정 키에 해당하는 속성 값을 조회합니다.',
    pins: [
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'key', label: 'Key', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'output', pinType: 'data', dataType: 'any' }
    ]
  },
  {
    type: 'ObjectSet',
    label: 'Object Set',
    category: 'utility',
    description: '객체의 특정 키에 값을 설정합니다 (덮어쓰기 및 추가).',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'key', label: 'Key', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'any' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ObjectDelete',
    label: 'Object Delete',
    category: 'utility',
    description: '객체에서 특정 키 속성을 완전히 삭제합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'key', label: 'Key', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' }
    ]
  },
  {
    type: 'ObjectHasKey',
    label: 'Object Has Key',
    category: 'utility',
    description: '객체에 특정 키가 존재하는지 여부를 확인합니다.',
    pins: [
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'key', label: 'Key', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'boolean' }
    ]
  },
  {
    type: 'Keys',
    label: 'Object Keys',
    category: 'utility',
    description: '객체의 모든 키들을 배열로 반환합니다.',
    pins: [
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'keys', label: 'Keys', direction: 'output', pinType: 'data', dataType: 'array' }
    ]
  },
  {
    type: 'ObjectValues',
    label: 'Object Values',
    category: 'utility',
    description: '객체의 모든 값들을 배열로 반환합니다.',
    pins: [
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'object' },
      { id: 'values', label: 'Values', direction: 'output', pinType: 'data', dataType: 'array' }
    ]
  },

  // ── Object ─────────────────────────────────────────────────
  {
    type: 'CreateRectangle',
    label: 'Create Rectangle',
    category: 'object',
    description: 'ctx.world.createRectangle()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'attribute', label: 'Attribute', direction: 'input', pinType: 'data', dataType: 'attribute' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CreateEllipse',
    label: 'Create Ellipse',
    category: 'object',
    description: 'ctx.world.createEllipse()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'attribute', label: 'Attribute', direction: 'input', pinType: 'data', dataType: 'attribute' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CreateText',
    label: 'Create Text',
    category: 'object',
    description: 'ctx.world.createText()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'text', label: 'Text', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'attribute', label: 'Attribute', direction: 'input', pinType: 'data', dataType: 'attribute' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CreateImage',
    label: 'Create Image',
    category: 'object',
    description: 'ctx.world.createImage()',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'image', label: 'Image', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'attribute', label: 'Attribute', direction: 'input', pinType: 'data', dataType: 'attribute' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'position', label: 'Position', direction: 'input', pinType: 'data', dataType: 'vec3' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'RemoveObject',
    label: 'Remove Object',
    category: 'object',
    description: 'object.remove({ child, follower })',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'child', label: 'Child', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'follower', label: 'Follower', direction: 'input', pinType: 'data', dataType: 'boolean' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'AddChild',
    label: 'Add Child',
    category: 'object',
    description: '부모 오브젝트에 자식 오브젝트 추가',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'parent', label: 'Parent', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'child', label: 'Child', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'GetCamera',
    label: 'Get Camera',
    category: 'object',
    description: '카메라 오브젝트 참조 반환',
    pins: [
      { id: 'camera', label: 'Camera', direction: 'output', pinType: 'data', dataType: 'leviarObj' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CanvasToWorld',
    label: 'Canvas To World',
    category: 'object',
    description: '캔버스 좌표를 카메라 기준의 월드 좌표로 변환 (canvasToWorld)',
    pins: [
      { id: 'camera', label: 'Camera', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'x', label: 'X', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'y', label: 'Y', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'targetZ', label: 'Target Z', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Position', direction: 'output', pinType: 'data', dataType: 'vec3' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CanvasToLocal',
    label: 'Canvas To Local',
    category: 'object',
    description: '캔버스 좌표를 카메라 기준의 로컬 좌표로 변환 (canvasToLocal)',
    pins: [
      { id: 'camera', label: 'Camera', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'x', label: 'X', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'y', label: 'Y', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'targetZ', label: 'Target Z', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Position', direction: 'output', pinType: 'data', dataType: 'vec3' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'CalcDepthRatio',
    label: 'Calc Depth Ratio',
    category: 'object',
    description: '목표 Z 깊이에 맞춰 원근 투영 크기 비율을 계산 (calcDepthRatio)',
    pins: [
      { id: 'camera', label: 'Camera', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'targetZ', label: 'Target Z', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'value', label: 'Value', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'result', label: 'Ratio', direction: 'output', pinType: 'data', dataType: 'number' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'RemoveChild',
    label: 'Remove Child',
    category: 'object',
    description: '부모 오브젝트에서 자식 오브젝트 제거',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'parent', label: 'Parent', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'child', label: 'Child', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'RemoveFromParent',
    label: 'Remove From Parent',
    category: 'object',
    description: '현재 부모 오브젝트로부터 독립',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },

  // ── Style & Class ──────────────────────────────────────────
  {
    type: 'SetStyle',
    label: 'Set Style',
    category: 'style-class',
    description: '오브젝트의 Style 설정',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'style', label: 'Style', direction: 'input', pinType: 'data', dataType: 'style' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'SetAttribute',
    label: 'Set Attribute',
    category: 'style-class',
    description: '오브젝트의 Attribute 설정',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'attribute', label: 'Attribute', direction: 'input', pinType: 'data', dataType: 'attribute' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'HasClass',
    label: 'Has Class',
    category: 'style-class',
    description: '오브젝트가 해당 클래스명을 가졌는지 확인',
    pins: [
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'className', label: 'Class Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'boolean' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'AddClass',
    label: 'Add Class',
    category: 'style-class',
    description: '오브젝트에 하나 이상의 클래스 추가',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'className', label: 'Class Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'RemoveClass',
    label: 'Remove Class',
    category: 'style-class',
    description: '오브젝트에서 하나 이상의 클래스 제거',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'className', label: 'Class Name', direction: 'input', pinType: 'data', dataType: 'string' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },

  // ── Motion ─────────────────────────────────────────────────
  {
    type: 'ApplyForce',
    label: 'Apply Force',
    category: 'motion',
    description: '오브젝트 물리 바디에 힘 적용',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'x', label: 'X Force', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'y', label: 'Y Force', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'SetVelocity',
    label: 'Set Velocity',
    category: 'motion',
    description: '오브젝트 물리 바디의 속도 설정',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'x', label: 'X Velocity', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'y', label: 'Y Velocity', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'SetAngularVelocity',
    label: 'Set Angular Velocity',
    category: 'motion',
    description: '오브젝트 물리 바디의 각속도 설정',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'angularVelocity', label: 'Angular Vel', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'ApplyTorque',
    label: 'Apply Torque',
    category: 'motion',
    description: '오브젝트 물리 바디에 회전 토크 적용',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'torque', label: 'Torque', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'Follow',
    label: 'Follow',
    category: 'motion',
    description: '다른 오브젝트를 일정 거리를 두고 추적',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'target', label: 'Target', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'offsetX', label: 'Offset X', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'offsetY', label: 'Offset Y', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'offsetZ', label: 'Offset Z', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'Unfollow',
    label: 'Unfollow',
    category: 'motion',
    description: '대상을 따라다니는 동작을 중지',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'Kick',
    label: 'Kick',
    category: 'motion',
    description: '자신을 따라다니는 특정 오브젝트 추적 끊기',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'follower', label: 'Follower', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },

  // ── Effect ─────────────────────────────────────────────────
  {
    type: 'FadeIn',
    label: 'Fade In',
    category: 'effect',
    description: 'object.fadeIn(duration, easing)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'duration', label: 'Duration', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },
  {
    type: 'FadeOut',
    label: 'Fade Out',
    category: 'effect',
    description: 'object.fadeOut(duration, easing)',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'duration', label: 'Duration', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },

  // ── Interaction ────────────────────────────────────────────
  {
    type: 'BindEvent',
    label: 'Bind Event',
    category: 'interaction',
    description: '오브젝트에 이벤트 핸들러 바인딩',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'object', label: 'Object', direction: 'input', pinType: 'data', dataType: 'leviarObj' },
      { id: 'callback', label: 'Callback', direction: 'input', pinType: 'data', dataType: 'function' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
    ],
    allowedTabs: ['view'],
  },

  // ── Novel ──────────────────────────────────────────────────
  {
    type: 'NovelSave',
    label: 'Save',
    category: 'novel',
    description: 'SaveManager를 통해 슬롯에 게임 진행 상태를 저장합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'slot', label: 'Slot', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'string' }
    ],
    allowedTabs: ['command']
  },
  {
    type: 'NovelLoadSave',
    label: 'Load Save',
    category: 'novel',
    description: 'SaveManager를 통해 슬롯에서 게임 진행 상태를 불러옵니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'slot', label: 'Slot', direction: 'input', pinType: 'data', dataType: 'number' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'string' }
    ],
    allowedTabs: ['command']
  },
  {
    type: 'NovelSaveEnv',
    label: 'Save Env',
    category: 'novel',
    description: 'SaveManager를 통해 현재 환경변수 상태를 저장합니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'string' }
    ],
    allowedTabs: ['command']
  },
  {
    type: 'NovelLoadEnv',
    label: 'Load Env',
    category: 'novel',
    description: 'SaveManager를 통해 저장된 환경변수 상태를 불러옵니다.',
    pins: [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'exec-out', label: '▶', direction: 'output', pinType: 'exec' },
      { id: 'result', label: 'Result', direction: 'output', pinType: 'data', dataType: 'string' }
    ],
    allowedTabs: ['command']
  }
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
  {
    key: 'backgroundSize', label: 'Bg Size', type: 'select', options: [
      { value: 'cover', label: 'cover' },
      { value: 'contain', label: 'contain' },
      { value: 'auto', label: 'auto' }
    ], defaultValue: 'cover'
  },
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
  {
    key: 'fontStyle', label: 'Font Style', type: 'select', options: [
      { value: 'normal', label: 'normal' },
      { value: 'italic', label: 'italic' }
    ], defaultValue: 'normal'
  },
  {
    key: 'textAlign', label: 'Text Align', type: 'select', options: [
      { value: 'left', label: 'left' },
      { value: 'center', label: 'center' },
      { value: 'right', label: 'right' }
    ], defaultValue: 'left'
  },
  { key: 'lineHeight', label: 'Line Height', type: 'number', defaultValue: 1.2 },
  {
    key: 'display', label: 'Display', type: 'select', options: [
      { value: 'block', label: 'block' },
      { value: 'none', label: 'none' }
    ], defaultValue: 'block'
  },
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
  {
    key: 'cursor', label: 'Cursor', type: 'select', options: [
      { value: 'default', label: 'default' },
      { value: 'pointer', label: 'pointer' },
      { value: 'grab', label: 'grab' },
      { value: 'text', label: 'text' }
    ], defaultValue: 'default'
  },
  {
    key: 'overflow', label: 'Overflow', type: 'select', options: [
      { value: 'hidden', label: 'hidden' },
      { value: 'visible', label: 'visible' }
    ], defaultValue: 'hidden'
  },
  {
    key: 'blendMode', label: 'Blend Mode', type: 'select', options: [
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
    ], defaultValue: 'source-over'
  }
]

export interface AttributePropertySpec {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: { value: string, label: string }[]
  placeholder?: string
  defaultValue: unknown
}

export const LEVIAR_ATTRIBUTE_PROPERTIES: AttributePropertySpec[] = [
  { key: 'name', label: 'Name', type: 'text', placeholder: 'object-name', defaultValue: '' },
  { key: 'className', label: 'Class Name', type: 'text', placeholder: 'class-name', defaultValue: '' },
  {
    key: 'physics', label: 'Physics', type: 'select', options: [
      { value: 'none', label: 'none' },
      { value: 'dynamic', label: 'dynamic' },
      { value: 'static', label: 'static' }
    ], defaultValue: 'none'
  },
  { key: 'density', label: 'Density', type: 'number', defaultValue: 0.001 },
  { key: 'friction', label: 'Friction', type: 'number', defaultValue: 0.1 },
  { key: 'frictionAir', label: 'Friction Air', type: 'number', defaultValue: 0.01 },
  { key: 'restitution', label: 'Restitution', type: 'number', defaultValue: 0 },
  { key: 'fixedRotation', label: 'Fixed Rotation', type: 'boolean', defaultValue: false },
  { key: 'gravityScale', label: 'Gravity Scale', type: 'number', defaultValue: 1 },
  { key: 'collisionGroup', label: 'Collision Group', type: 'number', defaultValue: 1 },
  { key: 'collisionMask', label: 'Collision Mask', type: 'number', defaultValue: 4294967295 },
  { key: 'collisionCategory', label: 'Collision Category', type: 'number', defaultValue: 1 },
  { key: 'text', label: 'Text Content', type: 'text', defaultValue: '' },
  { key: 'src', label: 'Src (Asset)', type: 'text', defaultValue: '' },
  { key: 'currentTime', label: 'Current Time', type: 'number', defaultValue: 0 },
  { key: 'playbackRate', label: 'Playback Rate', type: 'number', defaultValue: 1 },
  { key: 'volume', label: 'Volume', type: 'number', defaultValue: 1 },
  { key: 'strictPhysics', label: 'Strict Physics', type: 'boolean', defaultValue: false },
  { key: 'focalLength', label: 'Focal Length', type: 'number', defaultValue: 100 }
]

