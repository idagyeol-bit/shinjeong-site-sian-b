/* 신정개발 홈페이지 — 다이어트판의 접기 (시안 B, 설정 diet.technology · diet.process, 시안B 3·4차)
   - 내용은 <details class="fold"> 안에 그대로 있다(접혀 있어도 HTML 에 내용이 있다). 열고 닫기는 브라우저 기본 동작(누르기·Enter·Space).
   - 주소가 #이름 으로 들어오면 data-open-hash="이름" 인 접기를 열어 둔다(4차: 현장 진행 방식의 #dewater 탈수 과정).
   - 장비·로봇(3차): 분야 페이지의 '장비 보기'(#eq-cleaning 등)로 들어오면 그 묶음의 '장비 목록' 접기를 연다(24차 탭 장치는 js/site.js 그대로).
     보유 장비 탭에서 한 분야를 누르면 그 분야의 접기를 연다(전체 탭은 손대지 않는다). */
(function () {
  'use strict';
  var sec = document.getElementById('equipment');
  var openGroup = function (id) {
    if (!id || !sec) return;
    var g = document.getElementById(id);
    if (!g || !sec.contains(g) || !g.classList.contains('eqgroup')) return;
    var d = g.querySelector('details.tecB-fold');
    if (d) d.open = true;
  };
  var openByHash = function (id) {
    if (!id) return;
    [].slice.call(document.querySelectorAll('details[data-open-hash]')).forEach(function (d) {
      if (d.getAttribute('data-open-hash') === id) d.open = true;
    });
  };
  var fromHash = function () {
    var id = decodeURIComponent(location.hash.slice(1));
    openGroup(id);
    openByHash(id);
  };
  var tabs = sec && sec.querySelector('.eqtabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-eq]');
    if (a) openGroup(a.getAttribute('data-eq'));
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
