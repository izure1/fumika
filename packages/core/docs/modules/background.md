# 🖼️ 배경 (Background)

## 개요 (Overview)

`background` 모듈은 게임의 배경 화면(이미지, 비디오)을 출력하고 전환하는 역할을 합니다.  
단순한 배경 출력뿐만 아니라 카메라 이동 시의 원근감(패럴랙스) 적용, MP4 비디오 배경 렌더링 등을 지원합니다.  

## 사전 준비 (Prerequisites)

`novel.config.ts` 파일의 `assets`와 `backgrounds` 항목에 사용할 배경 정보가 미리 등록되어 있어야 합니다.  

## 핵심 예제 (Main Example)

### 1. 설정 등록 (`novel.config.ts`)

```typescript
import { defineNovelConfig } from 'fumika'

export default defineNovelConfig({
  assets: {
    'img-classroom': 'assets/bg/classroom.jpg',
    'vid-opening': 'assets/video/opening.mp4'
  },
  // 사용할 배경의 고유 이름을 부여하고 옵션을 설정합니다
  backgrounds: {
    // parallax: 카메라 이동 시 배경을 느리게 움직여 원근감을 줍니다
    'classroom': { src: 'img-classroom', parallax: true },
    'opening': { src: 'vid-opening' }
  }
})
```

### 2. 시나리오 연출 (`scene.ts`)

```typescript
import { defineScene } from 'fumika'
import config from './novel.config'

export default defineScene({ config })(() => [
  // 1. 기본 배경 전환 (1초 동안 부드럽게 페이드인 전환)
  { type: 'background', name: 'classroom', duration: 1000 },

  { type: 'dialogue', text: '여기는 교실입니다.' },

  // 2. 비디오 영상을 배경으로 화면 꽉 차게 출력 (기본적으로 자동 재생됨)
  { type: 'background', name: 'opening', isVideo: true, fit: 'cover' },

  // 3. 비디오 배경이지만 자동 재생하지 않고 수동 제어용으로 로드할 때
  { type: 'background', name: 'opening', isVideo: true, autoplay: false }
])
```

## 옵션 상세

시나리오 코드의 배경 객체에 넣을 수 있는 속성들입니다.  

| 속성 | 타입 | 기본값 | 설명 |
| :--- | :--- | :---: | :--- |
| **`type`** | `'background'` | 필수 | 배경 전환 명령어 타입 |
| **`name`** | `string` | 필수 | `config.backgrounds`에 등록한 배경의 고유 이름 |
| **`fit`** | `string` | `'cover'` | 화면 맞춤 방식 (`cover`: 꽉 차게, `contain`: 비율 유지하며 꽉 차게) |
| **`duration`** | `number` | `1000` | 다른 배경에서 전환 시 페이드 효과에 걸리는 시간(ms) |
| **`ease`** | `string` | `'easeInOutQuad'` | 애니메이션의 [이징 함수 목록](../easing.md) 이름 |
| **`isVideo`** | `boolean` | `false` | 대상 에셋이 비디오 파일(.mp4 등)인 경우 `true`로 명시 |
| **`autoplay`** | `boolean` | `true` | `isVideo`가 `true`일 경우, 표시됨과 동시에 비디오를 자동 재생할지 여부 |

## 주의 사항 (Edge Cases)

| 상황 | 원인 및 해결 방법 |
| :--- | :--- |
| **원근감(패럴랙스) 미적용** | `camera-pan` 등을 쓸 때 배경이 입체적으로 움직이지 않는다면, `config.backgrounds`의 옵션에서 `parallax: true`가 누락되지 않았는지 확인하세요. |
| **비디오 배경 재생 불가** | 브라우저 보안 정책상 소리가 포함된 비디오는 사용자가 화면을 한 번 터치하기 전에는 재생이 차단됩니다. 배경용 비디오는 가급적 음소거 처리된 파일을 사용하시는 것이 좋습니다. |
