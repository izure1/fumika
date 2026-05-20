# Fumika IDE

`leviar` 비주얼 노벨 엔진을 위한 전용 통합 개발 환경(IDE)입니다.  
시각적인 씬 에디터와 실시간 렌더링 기능을 제공하여 개발 생산성을 높입니다.

![Fumika IDE Main Welcome](./docs/assets/preview_welcome.png)

## 한눈에 보는 씬의 흐름

코드가 길어지고 조건 분기가 복잡해질수록 전체 씬의 연결 구조를 파악하기 어려워집니다.  
Fumika IDE는 코드의 구조를 시각화하여 이 문제를 해결합니다.

![Scene Graph Viewer](./docs/assets/preview_scene-graph-viewer.webp)

코드의 AST(추상 구문 트리)를 분석하여 복잡한 `if-else` 분기와 씬의 이동 경로를 다이어그램으로 표시합니다.  
그래프 노드를 더블클릭하면 에디터의 해당 소스 코드 위치로 즉각 이동하여 빠르게 수정할 수 있습니다.

## 실시간 렌더링과 통합 에디터

![Editor and Preview Split](./docs/assets/preview_editor.png)

수정 사항을 확인하기 위해 새로고침을 반복할 필요가 없습니다.  
좌측의 Monaco 에디터에서 코드를 작성하면, 우측 프리뷰 영역에 즉시 렌더링됩니다.

TypeScript 자동 완성 기능을 활용하여 실시간으로 게임을 확인하며 개발해 보세요.

## GUI를 사용하는 직관적인 편집 기능

<p align="center">
  <img src="./docs/assets/preview_character-editor.png" width="49%" alt="Character Form Editor">
  <img src="./docs/assets/preview_effect-editor.png" width="49%" alt="Effect Form Editor">
</p>

코드를 직접 수정하며 발생할 수 있는 오타나 문법 에러를 원천 차단하세요.  
복잡한 수치 조절도 화면 우측의 프리뷰를 통해 즉각적으로 변화를 확인할 수 있습니다.

캐릭터의 기본 외형(Bases)과 다양한 표정(Emotions) 설정부터, 씬의 분위기를 좌우하는 파티클 효과(크기, 속도, 밀도 등)까지 모두 직관적인 GUI 폼 에디터로 안전하게 관리할 수 있습니다.

## 스마트한 프로젝트 관리

![Smart Project Sidebar](./docs/assets/preview_sidebar.png)

사이드바를 통해 프로젝트의 파일과 폴더를 직관적으로 관리할 수 있습니다.  
누락된 핵심 파일을 원상 복구하는 기능을 내장하고 있으며, 편집 중인 스크립트 파일의 문법을 실시간으로 검사하여 에러가 있는 경우 붉은색 물결로 표시합니다.

## 블루프린트 비주얼 스크립팅

![Blueprint Visual Scripting](./docs/assets/preview_blueprint.png)

Fumika IDE는 코드를 전혀 작성하지 않고도 시각적인 노드 연결을 통해 복잡한 연출 흐름과 시각 요소를 제어할 수 있는 블루프린트 스크립팅 시스템을 지원합니다.  
기획과 연출에 온전히 집중할 수 있도록 아래 상세 문서를 제공하고 있으니 적극 활용해 보세요.  

- [블루프린트 가이드 (blueprint-guide.md)](./docs/blueprint-guide.md): 초심자를 위한 기본 노드 조립 및 조건 분기 흐름 학습 문서입니다.  
- [블루프린트 레퍼런스 (blueprint-reference.md)](./docs/blueprint-reference.md): 고급 개발자를 위한 세부 핀 데이터 타입 및 컴파일러 API 명세서입니다.  

## 시작하기

루트 디렉토리에서 패키지를 설치하고 IDE를 실행하여 프로젝트를 열어 보세요.

```bash
npm install
npm run dev:ide
```

> [!WARNING]
> 누락된 파일 복구(Restore) 기능을 실행하면 필수 `declarations` 에셋 파일들을 다시 생성합니다. 사용자가 직접 수정한 기본 파일들이 덮어씌워질 수 있으므로 사용에 주의하세요.

## 라이선스

상업적 이용 및 배포와 관련된 정책은 아래 링크를 참고해 주세요.

- [Fumika 라이선스 (LICENSE)](./LICENSE)
