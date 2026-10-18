/* 신정개발 홈페이지 — 메인 첫 화면 영상 장면 (시안 B 22차, 설정 hero.scenes[].video)
   - 장면의 <video> 는 preload="none" 이고 <source> 가 비어 있다. 페이지 load 뒤 한가할 때(1번 장면 사진 뒤) 이 스크립트가 source 를 붙여 받기 시작한다.
   - 장면이 켜지면(is-on) 처음부터 무음 재생, 꺼지면 일시정지. 실제로 그림이 나오기 시작(playing)하면 장면에 is-video 가 붙어 포스터 사진 위로 영상이 보인다.
   - 움직임 줄이기(prefers-reduced-motion)·재생 실패·받기 전에는 포스터(장면 사진)가 그대로 보인다(빈 화면 없음). 다른 탭으로 가면 멈춘다. */
(function () {
  'use strict';
  var slides = [].slice.call(document.querySelectorAll('.heroB__slide[data-video]'));
  if (!slides.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 포스터 그대로
  slides.forEach(function (slide) {
    var v = slide.querySelector('video.heroB__vid');
    if (!v) return;
    var loaded = false, failed = false;
    function attach() {
      if (loaded) return; loaded = true;
      var webm = v.getAttribute('data-webm'), mp4 = v.getAttribute('data-mp4');
      if (webm) { var s1 = document.createElement('source'); s1.src = webm; s1.type = 'video/webm'; v.appendChild(s1); }
      if (mp4) { var s2 = document.createElement('source'); s2.src = mp4; s2.type = 'video/mp4'; v.appendChild(s2); }
      v.addEventListener('error', fail, true);
      /* classList.add 는 이미 있는 class 라도 속성을 다시 써서 MutationObserver 를 깨운다 → 없을 때만 붙인다(안 그러면 playing → add → sync → play → seek → playing … 되감기 반복) */
      v.addEventListener('playing', function () { if (!slide.classList.contains('is-video')) slide.classList.add('is-video'); });
      v.load();
      sync();
    }
    function fail() { failed = true; slide.classList.remove('is-video'); }
    function play() {
      if (failed) return;
      try { v.currentTime = 0; } catch (e) {}   // 장면이 켜질 때마다 처음부터
      var p = v.play(); if (p && p.catch) p.catch(function () { /* 자동 재생 거부: 포스터 그대로 */ });
    }
    var wasOn = null, inView = true;
    function sync() {
      if (!loaded) return;
      var on = slide.classList.contains('is-on') && !document.hidden && inView;
      if (on === wasOn) return;   // 실제로 켜짐↔꺼짐이 바뀔 때만 움직인다(같은 상태의 class 변경에는 반응하지 않는다)
      wasOn = on;
      if (on) play(); else v.pause();
    }
    new MutationObserver(sync).observe(slide, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; sync(); }).observe(slide);
    function kick() { if ('requestIdleCallback' in window) requestIdleCallback(attach, { timeout: 2500 }); else setTimeout(attach, 600); }
    if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick);
  });
})();
