/* 신정개발 홈페이지 — 시안 B 16차: 전 페이지 공통 모션 시스템 (moB-)
   - 글자·숫자·링크·사진은 그대로 두고, '내용이 등장하는 순간'과 '손이 닿는 순간'에만 움직인다(장식 루프 없음).
   - 외부 라이브러리 없음. IntersectionObserver 로 화면에 들어올 때 class 만 붙이고, 움직임은 css/site.css 의 moB- 규칙(transform·opacity·clip-path)이 맡는다.
   - 이 스크립트가 없거나 실패하면 html 에 moB-on 이 붙지 않아 모든 글자·사진이 그냥 보인다. 움직임 줄이기(prefers-reduced-motion)면 즉시 보이고 머리말도 줄지 않는다.
   1 제목 줄 올라오기: 본문(h2)의 글자를 줄(<br> 기준)마다 가림막 span 으로 감싼다 — 글자 자체는 그대로(DOM 글자 변경 없음)
   3 순차 등장: 카드·칸 묶음의 자식에 --i 를 매겨 70ms 간격으로 떠오르게
   4 사진 커튼: 본문 사진 상자에 moB-pic 을 붙여 clip-path 커튼
   6 머리말 축소: 120px(메인은 첫 화면을 벗어난 뒤)부터 html.moB-shrunk
   (2 숫자 카운트업은 js/site.js 의 기존 장치, 5·7·8 은 css 와 생성기) */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var html = document.documentElement;
  var hasIO = 'IntersectionObserver' in window;
  html.classList.add('moB-on');
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function observe(els, cb, opt) {
    if (!els.length) return;
    if (reduce || !hasIO) { els.forEach(cb); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; cb(e.target); io.unobserve(e.target); });
    }, opt || { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function (el) { io.observe(el); });
  }
  var SKIP = '.heroB, .hero, .reel, .bizB, .tecB-viewer';   // 첫 화면 글자 모션(1차)·색판(2차)·3D 뷰어(11차)는 건드리지 않는다

  document.addEventListener('DOMContentLoaded', function () {
    var main = document.getElementById('main') || document.body;

    /* ---------- 1. 제목 줄 올라오기 ---------- */
    var titles = $$('h2', main).filter(function (h) { return !h.closest(SKIP); });
    titles.forEach(function (h) {
      var lines = [[]];
      Array.prototype.slice.call(h.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && n.tagName === 'BR') lines.push([]); else lines[lines.length - 1].push(n);
      });
      var frag = document.createDocumentFragment();
      lines.forEach(function (nodes, i) {
        if (!nodes.length) return;
        var outer = document.createElement('span'); outer.className = 'moB-l';
        var inner = document.createElement('span'); inner.className = 'moB-li'; inner.style.transitionDelay = (i * 0.08) + 's';
        nodes.forEach(function (n) { inner.appendChild(n); });
        outer.appendChild(inner); frag.appendChild(outer);
      });
      h.textContent = ''; h.appendChild(frag); h.classList.add('moB-title');
    });
    observe(titles, function (h) { h.classList.add('is-in'); });

    /* ---------- 3. 순차 등장 ---------- */
    var groups = $$('.envB-grid, .projB-sectors, .histB-strip, .genB-strip, .stats, .grid, .co-locs, .ct-ways, .procB-strip, .uses, .dwflow, .co-rows__list, .scn-steps, .faq, .flow', main)
      .filter(function (g) { return !g.closest(SKIP) && g.children.length >= 2; });
    groups.forEach(function (g) {
      g.classList.add('moB-stagger');
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', String(Math.min(i, 9))); });
    });
    observe(groups, function (g) { g.classList.add('is-in'); });

    /* ---------- 4. 사진 커튼 ---------- */
    var pics = $$('.pcard__fig, .split__fig, .projB-sector', main).filter(function (p) { return !p.closest(SKIP); });
    pics.forEach(function (p) { p.classList.add('moB-pic'); });
    observe(pics, function (p) { p.classList.add('is-in'); }, { rootMargin: '0px 0px -6% 0px', threshold: 0.15 });

    /* 접기(details) 안의 제목·묶음·사진: 펼치는 순간 바로 보이게 한다(IntersectionObserver 가 늦거나 깨어나지 않는 경우의 안전장치) */
    $$('details', main).forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        requestAnimationFrame(function () { $$('.moB-title, .moB-stagger, .moB-pic', d).forEach(function (el) { el.classList.add('is-in'); }); });
      });
    });

    /* ---------- 6. 머리말 축소 ---------- */
    var hdr = document.querySelector('.hdr');
    if (hdr && !reduce) {
      var heroEl = document.body.getAttribute('data-page') === 'home' ? document.querySelector('.heroB, .hero, .reel') : null;
      var limit = function () {
        if (!heroEl) return 120;
        var hh = hdr.offsetHeight || 80;
        return Math.max(120, heroEl.getBoundingClientRect().bottom + window.scrollY - hh);   // 메인: 첫 화면을 벗어난 뒤부터
      };
      var th = limit(), tick = false;
      var apply = function () { html.classList.toggle('moB-shrunk', window.scrollY > th); tick = false; };
      apply();
      window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(apply); } }, { passive: true });
      window.addEventListener('resize', function () { th = limit(); apply(); });
    }
  });
})();
