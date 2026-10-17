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
      var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2, 3, 2.5); scene.add(key);
      var camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
      var canvas = renderer.domElement; canvas.className = 'tecB-viewer__gl'; canvas.setAttribute('aria-hidden', 'true');
      var controls = new OrbitControls(camera, canvas);
      controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.2;
      controls.minPolarAngle = Math.PI * 0.12; controls.maxPolarAngle = Math.PI * 0.62;
      canvas.style.touchAction = 'pan-y';   // 휴대폰: 세로 쓸기는 페이지 스크롤, 가로 끌기만 회전

      new GLTFLoader().load(url, function (gltf) {
        var model = gltf.scene;
        var bb = new THREE.Box3().setFromObject(model), size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
        model.position.sub(mid); scene.add(model);
        var r = size.length() / 2, dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.82;
        camera.position.set(dist * 0.62, dist * 0.34, dist * 0.71); controls.target.set(0, 0, 0);
        controls.minDistance = dist * 0.55; controls.maxDistance = dist * 1.6; controls.update();
        var home = camera.position.clone();

        function resize() {
          var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
          renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
        }
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
            var k = b.getAttribute('data-k') === 'in' ? 0.85 : 1 / 0.85;
            var off = camera.position.clone().sub(controls.target);
            var d = THREE.MathUtils.clamp(off.length() * k, controls.minDistance, controls.maxDistance);
            camera.position.copy(controls.target).add(off.setLength(d)); controls.update(); run();
          });
        });
        void home;
      }, undefined, function () { fail(); renderer.dispose(); });
    }).catch(fail);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '300px 0px' });
    io.observe(box);
  } else start();
})();
