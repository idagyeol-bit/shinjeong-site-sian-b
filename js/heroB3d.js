/* 신정개발 홈페이지 — 메인 첫 화면 4번 장면 '로봇 리빌 시네마틱' (시안 B 20차, 설정 hero.scenes[].cine · hero.cine.model)
   - 11차의 three.js(js/vendor/three)·로봇 모형(assets/models/robot5.glb)을 다시 쓴다. 장비·로봇 페이지 뷰어(js/robot5-viewer.js)와는 코드만 비슷하고 동작은 따로다.
   - 연출(장면이 켜질 때마다 처음부터, 5초 안에):
       ⓐ 0초   거의 어둠(아주 어두운 남색) + 바닥의 희미한 빛 웅덩이
       ⓑ 0.5초 로봇 헤드라이트 2개가 켜진다(빛무리) — 글귀는 css 의 .is-3d 지연으로 이때 올라온다
       ⓒ 1.2~2.3초 위에서 비스듬한 조명 빔이 한 번 쓸고 지나가며 몸체가 드러나고, 그 뒤 주광·윤곽광·반사가 서서히 자리를 잡는다
       ⓓ 1~5초 카메라가 낮은 각도에서 천천히 호를 그리며 다가간다(돌리 + 아크) — 로봇은 돌지 않는다
       ⓔ 내내  빛줄기 속 미세 먼지(PC 60개·휴대폰 20개)
     PC 에서 마우스를 움직이면 카메라가 ±2° 안에서 살짝 따라 기운다(휴대폰은 없음).
   - 우선순위: 1번 장면 사진을 방해하지 않게 window load 뒤 한가할 때 모형을 받기 시작한다. 받기 전·WebGL 불가·실패·움직임 줄이기면 지금의 실사(4번 장면 사진)가 그대로 보인다.
   - 장면이 꺼져 있거나 첫 화면이 화면 밖이면 그리지 않는다. */
(function () {
  'use strict';
  var slide = document.querySelector('.heroB__slide[data-cine="robot"]');
  var hero = document.getElementById('heroB');
  if (!slide || !hero) return;
  var box = slide.querySelector('.heroB3d');
  var url = box && box.getAttribute('data-model');
  if (!box || !url) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 움직임 줄이기: 실사 그대로
  var me = document.currentScript && document.currentScript.src ? document.currentScript.src : new URL('js/heroB3d.js', document.baseURI).href;
  function webglOk() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
  if (!webglOk()) return;
  var mobile = window.matchMedia('(max-width: 960px)').matches;
  var started = false;

  function start() {
    if (started) return; started = true;
    var base = new URL('vendor/three/', me).href;
    var model = new URL('../' + url, me).href;
    Promise.all([import(base + 'three.module.min.js'), import(base + 'loaders/GLTFLoader.js')]).then(function (m) {
      var THREE = m[0], GLTFLoader = m[1].GLTFLoader;
      var renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      /* 어두운 스튜디오 반사 환경(뷰어와 같은 모양, 밝기는 낮게) — 크롬·도장에 은은한 반사. 세기는 연출 중 0 → 0.55 */
      function studio() {
        var s = new THREE.Scene();
        var geo = new THREE.SphereGeometry(10, 48, 24), pos = geo.attributes.position, cols = [];
        var lo = new THREE.Color(0x0b1016), hi = new THREE.Color(0x4a525c), c = new THREE.Color();
        for (var i = 0; i < pos.count; i++) { c.lerpColors(lo, hi, THREE.MathUtils.smoothstep(pos.getY(i) / 10, -0.25, 0.55)); cols.push(c.r, c.g, c.b); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
        function panel(w, h, k, x, y, z) { var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); s.add(p); }
        panel(9, 6, 3, 0, 8.5, 0.5); panel(4, 6.5, 4, -6.5, 3, 5); panel(1.4, 8, 5, 7, 2.5, -3.5); panel(1.4, 8, 3, -6, 2.5, -6);
        return s;
      }
      var pmrem = new THREE.PMREMGenerator(renderer);
      var envTex = pmrem.fromScene(studio(), 0.04).texture; pmrem.dispose();
      scene.environment = envTex;

      new GLTFLoader().load(model, function (gltf) {
        var robot = gltf.scene;
        var bb = new THREE.Box3().setFromObject(robot), size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
        robot.position.sub(mid); scene.add(robot);
        var L = Math.max(size.x, size.y, size.z), S = L * L;   // 빛 세기는 크기²에 비례(거리 제곱 감쇠)
        var floorY = -size.y / 2;
        var mats = [];
        robot.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          var mt = o.material; mats.push(mt);
          ['map', 'normalMap', 'metalnessMap', 'roughnessMap'].forEach(function (k) { if (mt[k]) mt[k].anisotropy = renderer.capabilities.getMaxAnisotropy(); });
          if (mt.userData && mt.userData.normalMapSpace === 'object') { mt.normalMapType = THREE.ObjectSpaceNormalMap; mt.flatShading = true; mt.needsUpdate = true; }
          mt.envMapIntensity = 0;
        });
        /* 바닥: 어두운 무광 판 + 로봇 발밑 그림자 + 희미한 빛 웅덩이 */
        var floor = new THREE.Mesh(new THREE.PlaneGeometry(L * 14, L * 14), new THREE.MeshStandardMaterial({ color: 0x0a1521, roughness: 0.32, metalness: 0.15 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = floorY - 0.001; scene.add(floor);
        function radial(a0, a1, rgb) { var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')'); gr.addColorStop(0.45, 'rgba(' + rgb + ',' + a1 + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); }
        var shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.5, size.z * 2.0), new THREE.MeshBasicMaterial({ map: radial(0.7, 0.3, '0,0,0'), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY + 0.002; scene.add(shadow);
        var pool = new THREE.Mesh(new THREE.PlaneGeometry(L * 3.2, L * 2.2), new THREE.MeshBasicMaterial({ map: radial(0.16, 0.06, '120,160,210'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        pool.rotation.x = -Math.PI / 2; pool.position.y = floorY + 0.001; scene.add(pool);

        /* 빛: 바닥 깔림(아주 약함) · 헤드라이트 2개(점광 + 빛무리) · 쓸고 가는 빔(스포트) · 드러난 뒤의 주광·윤곽광 */
        scene.add(new THREE.HemisphereLight(0x243244, 0x05090e, 0.12));
        var warm = 0xfff1d2, lamps = [], glows = [];
        var glowTex = radial(0.95, 0.35, '255,244,214');
        [-0.27, 0.27].forEach(function (zf) {
          var p = new THREE.Vector3(-size.x / 2 + size.x * 0.24, floorY + size.y * 0.44, size.z * zf);   // 앞(브러시 쪽 = -x) 몸체 앞면 양옆, 흡입관보다 아래
          var pl = new THREE.PointLight(warm, 0, L * 3, 2); pl.position.copy(p).add(new THREE.Vector3(-L * 0.08, 0, 0)); scene.add(pl); lamps.push(pl);
          var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: warm, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
          sp.position.copy(p).add(new THREE.Vector3(-L * 0.03, 0, 0)); sp.scale.setScalar(L * 0.15); scene.add(sp); glows.push(sp);
        });
        var sweep = new THREE.SpotLight(0xdfe9ff, 0, L * 12, 0.42, 0.7, 1.2); sweep.position.set(-L * 0.9, L * 2.2, L * 1.8); sweep.target.position.set(0, 0, 0); scene.add(sweep); scene.add(sweep.target);
        var key = new THREE.DirectionalLight(0xffffff, 0); key.position.set(-1.6, 2.2, 1.4); scene.add(key);
        var rim = new THREE.DirectionalLight(0xbfd3ff, 0); rim.position.set(1.8, 1.4, -1.6); scene.add(rim);

        /* 먼지: 빛줄기 안(로봇 앞·위쪽)에 소량, 천천히 떠다닌다 */
        var N = mobile ? 20 : 60, dust = new Float32Array(N * 3), vel = new Float32Array(N * 3);
        for (var i = 0; i < N; i++) { dust[3 * i] = (Math.random() - 0.7) * L * 1.6; dust[3 * i + 1] = floorY + Math.random() * L * 1.2; dust[3 * i + 2] = (Math.random() - 0.4) * L * 1.4; vel[3 * i] = (Math.random() - 0.5) * L * 0.02; vel[3 * i + 1] = (Math.random() - 0.3) * L * 0.015; vel[3 * i + 2] = (Math.random() - 0.5) * L * 0.02; }
        var dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
        var dustMat = new THREE.PointsMaterial({ color: 0xdfe9ff, size: L * 0.012, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
        scene.add(new THREE.Points(dustGeo, dustMat));

        /* 카메라 길: 앞·왼쪽·낮은 각도에서 시작해 호를 그리며 다가온다 */
        var target = new THREE.Vector3(0, -size.y * 0.08, 0);
        var A0 = { az: 212, el: 9, d: 2.05 }, A1 = { az: 236, el: 12.5, d: 1.55 };   // az: +x 축 기준 각도(도), 앞은 180° 쪽. d: L 의 배수
        var par = { x: 0, y: 0, tx: 0, ty: 0 };
        function place(t) {
          var k = THREE.MathUtils.smoothstep(t, 1.0, 5.0);
          var narrow = camera.aspect < 1;   // 휴대폰(세로): 더 멀리서, 로봇이 글 위쪽에 오게 조금 아래를 본다
          if (narrow) target.y = -size.y * 0.08 - L * 0.2; else target.y = -size.y * 0.08;
          var az = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(A0.az, A1.az, k) + par.x * 2), el = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(A0.el, A1.el, k) + par.y * 1.2), d = THREE.MathUtils.lerp(A0.d, A1.d, k) * L * (narrow ? 1.95 : 1);
          camera.position.set(target.x + d * Math.cos(el) * Math.cos(az), target.y + d * Math.sin(el), target.z + d * Math.cos(el) * Math.sin(az));
          camera.lookAt(target);
        }
        var canvas = renderer.domElement; canvas.setAttribute('aria-hidden', 'true'); box.appendChild(canvas);
        function resize() { var w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
        resize(); window.addEventListener('resize', resize);
        if (!mobile) hero.addEventListener('mousemove', function (e) { var r = hero.getBoundingClientRect(); par.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; par.ty = ((e.clientY - r.top) / r.height - 0.5) * -2; });

        var ss = THREE.MathUtils.smoothstep, t0 = null, raf = null, active = false, visible = true, lastT = 0;
        function frame(now) {
          raf = null;
          if (t0 === null) t0 = now;
          var t = (now - t0) / 1000, dt = Math.min(0.05, t - lastT); lastT = t;
          /* ⓑ 헤드라이트 */
          var hl = ss(t, 0.45, 0.95) * (1 - 0.06 * Math.abs(Math.sin(t * 9)) * ss(1.4, t, 0.9));
          lamps.forEach(function (l) { l.intensity = hl * 0.55 * S; });
          glows.forEach(function (g, i) { g.material.opacity = hl * 0.85; g.scale.setScalar(L * (0.12 + 0.04 * hl + 0.006 * Math.sin(t * 6 + i))); });
          /* ⓒ 쓸고 가는 빔(1.1~2.3초) → 주광·윤곽광·반사가 자리를 잡는다(2.0~3.0초) */
          var sw = ss(t, 1.1, 1.6) * (1 - ss(t, 1.9, 2.4));
          sweep.intensity = sw * 9 * S; sweep.position.z = THREE.MathUtils.lerp(L * 2.0, -L * 1.6, ss(t, 1.1, 2.4));
          var on = ss(t, 2.0, 3.1);
          key.intensity = on * 1.15; rim.intensity = on * 0.7;
          var env = on * 0.55; mats.forEach(function (mt) { mt.envMapIntensity = env; });
          dustMat.opacity = 0.32 * Math.max(sw * 0.8, on * 0.6) * (0.85 + 0.15 * Math.sin(t * 2.1));
          pool.material.opacity = 0.35 + 0.65 * Math.max(hl * 0.6, on);
          /* ⓔ 먼지 떠다님 */
          var pos = dustGeo.attributes.position.array;
          for (var i = 0; i < N; i++) { pos[3 * i] += vel[3 * i] * dt; pos[3 * i + 1] += vel[3 * i + 1] * dt; pos[3 * i + 2] += vel[3 * i + 2] * dt; if (pos[3 * i + 1] > floorY + L * 1.3 || pos[3 * i + 1] < floorY) pos[3 * i + 1] = floorY + Math.random() * L * 1.2; }
          dustGeo.attributes.position.needsUpdate = true;
          /* ⓓ 카메라 + 패럴랙스 */
          par.x += (par.tx - par.x) * 0.06; par.y += (par.ty - par.y) * 0.06;
          place(t);
          renderer.render(scene, camera);
          if (active && visible && !document.hidden) raf = requestAnimationFrame(frame);
        }
        function run() { if (!raf && active && visible && !document.hidden) raf = requestAnimationFrame(frame); }
        var offTimer = null;
        function setActive(on) {
          if (on) { clearTimeout(offTimer); if (!active) { active = true; t0 = null; lastT = 0; } run(); }
          else { clearTimeout(offTimer); offTimer = setTimeout(function () { active = false; }, 1300); }   // 교차 흐림(1.1초) 동안은 계속 그린다
        }
        /* 장면이 켜지는 순간을 본다(js/hero-slides.js 가 is-on 을 붙인다) */
        new MutationObserver(function () { setActive(slide.classList.contains('is-on')); }).observe(slide, { attributes: true, attributeFilter: ['class'] });
        if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; run(); }).observe(hero);
        document.addEventListener('visibilitychange', run);
        /* 첫 장을 미리 그려 두고 3D 로 바꾼다(사진이 사라지는 전환은 css) */
        place(0); renderer.render(scene, camera);
        slide.classList.add('is-3d');
        setActive(slide.classList.contains('is-on'));
      }, undefined, function () { renderer.dispose(); });   // 실패: 실사 그대로
    }).catch(function () {});
  }
  /* 1번 장면 사진이 먼저: 페이지 load 뒤 한가할 때 시작 */
  function kick() { if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 }); else setTimeout(start, 600); }
  if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick);
})();
