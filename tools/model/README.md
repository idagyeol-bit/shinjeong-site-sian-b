# 로봇 3D 모형 만들기 (시안 B, `assets/models/robot5.glb`)

`assets/models/robot5.glb` 는 생성 결과다. 손으로 고치지 말고 여기 있는 두 스크립트로 다시 만든다.

## 원본
`C:\Users\user\Downloads\Meshy_AI_suction_crawler_robot_1013220839_image-to-3d-texture.glb` (이다결 님이 Meshy 에서 만든 주황 흡입 로봇, 85.6MB · 삼각형 214만 개). 저장소에 넣지 않고, 고치지도 지우지도 않는다.

## 방식 (11차 다듬기 2)
1. `remake.mjs` — 원본을 위치·질감 좌표로 묶고 삼각형을 줄인 뒤(meshoptimizer), 줄인 모형의 질감 칸마다 원본 표면의 가장 가까운 점을 찾아
   색·금속거칠기·면 방향을 **물체 기준 노멀 맵**으로 옮겨 굽는다. 그래서 삼각형이 적어도 판이 구겨지거나 요철이 울렁이지 않는다.
   결과 모형에는 정점 노멀이 없고 재질 `extras.normalMapSpace = "object"` 가 붙는다 → `js/robot5-viewer.js` 가 이것을 보고 `ObjectSpaceNormalMap` + `flatShading` 을 켠다.
2. `encode.mjs` — 1 에서 저장한 굽기 결과(캐시)로 질감 해상도·JPEG 품질만 바꿔 GLB 를 다시 쓴다(빠름).
   보통 GLB(압축 확장 없음): 점 65,535개 이하 조각으로 나눠 2바이트 번호, 질감 좌표 2바이트 정규화.

## 준비
- Node.js 24 (휴대용: `%LOCALAPPDATA%\Programs\nodejs-portable\node-v24.22.0-win-x64\node.exe`)
- 빈 작업 폴더에서 `npm i @gltf-transform/core@4 meshoptimizer sharp` 한 뒤 그 폴더에서 실행한다(저장소 안에 node_modules 를 만들지 않는다).

## 지금 모형을 만든 명령 (삼각형 15만 개 · 7.88MB)
```
node --max-old-space-size=12000 remake.mjs <원본.glb> out.glb 150000 4096 2048 2048 1024 1     # CACHE=<캐시경로> 환경변수를 주면 굽기 결과를 저장
MOZ=1 node encode.mjs <캐시경로> robot5.glb 2048 96 2048 90 1024 90                              # 노멀 2048/q96, 색 2048/q90, mr 1024/q90, mozjpeg
```
인자: `<목표 삼각형 수> <굽기 해상도> <노멀 출력> <색 출력> <mr 출력> <uv 가중>`. 결과가 8MB 를 넘으면 품질(q)이나 삼각형 수를 낮춘다(11차 지시서: 8MB 이하, draco·meshopt·ktx2 금지).
