/* 신정개발 홈페이지 — 장비·로봇 "자체 개발 무인 로봇" 구역의 로봇 3D 예시 모형 뷰어 (시안 B, 설정 look.robotViewer, 시안B 11차)
   - three.js r160 은 저장소 안 js/vendor/three/ 의 파일만 쓴다(외부 주소 0). 모형은 압축 확장 없는 보통 GLB 라 기본 GLTFLoader 만 쓴다.
   - 처음에는 사이트의 로봇 실사(대체 사진)가 보이고, 구역이 화면 가까이 오면 모형을 불러와 다 그려진 뒤에만 3D 로 바꾼다.
     WebGL 이 안 되거나 불러오기에 실패하면 대체 사진과 안내 줄이 그대로 남는다(빈 상자 없음).
   - 끌어서 회전(마우스: 상하좌우 / 휴대폰: 가로 끌기는 회전, 세로 쓸기는 페이지 스크롤), 가만히 두면 천천히 자동 회전, 멈춤·재생 단추.
     휠 확대·축소는 끈다(페이지 스크롤 방해) — 확대·축소는 +/− 단추로만.
   - 움직임 줄이기(prefers-reduced-motion)면 자동 회전 없이 멈춘 채 시작(끌어서 돌리기는 됨).
   - 화면 밖에 있는 동안은 그리지 않는다. */
(function () {
  'use strict';
  var box = document.querySelector('.tecB-viewer');
  if (!box) return;
  var stage = box.querySelector('.tecB-viewer__stage');
  var ctrl = box.querySelector('.tecB-viewer__ctrl');
  var pp = box.querySelector('[data-v="pp"]');
  var url = box.getAttribute('data-model');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var started = false;
  /* 경로는 이 스크립트 파일 자리(js/)를 기준으로 푼다 — 시안 하위 폴더(test/ 등)에서도 같은 파일을 찾게 */
  var me = document.currentScript && document.currentScript.src ? document.currentScript.src : new URL('js/robot5-viewer.js', document.baseURI).href;

  function webglOk() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function fail() { box.classList.add('is-fallback'); if (ctrl) ctrl.hidden = true; }

  function start() {
    if (started) return; started = true;
    if (!webglOk() || !url) { fail(); return; }
    var base = new URL('vendor/three/', me).href;
    url = new URL('../' + url, me).href;
    Promise.all([
      import(base + 'three.module.min.js'),
      import(base + 'loaders/GLTFLoader.js'),
      import(base + 'controls/OrbitControls.js'),
      import(base + 'environments/RoomEnvironment.js')
    ]).then(function (m) {
      var THREE = m[0], GLTFLoader = m[1].GLTFLoader, OrbitControls = m[2].OrbitControls, RoomEnvironment = m[3].RoomEnvironment;
      var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      var scene = new THREE.Scene();
      var pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
      /* 다듬기: 빛을 부드럽게 — 위에서 비추는 주광을 낮추고, 하늘·바닥 반사광을 약하게 더한다 */
      var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 2.5); scene.add(key);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe4ea, 0.5));
      var camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
      var canvas = renderer.domElement; canvas.className = 'tecB-viewer__gl'; canvas.setAttribute('aria-hidden', 'true');
      var controls = new OrbitControls(camera, canvas);
      controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.2;
      controls.minPolarAngle = Math.PI * 0.12; controls.maxPolarAngle = Math.PI * 0.47;   // 바닥 아래로는 내려가지 않는다(그림자를 밑에서 보지 않게)
      canvas.style.touchAction = 'pan-y';   // 휴대폰: 세로 쓸기는 페이지 스크롤, 가로 끌기만 회전

      new GLTFLoader().load(url, function (gltf) {
        var model = gltf.scene;
        var bb = new THREE.Box3().setFromObject(model), size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
        model.position.sub(mid); scene.add(model);
        /* 다듬기: 질감을 비스듬히 봐도 또렷하게, 요철(노멀 맵)은 절반 정도로, 반사는 조금 약하게 — 금속이 구겨진 은박처럼 보이지 않게 */
        var aniso = renderer.capabilities.getMaxAnisotropy();
        model.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          var mt = o.material;
          ['map', 'normalMap', 'metalnessMap', 'roughnessMap'].forEach(function (k) { if (mt[k]) mt[k].anisotropy = aniso; });
          if (mt.normalScale) mt.normalScale.set(0.55, 0.55);
          mt.envMapIntensity = 0.8;
        });
        /* 다듬기: 바닥에 닿는 부드러운 그림자(로봇 발밑의 흐린 타원) — 떠 있지 않고 놓여 있게 보인다 */
        var sc = document.createElement('canvas'); sc.width = sc.height = 256;
        var sg = sc.getContext('2d'), grd = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
        grd.addColorStop(0, 'rgba(20,30,45,0.55)'); grd.addColorStop(0.5, 'rgba(20,30,45,0.22)'); grd.addColorStop(1, 'rgba(20,30,45,0)');
        sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
        var shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.6, size.z * 2.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = -size.y / 2 + 0.002; shadow.renderOrder = -1; scene.add(shadow);
        /* 다듬기: 화면 비율(PC 가로로 긴 판 · 휴대폰 거의 정사각)에 맞춰, 돌려도 잘리지 않는 한에서 크게 보이는 거리를 그때그때 잰다.
           +/− 단추는 이 거리에 곱하는 비율(zoomK)만 바꾼다 */
        var dir = new THREE.Vector3(0.62, 0.34, 0.71).normalize(), zoomK = 1;
        var needW = Math.hypot(size.x, size.z) * 1.06, elev = Math.asin(dir.y), needH = (size.y * Math.cos(elev) + Math.max(size.x, size.z) * Math.sin(elev)) * 1.3;    // 아래 그림자까지 들어오게 위아래 여유
        function fitDist() {
          var v = THREE.MathUtils.degToRad(camera.fov / 2), h = Math.atan(Math.tan(v) * camera.aspect);
          return Math.max(needH / 2 / Math.tan(v), needW / 2 / Math.tan(h));
        }
        function place(keepDir) {
          var d = fitDist() * zoomK, off = keepDir ? camera.position.clone().sub(controls.target) : dir.clone();
          camera.position.copy(controls.target).add(off.setLength(d));
          controls.minDistance = d * 0.99; controls.maxDistance = d * 1.01; controls.update();
        }
        controls.target.set(0, -size.y * 0.12, 0);   // 그림자를 포함한 무게 중심이 판 가운데 오게

        function resize() {
          var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
          renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); place(placed); placed = true;
        }
        var placed = false;
        stage.appendChild(canvas); resize(); window.addEventListener('resize', resize);
        var visible = true, raf = null;
        /* 한 번에 한 장만 예약한다: 그리는 동안에는 raf 가 살아 있어서 controls 의 change 신호가 장을 또 예약하지 않는다 */
        function frame() { controls.update(); renderer.render(scene, camera); raf = visible ? requestAnimationFrame(frame) : null; }
        function run() { if (!raf && visible) raf = requestAnimationFrame(frame); }
        renderer.render(scene, camera);
        box.classList.add('is-3d'); if (ctrl) ctrl.hidden = false;
        run();
        if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }).observe(stage);
        controls.addEventListener('change', run);

        function setPlay(on) {
          controls.autoRotate = on;
          if (pp) { pp.setAttribute('aria-pressed', on ? 'false' : 'true'); pp.querySelector('.tecB-viewer__pp-txt').textContent = on ? '자동 회전 멈춤' : '자동 회전 재생'; }
          run();
        }
        setPlay(!reduce);
        if (pp) pp.addEventListener('click', function () { setPlay(!controls.autoRotate); });
        box.querySelectorAll('[data-v="zoom"]').forEach(function (b) {
          b.addEventListener('click', function () {
            zoomK = THREE.MathUtils.clamp(zoomK * (b.getAttribute('data-k') === 'in' ? 0.85 : 1 / 0.85), 0.55, 1.5);
            place(true); run();
          });
        });
      }, undefined, function () { fail(); renderer.dispose(); });
    }).catch(fail);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '300px 0px' });
    io.observe(box);
  } else start();
})();
