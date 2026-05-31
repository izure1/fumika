# Shortcut API 가이드

`shortcut` API는 씬(scene) 작성 시 자주 사용되는 커맨드 모듈들을 더욱 간결하고 타입-세이프(Type-safe)하게 사용할 수 있도록 돕는 유틸리티입니다.

## 특징

- **자동 타입 추론**: `config`에 등록된 커맨드 속성들을 바탕으로, 매개변수와 반환 타입이 완벽하게 추론됩니다.
- **제네릭 및 명시적 타입 선언 제거**: 숏컷 작성 시 수동으로 타입을 지정할 필요가 없습니다.
- **튜플 매핑 방식 적용**: 사용할 매개변수의 키를 배열(튜플) 형태로 전달하면, 콜백 함수의 인자로 해당 속성들의 타입이 순서대로 자동 주입됩니다.

## 기본 사용법

`shortcut` 함수는 `config` 객체를 인자로 받아 숏컷 생성 팩토리 함수를 반환합니다. 팩토리 함수는 두 가지 시그니처를 지원합니다.

### 1. 인자가 없는 숏컷 (2개 인자 오버로드)

명령을 실행하기 위해 별도의 인자가 필요 없는 경우 사용합니다.

```typescript
import { shortcut } from '@fumika/core/define'
import { config } from './config' // 모듈 설정 객체

const s = shortcut(config)

export const clear = s('dialogue', () => {
  return {}
})
```

### 2. 인자가 있는 숏컷 (3개 인자 오버로드)

명령 실행에 필요한 인자가 있을 때, 두 번째 인자로 **필요한 속성들의 키 목록을 배열로 전달**합니다.

```typescript
import { shortcut } from '@fumika/core/define'
import { config } from './config'

const s = shortcut(config)

// 'dialogue' 모듈에서 'text'와 'speaker' 속성을 인자로 받는 숏컷
export const d = s('dialogue', ['text', 'speaker'], (text, speaker) => {
  return { text, speaker }
})

// 'character' 모듈에서 'name', 'image', 'duration'을 인자로 받는 숏컷
// duration은 선택적 매개변수로 처리됩니다.
export const characterShow = s('character', ['name', 'image', 'duration'], (name, image, duration) => {
  return { name, image, duration }
})
```

## 타입 추론의 원리

1. **대상 모듈 선택**: 첫 번째 인자인 `'dialogue'` 등의 타입 문자열을 통해 `config`에 등록된 모듈 목록 중 해당하는 타입을 찾습니다.
2. **속성 추출**: 두 번째 인자인 `['text', 'speaker']` 튜플을 읽고, 대상 모듈의 명령어 타입(예: `DialogueCmd`)에서 `text`와 `speaker` 속성의 타입을 추출합니다.
3. **콜백 인자 매핑**: 추출된 타입들이 세 번째 인자인 콜백 함수의 매개변수(`(text, speaker)`)로 자동 매핑됩니다. 콜백 내에서 `text`와 `speaker`는 완벽한 타입을 가지게 됩니다.
4. **결과 병합**: 콜백이 반환하는 객체에 `{ type: 'dialogue' }`가 자동으로 병합되어 최종 씬 스크립트 스키마(`DialogueStep` 등)를 만족시킵니다.

## 주의사항

- 반환되는 객체는 대상 커맨드의 타입(`TargetCmdOf`)을 만족해야 합니다. 만약 선택적 매개변수가 있다면, `undefined`가 될 수 있음을 고려하여 설계되었습니다.
- 첫 번째 인자로 전달하는 `type` 문자열은 반드시 `config`에 등록된 유효한 모듈이어야 자동 완성이 동작합니다.
