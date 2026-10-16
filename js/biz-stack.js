/* 신정개발 홈페이지 — 메인 사업분야 층층 색판의 깊이감 (시안 B, home.sections 'whatB', 시안B 2차)
   - 판은 css 의 position: sticky 로 머리말 아래에 붙고, 다음 판이 아래에서 위로 덮는다(스크립트가 없어도 쌓인다).
   - 이 스크립트는 덮이는 판의 내용(.bizB__in)만 움직인다: 다음 판이 올라오는 만큼(0→1, smoothstep 완화)
     위로 48px 밀고, 1→0.955 로 작게, 1→0.45 로 옅게.
   - PC(가로 961px 이상)이고 움직임을 허용할 때만. 휴대폰·움직임 줄이기에서는 아무것도 하지 않는다(세로로 쌓이기만).
   - 스크롤·화면 크기가 바뀔 때만 계산한다(한 프레임에 한 번). */
(function () {
  'use strict';
  var root = document.querySelector('.bizB');
  if (!root) return;
  var panels = [].slice.call(root.querySelectorAll('.bizB__panel'));
  if (panels.length < 2) return;
  var inners = panels.map(function (p) { return p.querySelector('.bizB__in'); });
  var wide = window.matchMedia('(min-width: 961px) and (prefers-reduced-motion: no-preference)');
  var queued = false;

  function ease(t) { return t * t * (3 - 2 * t); }
  function clear() {
    inners.forEach(function (el) { el.style.transform = ''; el.style.opacity = ''; });
  }
  function update() {
    queued = false;
    if (!wide.matches) { clear(); return; }
    var vh = window.innerHeight;
    var top = parseFloat(getComputedStyle(panels[0]).top) || 0;   // 판이 붙는 높이(머리말 아래)
    var span = Math.max(1, vh - top);
    for (var i = 0; i < panels.length - 1; i++) {
      var p = (vh - panels[i + 1].getBoundingClientRect().top) / span;
      var e = ease(Math.max(0, Math.min(1, p)));
      inners[i].style.transform = e ? 'translateY(' + (-48 * e).toFixed(1) + 'px) scale(' + (1 - 0.045 * e).toFixed(4) + ')' : '';
      inners[i].style.opacity = e ? (1 - 0.55 * e).toFixed(3) : '';
    }
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  if (wide.addEventListener) wide.addEventListener('change', queue); else if (wide.addListener) wide.addListener(queue);
  update();
})();
