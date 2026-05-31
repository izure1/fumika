# 🌌 Fumika

> [!WARNING]
> 본 프로젝트는 현재 **알파(Alpha) 버전**으로 개발 중입니다.  
> 핵심 아키텍처 및 API 명세가 예고 없이 변경될 수 있으며, 예기치 않은 버그가 존재할 수 있습니다. 상용 서비스 적용 시 각별한 주의를 요합니다.

**Fumika**는 웹 환경에 최적화된 고성능 모듈형 비주얼 노벨 엔진입니다.  
강력한 렌더링 성능과 유연한 확장성을 바탕으로, 개발자의 상상력을 정교하게 구현할 수 있는 최적의 환경을 제공합니다.  

## 💡 엔진의 핵심 가치 (Core Philosophy)

기존 웹 기반 노벨 엔진들이 지닌 기술적 한계를 극복하기 위해, `fumika`는 다음과 같은 설계적 결단을 내렸습니다.  
**Canvas 기반의 고성능 전 전용 렌더러**와 **체계적인 상태 관리 시스템(MVC)**을 결합하여, 웹 환경에서도 네이티브 게임에 버금가는 입체적인 연출을 정교하고 직관적인 코드로 구현하실 수 있도록 정성껏 설계되었습니다.  

[➡️ 실제 구동되는 데모를 확인해 보시기 바랍니다.](https://izure1.github.io/fumika/)

---

## ✨ 주요 기능 및 차별점

| 기능 범주 | 기술적 이점 | 개발자에게 제공하는 가치 |
| :--- | :--- | :--- |
| **모듈형 MVC** | 기능 단위의 독립적 캡슐화 | 높은 유지보수성 및 무한한 기능 확장성 확보 |
| **선언적 DSL** | 객체 배열 기반의 시나리오 기술 | 직관적이고 가독성 높은 시나리오 작성 환경 |
| **타입 안전성** | TypeScript 기반의 엄격한 검증 | 개발 시점의 오류 방지 및 생산성 극대화 |
| **핵심 시스템 내장** | 직렬화 가능한 상태 관리 시스템 | 세이브/로드 등 필수 기능을 즉시 구현 가능 |

---

## 🏗️ 프로젝트 아키텍처 (Structure)

| 구성 요소 | 주요 역할 | 비고 |
| :--- | :--- | :--- |
| **`src/core/`** | 엔진 코어 로직 | Novel, Renderer, Context 시스템을 관장합니다. |
| **`src/modules/`** | 내장 기능 모듈 | 대사, 캐릭터, 카메라 등 다양한 연출 기능을 담당합니다. |
| **`docs/`** | 상세 기술 가이드 | 엔진 활용을 위한 심층적인 명세를 포함합니다. |

---

## 📖 문서 및 가이드라인 (Documentation)

엔진의 설계 철학과 세부 기능을 체계적으로 학습하실 수 있도록 다음과 같은 가이드를 제공합니다.  

*   **[📚 Documentation Portal (전체 가이드)](./docs/README.md)**: 모든 기술적 궁금증을 해결하실 수 있는 통합 인덱스입니다.  
*   **[🚀 활용 가이드 (Step-by-Step Tutorial)](./docs/tutorial.md)**: 환경 구축부터 프로젝트 완성까지의 전 과정을 정중하게 안내합니다.  

| 상세 기술 문서 | 주요 내용 요약 |
| :--- | :--- |
| **[⚙️ 중앙 설정 가이드](./docs/config.md)** | `novel.config.ts`를 통한 프로젝트 최적화 방법을 다룹니다. |
| **[💡 엔진 아키텍처 개요](./docs/concepts.md#overview)** | MVC, Resolvable 등 핵심 설계 원리를 기술합니다. |
| **[🎬 장면 및 상태 제어](./docs/concepts.md#scenes)** | 씬 구성과 영속성 있는 상태 관리 전략을 다룹니다. |
| **[📜 명령어 레퍼런스](./docs/commands.md)** | 시나리오 작성을 위한 모든 명령어의 상세 명세입니다. |
| **[⚓ 시스템 확장 가이드](./docs/concepts.md#hooks)** | 파이프라인 훅을 통한 기능 확장 방법을 안내합니다. |
| **[🎯 숏컷 가이드](./docs/shortcut.md)** | 씬(scene) 작성 시 커맨드를 간결하고 타입-세이프하게 작성하는 방법을 안내합니다. |

---

## 🚀 빠른 시작 (Quick Start)
> 더욱 상세한 단계별 안내가 필요하신 경우 **[입문 가이드](./docs/quick-start.md)**를 참조해 주십시오.  

### 1. 패키지 설치
```bash
npm install fumika
```

### 2. 최소 구동 예제 구현
```typescript
import { defineNovelConfig, defineScene, defineCharacter, Novel } from 'fumika'

const character = defineCharacter({
  name: '후미카',
  bases: {
    default: {
      src: 'character_fumika_base',
      width: 400,
      points: {
        // 각 이미지에 대한 표시 위치
        face: { x: 0.5, y: 0.2 }
      }
    }
  },
  emotions: {
    smile: {
      // 각 이미지의 표정 상태에 대한 표시 위치
      face: 'emotion_fumika_base_smile'
    }
  }
})


const config = defineNovelConfig({
  width: 1280,
  height: 720,
  scenes: ['scene-intro'],
  assets: {
    'character_fumika_base': './assets/fumika_base.png',
    'emotion_fumika_base_smile': './assets/emotion_fumika_base_smile.png',
  },
  characters: {
    'fumika': character,
  }
})

const sceneIntro = defineScene({ config })(() => [
  // 캐릭터의 bases와 emotions를 조합하여 보여주기 위해, bases:emotions 형식으로 지정합니다.
  // 예를 들어, fumika가 default + smile 상태의 모습을 보여주려면 image: 'default:smile'로 지정합니다.
  {
    type: 'character',
    action: 'show',
    name: 'fumika',
    image: 'default:smile',
  },

  // defineCharacter에서 선언된 points 위치로 카메라를 1초에 걸쳐 이동시킵니다. 
  {
    type: 'character-focus',
    name: 'fumika',
    point: 'face',
    zoom: 'close-up',
    duration: 1000,
  },

  // 대사창에 이름과 대사를 출력합니다
  {
    type: 'dialogue',
    speaker: 'fumika',
    text: '안녕하세요! 저는 후미카입니다.',
  }
])

const init = async () => {
  // 엔진 인스턴스를 생성하고 대상 DOM 요소에 마운트합니다.  
  const novel = new Novel(config, {
    element: document.getElementById('game-container') as HTMLElement,
    scenes: { 'scene-intro': sceneIntro },
  })

  // 에셋 로드 및 시스템 부팅 후 시나리오를 시작합니다.  
  await novel.load() // 리소스 프리로딩
  await novel.boot() // 시스템 초기화
  novel.start('scene-intro') // 장면 개시
};

init().catch(console.error);
```
