# V5 구성 편집 구조와 작업 기록

V4 선택 표현 revision02와 기존 맵·카메라·개별 요소 편집을 보존한 별도 프로젝트입니다. 원본 파일과 V2/V3/V4 슬롯은 수정하지 않습니다.

- `visual-profile.js`: 치수/프리셋과 미술 프로필을 분리. 신규 구성은 V4 카툰을 명시적으로 유지.
- `region-geometry.js`: canonical MultiPolygon boolean, 구멍·여러 섬·면적·경계/footprint 검사·브러시 선 보간.
- `composition-state.js`: 빈 땅, 바닥 단일 소유, 패치 변경/이동/복제/합치기, 면적, 치수, 고정 구조/영역 검증. `derive`가 검증할 사용자 치수와 구성에서 렌더/배치 배열을 파생.
- `patch-editor.js`: 임시 문서, 획 단위 undo/redo, 포인터 소유, 미완료 획 취소, 실제 SVG 프리뷰. 적용 시 `main.js`에서 config/items/pending을 하나의 이력으로 확정.
- `building-geometry.js` / `building-editor.js`: 사각·ㄱ·ㄷ 기하, 벽 세그먼트 기반 출입문, 외곽/장애물 검증, 통로 안내.
- `composition-terrain.js`: 변경된 면/건물만 캐시 갱신. 포장 패턴은 같은 실제 면에서 세계 미터 좌표 shader로 표현하고 구멍/경계 밖에는 그리지 않음.
- `composition-templates.js`: 실제 다른 건물·바닥·높은 플랜터로 구성한 10개 출발점. 식물은 명시적 예시 옵션에서만 배치.
- `plant-catalog.js` / `catalog-ui.js`: 형태/시각적 검색과 모델 연결 ID. 실제 품종/생육 정보와 분리. 미검증 필드는 null/미확인.
- `persistence.js`: V5 별도 버전/키, 수동 슬롯과 확정 작업 복구 슬롯 분리. `persistence-v4.js`는 V2/3/4 디코더를 보존. 잘못된 저장은 현재 문서를 바꾸지 않음.
- `zone-editor.js` / `zone-state.js` / `zone-geometry.js`: 기존 V4 제어점 편집 보존. 새 패치 기하를 고급 제어점으로 임의 변환하지 않음.

실제 화면은 `evidence/`와 `review.html`, 검증 범위/미완료 항목은 `VALIDATION.md`, 실측 원본은 `evidence/performance-v5.json`을 확인하세요. 다음 우선 작업은 분리된 섬의 개별 선택 ID, 실물 모바일 GPU 검수, 영역과 식물 동반 이동입니다. 미술 모델 재설계는 이번 V5 범위가 아닙니다.
