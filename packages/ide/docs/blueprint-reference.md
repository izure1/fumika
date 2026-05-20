# Leviar 블루프린트 레퍼런스

블루프린트 비주얼 스크립팅 시스템의 핵심 데이터 모델 구조와 노드 명세, 그리고 컴파일러 명세서입니다.  

---

## 타입 시그니처

블루프린트 데이터 모델과 노드를 정의하는 TypeScript 인터페이스 구조입니다.  

```ts
export type PinDataType =
  | 'exec'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'array'
  | 'style'
  | 'attribute'
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

export interface BlueprintNodeDef {
  type: string
  label: string
  category: NodeCategory
  description: string
  pins: PinDef[]
  allowedTabs?: GraphTab[]
  singleton?: boolean
}

export interface ModuleDefinitions {
  moduleName: string
  schemaDef: PropertyDef[]
  commandDef: PropertyDef[]
  hookDef: HookSignatureDef[]
}
```

---

## 세부 설명

블루프린트는 노드 간의 제어 흐름과 데이터 전달을 바탕으로 동작을 정의합니다.  
각 노드는 특정 역할을 갖는 핀(Pin)들의 집합으로 구성되어 있습니다.  

### 핀(Pin) 데이터 타입 분류
데이터 흐름을 조율하기 위해 다양한 색상과 용도를 지닌 데이터 타입 핀들이 제공됩니다.  
당신은 각 타입에 일치하는 연결선만 연결할 수 있으므로 주의해 보세요.  

- `exec`: 실행 흐름 제어선 (화이트 색상)  
- `number`: 숫자 연산 데이터 값 (에메랄드 색상)  
- `string`: 텍스트 문자열 데이터 값 (블루 색상)  
- `boolean`: 참/거짓 판단 조건값 (레드 색상)  
- `leviarObj`: 씬에 생성된 실제 오브젝트 인스턴스 참조값 (오렌지 색상)  

---

## 파라미터 명세

블루프린트 노드를 구성하는 핀 속성(`PinDef`)의 상세 설정 정보입니다.  

| 파라미터 이름 | 데이터 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 필수값 | 노드 내에서 고유하게 구별되는 핀의 고유 식별자입니다. |
| `label` | `string` | `""` | 에디터 화면 노드 겉면에 렌더링되어 보여질 라벨 텍스트입니다. |
| `direction` | `"input"` \| `"output"` | 필수값 | 핀의 입출력 방향성으로, 데이터의 흐름 방향을 결정합니다. |
| `pinType` | `"exec"` \| `"data"` | `"data"` | 흐름 제어용 실행 핀인지, 값 전달용 데이터 핀인지 설정합니다. |
| `dataType` | `PinDataType` | `undefined` | `pinType`이 `"data"`일 때 노드 간에 송수신할 세부 데이터 규격입니다. |

---

## 반환값

블루프린트 파일(`.fbp.json`)은 컴파일러(`compileBlueprint`)를 거쳐 실행 가능한 단일 TypeScript 소스코드로 변환되어 반환됩니다.  

- **반환 형태**: `string` (독립적으로 빌드할 수 있는 `.ts` 파일 내용 소스코드)  
- **포함 사항**: `define<MyCmd, MySchema, MyHook>` 모듈 초기화 구조, 제너레이터 함수(`function*`) 기반 흐름 해석 루프, 뷰 생명주기 이벤트 래퍼, 인라인 런타임 해석기(`runBlueprintFlow`) 유틸리티 코드 전체.  

> [!NOTE]
> 컴파일러 결과물에는 런타임 시에 그래프의 각 노드 의존성을 역방향으로 재귀 연산하는 `evaluatePin` 구조가 포함됩니다.  
> 이를 통해 실행선이 도달했을 때 실시간으로 정확한 변수값 계산이 가능해지죠.  

---

## 예시 코드

다음은 컴파일러 인터페이스를 사용해 `.fbp.json` 문자열 데이터를 컴파일하고 가상 환경에서 모듈을 해석하는 즉시 실행 가능한 예시 코드입니다.  

```ts
import { compileBlueprint } from '@/main/services/compiler'

// 1. 컴파일 대상이 될 가상의 블루프린트 JSON 데이터 정의
const mockBlueprintJson = JSON.stringify({
  definitions: {
    moduleName: 'ScoreManager',
    schemaDef: [{ name: 'currentScore', type: 'number' }],
    commandDef: [{ name: 'addScore', type: 'number' }],
    hookDef: []
  },
  graphs: {
    command: {
      nodes: [
        { id: 'start', data: { nodeType: 'CommandEntry' } },
        { id: 'setState', data: { nodeType: 'SetState', fields: ['currentScore'] } },
        { id: 'ret', data: { nodeType: 'Return' } }
      ],
      edges: [
        { source: 'start', sourceHandle: 'start__exec-out', target: 'setState', targetHandle: 'setState__exec-in' },
        { source: 'setState', sourceHandle: 'setState__exec-out', target: 'ret', targetHandle: 'ret__exec-in' }
      ]
    }
  }
})

// 2. 컴파일러 실행을 통해 독립된 TypeScript 코드 문자열 획득
const compiledTypeScriptCode = compileBlueprint(mockBlueprintJson)

// 3. 빌드된 코드 결과 출력 확인
console.log('--- 컴파일 완료 ---')
console.log(compiledTypeScriptCode.substring(0, 300))
```

> [!WARNING]
> 컴파일러는 유효하지 않은 JSON 구조를 받았을 때 원인 분석 메시지를 담아 즉시 런타임 에러를 던집니다.  
> 따라서 예외 처리를 위해 `try-catch` 구문으로 감싸서 호출하는 방식을 권장합니다.  

---

## 관련 항목 링크

블루프린트의 기능적 목적과 흐름에 따른 구체적인 실무 활용 시나리오를 읽어보고 싶다면 아래 가이드를 탐색해 보세요.  

- [블루프린트 가이드](file:///d:/My_WorkSpace/Programming/Project/fumika/packages/ide/docs/blueprint-guide.md)로 이동하기  
