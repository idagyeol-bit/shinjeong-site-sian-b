/* 신정개발 홈페이지 — 현장 진행 방식 '현장 배치와 작업 순서' 연출 영상 (시안 B 25차, 설정 look.processVideo)
   - 22차 js/heroB-video.js 와 같은 방식. <video> 는 preload="none" 이고 <source> 가 비어 있다. 구역이 화면 가까이(아래 800px) 오면 source 를 붙여 받기 시작한다.
   - 구역이 화면에 오면 무음 반복 재생, 벗어나면 일시정지. 실제로 그림이 나오기 시작(playing)하면 .is-video 가 붙어 포스터 사진 위로 영상이 보인다.
   - 움직임 줄이기(prefers-reduced-motion)·재생 실패·받기 전에는 포스터 사진이 그대로 보인다(빈 화면 없음). 다른 탭으로 가면 멈춘다. */
(function () {
  'use strict';
  var boxes = [].slice.call(document.querySelectorAll('.procB-vid[data-video]'));
  if (!boxes.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 포스터 그대로
  boxes.forEach(function (box) {
    var v = box.querySelector('video.procB-vid__v');
    if (!v) return;
    var loaded = false, failed = false, inView = false, wasOn = null;
    function attach() {
      if (loaded) return; loaded = true;
      var webm = v.getAttribute('data-webm'), mp4 = v.getAttribute('data-mp4');
      if (webm) { var s1 = document.createElement('source'); s1.src = webm; s1.type = 'video/webm'; v.appendChild(s1); }
      if (mp4) { var s2 = document.createElement('source'); s2.src = mp4; s2.type = 'video/mp4'; v.appendChild(s2); }
      v.addEventListener('error', fail, true);
      v.addEventListener('playing', function () { if (!box.classList.contains('is-video')) box.classList.add('is-video'); });
      v.preload = 'auto';
      v.load();
      sync();
    }
    function fail() { failed = true; box.classList.remove('is-video'); }
    function sync() {
      if (!loaded) return;
      var on = inView && !document.hidden;
      if (on === wasOn) return;   // 실제로 보임↔안 보임이 바뀔 때만 움직인다
      wasOn = on;
      if (on) { if (failed) return; var p = v.play(); if (p && p.catch) p.catch(function () { /* 자동 재생 거부: 포스터 그대로 */ }); }
      else v.pause();
    }
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) {
      /* 받기: 구역이 화면 아래 800px 안에 들어오면 시작(첫 화면 사진을 방해하지 않는다). 재생·정지: 실제로 보이는지로 정한다 */
      new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { attach(); io.disconnect(); } }, { rootMargin: '0px 0px 800px 0px' }).observe(box);
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; sync(); }, { threshold: 0.2 }).observe(box);
    } else { inView = true; attach(); }
  });
})();
