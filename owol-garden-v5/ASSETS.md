# 출처와 이용 조건

외부 미술 에셋, 사진, 스캔 PBR, HDRI, Nintendo 자산, Abeto 메시·텍스처·캐릭터·로고는 포함하지 않았습니다. 유료 에셋 구매나 가입은 없으며, 정원 앱의 외부 서비스 배포도 하지 않았습니다. 실행/소스 파일 전달과 웹 서비스 배포는 별개입니다.

| 사용 항목 | 출처 / 조건 | 실제 적용 |
|---|---|---|
| Three.js 0.186.1 | https://github.com/mrdoob/three.js/tree/r186 · MIT | MeshToonMaterial, DataTexture, InstancedMesh, OrbitControls 등 설치된 동일 버전 사용 |
| 공식 toon 예제 | https://github.com/mrdoob/three.js/blob/r186/examples/webgl_materials_toon.html · MIT | gradientMap 구성과 재질 경로 참고 |
| 공식 OutlineEffect | https://github.com/mrdoob/three.js/blob/r186/examples/jsm/effects/OutlineEffect.js · MIT | inverted hull 원리 참고. 인스턴싱·CSS 픽셀 선폭에 맞춘 OWOL shader 작성. addon을 그대로 적용했다고 표시하지 않음 |
| 공식 MeshToonMaterial 소스 | https://github.com/mrdoob/three.js/blob/r186/src/materials/MeshToonMaterial.js · MIT | 설치된 배포본 클래스 사용 |
| 식물·벤치·재료 | 이 프로젝트에서 직접 작성한 절차적 geometry / Canvas 패턴 | 미술 검토 범위 4종. 검증된 품종·생육 정보 없음 |
| 나머지 맵/모델 | 보존한 OWOL V3 프로젝트 작성 모델 | 이번 카툰 미술 범위 밖, 기존 표현 유지 |

`reference/`에는 이 작업에서 실제로 받은 r186 공식 예제·addon·재질 소스와 MIT LICENSE가 있습니다. `reference/source-fetch.json`은 다운로드 결과입니다. 설치 패키지의 정확한 버전은 lockfile과 `THIRD-PARTY-NOTICES.txt`를 확인하세요. `dev` 브랜치 코드를 런타임에 섞지 않았습니다.

Abeto Messenger, Communication Arts 인터뷰, threejs.org 문서 URL은 이 실행 환경에서 proxy 403으로 접근할 수 없었습니다. GitHub r186 공식 코드 URL은 200으로 읽었습니다. Abeto의 실제 인터랙션을 여기서 관찰하거나 자산 재사용 권한을 확인했다고 주장하지 않습니다. 사용자가 첨부한 설명의 조형·색면·편안함을 미술 방향으로 삼았습니다.

윤곽선은 녹색 계열로 0.65–0.95 CSS px를 사용하고, 수관 내부 126개 잎, 관목 내부 50개 잎, 그라스의 가는 잎과 작은 꽃 잎에는 넣지 않습니다. 벽·바닥 일부는 0.65–1 CSS px입니다. NoToneMapping과 sRGB 출력, 4단계 선형 광량 ramp(55 / 120 / 185 / 245)를 사용합니다. 사용자가 선택한 이전 표현의 그림자 강도 0.62를 복원했으며, 식물의 입체감은 실제 geometry와 조명으로 표현합니다. 반투명 잎판·금속성 잎·노멀 노이즈·블룸·안개·배경 흐림은 사용하지 않았습니다.

추가 라이브러리의 전체 라이선스 고지는 `THIRD-PARTY-NOTICES.txt`에 보존돼 있습니다. 이 문서는 Abeto 전체 소스나 자산을 공개 라이선스로 간주하지 않습니다.

## V5 추가 코드

V5에서는 새 외부 모델·텍스처·글꼴·이미지 자산을 받지 않았습니다. 기존 V4 식물과 팔레트 파일은 바이트 단위로 보존했습니다. 건물/플랜터의 단순 geometry, 면 포장의 world-meter 패턴 shader, SVG 구성 썸네일과 브러시 표시를 프로젝트 코드로 작성했습니다. 패치 Boolean은 기존 의존성 polygon-clipping 0.15.7(MIT)을 재사용합니다. 전체 전이 의존성 고지는 `THIRD-PARTY-NOTICES.txt`에 포함합니다.

참고 정원 사진과 Abeto 화면은 사용 허가된 에셋으로 간주하지 않으며 앱/비교 화면에 삽입하지 않았습니다. `evidence/`와 `review.html`의 정원 이미지는 이 프로젝트의 실제 WebGL 화면 캡처입니다. 생물학적 정확성이 검증된 품종 데이터나 생육 시뮬레이션을 제공하지 않습니다.
