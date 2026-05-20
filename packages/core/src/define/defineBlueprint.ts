// =============================================================
// src/define/defineBlueprint.ts — 블루프린트 런타임 해석기 공용 유틸
// =============================================================

export interface BlueprintNode {
  id: string
  data?: {
    nodeType: string
    fieldName?: string
    operator?: string
    width?: number
    height?: number
    color?: string
    text?: string
    size?: number
    src?: string
    [key: string]: any
  }
}

export interface BlueprintEdge {
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface BlueprintGraph {
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
}

export interface BlueprintRuntimeContext {
  cmd?: any
  ctx: any
  state: any
  setState: (updates: any) => void
  outputs: Map<string, any>
}

/**
 * 런타임 상에서 저장된 블루프린트 그래프의 노드 연결 상태를 기반으로 흐름을 해석하고 연산을 실행합니다.
 */
export function runBlueprintFlow(
  tabName: string,
  graphs: Record<string, BlueprintGraph>,
  entryNodeType: string,
  runtimeContext: BlueprintRuntimeContext
): Generator<any, any, any> | undefined {
  const graph = graphs[tabName]
  if (!graph || !graph.nodes) return

  // 진입 엔트리 노드 탐색
  const entryNode = graph.nodes.find((n) => n.data?.nodeType === entryNodeType)
  if (!entryNode) return

  const { ctx, state, setState, outputs } = runtimeContext

  // 데이터 핀 의존성 역방향 재귀 연산
  function evaluatePin(handleId: string): any {
    if (outputs.has(handleId)) {
      return outputs.get(handleId)
    }

    // handleId 예: "node_id__pin_id"
    const index = handleId.indexOf('__')
    if (index === -1) return undefined
    const nodeId = handleId.substring(0, index)
    const pinId = handleId.substring(index + 2)

    // 해당 입력 핀에 연결된 소스 엣지 조회
    const incomingEdge = (graph.edges || []).find(
      (e) => e.target === nodeId && e.targetHandle === handleId
    )

    if (incomingEdge && incomingEdge.sourceHandle) {
      // 소스 노드 연산 평가
      return evaluateNodePin(incomingEdge.source, incomingEdge.sourceHandle)
    }

    // 연결선이 없는 경우 노드 자체의 리터럴 데이터 반환
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (node && node.data && pinId in node.data) {
      return node.data[pinId]
    }

    return undefined
  }

  function evaluateNodePin(nodeId: string, handleId: string): any {
    if (outputs.has(handleId)) {
      return outputs.get(handleId)
    }

    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return undefined

    const nodeType = node.data?.nodeType
    const pinId = handleId.substring(handleId.indexOf('__') + 2)

    let val: any = undefined

    // 노드 타입별 연산 분기
    if (nodeType === 'GetState') {
      const field = node.data?.fieldName
      if (field) val = state[field]
    } else if (nodeType === 'GetCmd') {
      const field = node.data?.fieldName
      if (field && runtimeContext.cmd) val = runtimeContext.cmd[field]
    } else if (nodeType === 'GetCamera') {
      val = ctx.world?.camera
    } else if (nodeType === 'Compare') {
      const op = node.data?.operator || '=='
      const a = evaluatePin(nodeId + '__a')
      const b = evaluatePin(nodeId + '__b')
      if (op === '==') val = (a == b)
      else if (op === '!=') val = (a != b)
      else if (op === '<') val = (a < b)
      else if (op === '>') val = (a > b)
      else if (op === '<=') val = (a <= b)
      else if (op === '>=') val = (a >= b)
    } else if (nodeType === 'Add') {
      val = Number(evaluatePin(nodeId + '__a') || 0) + Number(evaluatePin(nodeId + '__b') || 0)
    } else if (nodeType === 'Subtract') {
      val = Number(evaluatePin(nodeId + '__a') || 0) - Number(evaluatePin(nodeId + '__b') || 0)
    } else if (nodeType === 'Multiply') {
      val = Number(evaluatePin(nodeId + '__a') || 0) * Number(evaluatePin(nodeId + '__b') || 0)
    } else if (nodeType === 'Divide') {
      const divisor = Number(evaluatePin(nodeId + '__b') || 1)
      val = Number(evaluatePin(nodeId + '__a') || 0) / (divisor === 0 ? 1 : divisor)
    } else if (nodeType === 'CreateRectangle') {
      const width = Number(evaluatePin(nodeId + '__width') ?? 100)
      const height = Number(evaluatePin(nodeId + '__height') ?? 100)
      const color = evaluatePin(nodeId + '__color') || '#ffffff'
      if (ctx.world) {
        val = ctx.world.createRectangle({
          style: { width, height, color }
        })
      }
    } else if (nodeType === 'CreateText') {
      const text = evaluatePin(nodeId + '__text') || ''
      const size = Number(evaluatePin(nodeId + '__size') ?? 24)
      const color = evaluatePin(nodeId + '__color') || '#ffffff'
      if (ctx.world) {
        val = ctx.world.createText({
          text,
          style: { fontSize: size, fill: color }
        })
      }
    } else if (nodeType === 'CreateImage') {
      const src = evaluatePin(nodeId + '__src') || ''
      if (ctx.world) {
        val = ctx.world.createImage({ src })
      }
    }

    outputs.set(handleId, val)
    return val
  }

  // 실행 흐름 제어 제너레이터 함수
  function* executeNode(currentNodeId: string): Generator<any, any, any> {
    const node = graph.nodes.find((n) => n.id === currentNodeId)
    if (!node) return

    const nodeType = node.data?.nodeType

    let nextPinId = 'next'

    if (nodeType === 'SetState') {
      const field = node.data?.fieldName
      const val = evaluatePin(currentNodeId + '__value')
      if (field) {
        setState({ [field]: val })
      }
    } else if (nodeType === 'AddChild') {
      const parent = evaluatePin(currentNodeId + '__parent')
      const child = evaluatePin(currentNodeId + '__child')
      if (parent && typeof parent.addChild === 'function' && child) {
        parent.addChild(child)
      }
    } else if (nodeType === 'PlayEffect') {
      const type = evaluatePin(currentNodeId + '__type')
      const duration = evaluatePin(currentNodeId + '__duration')
      ctx.execute({ type: 'effect', action: 'play', effect: type, duration })
    } else if (nodeType === 'StopEffect') {
      const type = evaluatePin(currentNodeId + '__type')
      ctx.execute({ type: 'effect', action: 'stop', effect: type })
    } else if (nodeType === 'Branch') {
      const cond = evaluatePin(currentNodeId + '__condition')
      nextPinId = cond ? 'true-exec' : 'false-exec'
    } else if (nodeType === 'Delay') {
      const dur = Number(evaluatePin(currentNodeId + '__duration') ?? 1000)
      yield { duration: dur }
    } else if (nodeType === 'Return') {
      return
    }

    // 다음 연결된 노드로 실행 이동
    const outgoingEdge = (graph.edges || []).find(
      (e) => e.source === currentNodeId && e.sourceHandle === (currentNodeId + '__' + nextPinId)
    )
    if (outgoingEdge) {
      yield* executeNode(outgoingEdge.target)
    }
  }

  // 엔트리 노드의 다음 연결된 노드부터 순차 탐색 실행
  const firstEdge = (graph.edges || []).find(
    (e) => e.source === entryNode.id && e.sourceHandle === (entryNode.id + '__next')
  )
  if (firstEdge) {
    return executeNode(firstEdge.target)
  }
}
