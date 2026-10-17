# OWOL Garden V6 · 재질과 식물 형태 기준판

V5를 보존한 별도 V6 브랜치입니다. 웹 서비스 배포를 포함하지 않습니다.

## 파일

- [실행 ZIP](OWOL-garden-v6-run.zip?raw=true)
- [전체 소스 ZIP](OWOL-garden-v6-source.zip?raw=true)
- [실제 전후 화면 검토 HTML](OWOL-garden-v6-review.html?raw=true)
- [신규 자산 12개 연락판](OWOL-garden-v6-plant-contact-sheet.png)
- [V5 재질 화면](OWOL-materials-before-V5.png) / [V6 재질 화면](OWOL-materials-after-V6.png)
- [검증·제한](owol-garden-v6/VALIDATION.md) / [출처·라이선스](owol-garden-v6/ASSETS.md)
- [파일 SHA256](OWOL-garden-v6-SHA256SUMS.txt) / [매니페스트](OWOL-garden-v6-manifest.json)

실행 ZIP을 완전히 푼 뒤 Node.js 24 환경에서 `node serve.mjs`를 실행하고 표시된 로컬 주소를 엽니다. 소스 빌드와 검사 방법은 [소스 README](owol-garden-v6/README.md)에 있습니다.

**신규 자산 12개, 형태 12개, 각 3개의 구조 변형(총 36개 구조 변형)입니다. 36종 완성본이 아닙니다.** 기존 7개를 포함한 전체 카탈로그는 19개이며 현재 V4 미술 프로필에서 배치 가능한 것은 16개입니다. 품종 재현·사진 대조 검수와 추가 24개 자산은 미완료입니다.

클라우드 소프트웨어 렌더 시험에서 50/150/300개 장면은 약 6/3.3/2.1fps로 30fps 목표에 미달했습니다. 실제 휴대폰 성능은 검증하지 않았습니다. 자세한 조건과 한계는 검증 문서를 확인하세요.

기준 V5: `codex/owol-v5-composition-20261016` / `dab07e18f0e542306b09fa28cc99a2998d7e230e`. V5 폴더와 ZIP은 그대로 남아 있습니다.
