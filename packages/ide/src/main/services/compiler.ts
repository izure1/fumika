// =============================================================
// compiler.ts — 블루프린트 컴파일러 (fbp.json -> .ts 트랜스파일)
// =============================================================


export interface BlueprintDefinitionField {
  name: string
  type: string
  description?: string
}

export interface BlueprintDefinitionHook {
  name: string
  parameters: { name: string; type: string }[]
  returnType: string
}

export interface BlueprintData {
  activeTab: string
  graphs: Record<string, { nodes: any[]; edges: any[] }>
  definitions: {
    moduleName: string
    schemaDef: BlueprintDefinitionField[]
    commandDef: BlueprintDefinitionField[]
    hookDef: BlueprintDefinitionHook[]
  }
}

/**
 * 블루프린트 JSON 원본 데이터를 실행 가능한 독립 타입스크립트 모듈 소스코드로 빌드합니다.
 * (런타임 인터프리터는 코어 패키지인 'fumika'에서 공용으로 임포트하여 사용합니다.)
 */
export function compileBlueprint(jsonStr: string): string {
  let bp: BlueprintData
  try {
    bp = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error('Invalid blueprint JSON structure: ' + (err as Error).message)
  }

  const { moduleName = 'Unnamed', schemaDef = [], commandDef = [], hookDef = [] } = bp.definitions || {}

  // 1. 타입 매핑 및 타입스크립트 인터페이스 작성
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'any',
    any: 'any'
  }

  const schemaProps = schemaDef
    .map((f) => `  ${f.name}: ${typeMap[f.type] || 'any'}`)
    .join('\n')

  const cmdProps = commandDef
    .map((f) => `  ${f.name}?: ${typeMap[f.type] || 'any'}`)
    .join('\n')

  const hookProps = hookDef
    .map((h) => {
      const params = (h.parameters || []).map((p) => `${p.name}: ${typeMap[p.type] || 'any'}`).join(', ')
      return `  '${moduleName}:${h.name}': (${params}) => ${typeMap[h.returnType] || 'any'}`
    })
    .join('\n')

  // 2. schemaDef 기본값 매핑
  const defaultValuesMap: Record<string, string> = {
    string: "''",
    number: '0',
    boolean: 'false',
    object: 'null',
    any: 'null'
  }

  const schemaDefaults = schemaDef
    .map((f) => `  ${f.name}: ${defaultValuesMap[f.type] || 'null'}`)
    .join(',\n')

  // 3. 소스코드 템플릿 텍스트 조립
  const cleanJson = JSON.stringify(bp, null, 2)

  return `// @fumika-blueprint-generated
import { define } from 'fumika'
import { runBlueprintFlow } from '@/helpers/blueprintRuntime'

interface MySchema {
${schemaProps}
}

interface MyCmd {
${cmdProps}
}

interface MyHook {
${hookProps}
}

const blueprintData = ${cleanJson}

export default define<MyCmd, MySchema, MyHook>({
${schemaDefaults}
})
  .defineCommand(function* (cmd, ctx, state, setState) {
    const outputs = new Map<string, any>()
    const gen = runBlueprintFlow('command', blueprintData.graphs, 'CommandEntry', {
      cmd,
      ctx,
      state,
      setState,
      outputs
    })
    if (gen) {
      let res = gen.next()
      while (!res.done) {
        yield res.value
        res = gen.next()
      }
    }
    return true
  })
  .defineView((ctx, state, setState) => {
    // 최초 뷰 마운트(초기화) 시 1회 구동
    ;(() => {
      const genMount = runBlueprintFlow('view', blueprintData.graphs, 'ViewMountEntry', {
        ctx,
        state,
        setState,
        outputs: new Map<string, any>()
      })
      if (genMount) {
        let res = genMount.next()
        while (!res.done) {
          res = genMount.next()
        }
      }
    })()

    const runUpdate = (uCtx?: any, uState?: any, uSetState?: any) => {
      const gen = runBlueprintFlow('view', blueprintData.graphs, 'OnUpdateEntry', {
        ctx: uCtx ?? ctx,
        state: uState ?? state,
        setState: uSetState ?? setState,
        outputs: new Map<string, any>()
      })
      if (gen) {
        let res = gen.next()
        while (!res.done) {
          res = gen.next()
        }
      }
    }

    const runCleanup = (uCtx?: any, uState?: any, uSetState?: any) => {
      const gen = runBlueprintFlow('view', blueprintData.graphs, 'OnCleanupEntry', {
        ctx: uCtx ?? ctx,
        state: uState ?? state,
        setState: uSetState ?? setState,
        outputs: new Map<string, any>()
      })
      if (gen) {
        let res = gen.next()
        while (!res.done) {
          res = gen.next()
        }
      }
    }

    const runShow = (uCtx?: any, uState?: any, uSetState?: any) => {
      const gen = runBlueprintFlow('view', blueprintData.graphs, 'ShowEntry', {
        ctx: uCtx ?? ctx,
        state: uState ?? state,
        setState: uSetState ?? setState,
        outputs: new Map<string, any>()
      })
      if (gen) {
        let res = gen.next()
        while (!res.done) {
          res = gen.next()
        }
      }
    }

    const runHide = (uCtx?: any, uState?: any, uSetState?: any) => {
      const gen = runBlueprintFlow('view', blueprintData.graphs, 'HideEntry', {
        ctx: uCtx ?? ctx,
        state: uState ?? state,
        setState: uSetState ?? setState,
        outputs: new Map<string, any>()
      })
      if (gen) {
        let res = gen.next()
        while (!res.done) {
          res = gen.next()
        }
      }
    }

    return {
      show: runShow,
      hide: runHide,
      onUpdate: runUpdate,
      onCleanup: runCleanup
    }
  })
`
}
