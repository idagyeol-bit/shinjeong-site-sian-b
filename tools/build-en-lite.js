/* 신정개발 홈페이지 — 시안 B 축약 영문판 생성기 (34차, 2026-10-19 이다결 님 결정)
   - en/index.html · en/technology.html · en/contact.html 3쪽만 만든다. 기존 전체 미러(tools/build-en.js, tools/i18n/en.json)는 쓰지 않고 보존만 한다.
   - 영문 문구는 tools/i18n/en-lite.json 한 곳에 있다(34차 지시서 카피 전문 그대로). 여기서는 문구를 만들지 않는다.
   - 숫자·연락처·주소 숫자 같은 사실 값은 국문 생성 결과(index.html · company.html · technology.html · contact.html, 곧 tools/build.js 의 데이터)에서 읽는다.
     영문 파일에 숫자를 손으로 다시 치지 않는다(국문과 어긋남 방지). 읽지 못하면 멈춘다.
   - 모든 영문 쪽: noindex, 시안 띠(영문), 제목 앞 [Draft], 바닥글 AI 고지(영문). 머리말은 Home · Technology · Contact + KOR(국문 홈으로).
   실행: node tools/build.js → node tools/build-en-lite.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'en');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n', 'en-lite.json'), 'utf8'));
const CFG = require(path.join(__dirname, 'site.config.js'));
const SIAN = CFG.sian || {};
const SITE_URL = (() => { const m = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8').match(/^const SITE_URL = '([^']+)'/m); return m ? m[1] : ''; })();
const LITE_PAGES = ['index.html', 'technology.html', 'contact.html'];

const fail = (m) => { console.error('영문판(축약) 생성 오류: ' + m); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (f) => { const p = path.join(ROOT, f); if (!fs.existsSync(p)) fail(`국문 ${f} 이 없습니다. 먼저 node tools/build.js 를 돌리세요.`); return fs.readFileSync(p, 'utf8'); };
const pick = (html, re, what) => { const m = html.match(re); if (!m) fail(`국문 페이지에서 ${what}을(를) 찾지 못했습니다`); return m[1]; };

/* ---------- 사실 값: 국문 생성 결과에서 ---------- */
const ko = { index: read('index.html'), company: read('company.html'), technology: read('technology.html'), contact: read('contact.html') };
const statsBlock = pick(ko.index, /<section[^>]*class="[^"]*\btrust\b[^"]*"[\s\S]*?<div class="stats"[^>]*>([\s\S]*?)<\/div>\s*<div class="trust__info"/, '숫자 띠');
const stats = [...statsBlock.matchAll(/data-count="(\d+)"/g)].map((m) => +m[1]);
if (stats.length !== 4) fail(`숫자 띠 값이 4개가 아닙니다: ${stats.join(', ')}`);
const founded = +pick(ko.company, /<dt>설립<\/dt><dd>(\d{4})년/, '설립 연도');   // 회사 소개 '한눈에 보기' 표(설립 1992년)
const rnd = +pick(ko.company, /<dt>기업부설연구소<\/dt><dd>(\d{4})년/, '기업부설연구소 설립 연도');
const generations = (ko.technology.match(/class="genB-ms[ "]/g) || []).length;
if (!generations) fail('세대 이정표(genB-ms)를 찾지 못했습니다');
const pdfTech = pick(ko.technology, /href="(assets\/docs\/[^"]*robot[^"]*public\.pdf)"/, '기술소개서 공개용 PDF 링크');
const tel = pick(ko.contact, /<a href="tel:\d+">([\d-]+)<\/a>/, '대표 전화');
const fax = pick(ko.contact, /팩스 ([\d-]+)/, '팩스');
const hours = pick(ko.contact, /문의 가능 시간 ([\d:]+ ~ [\d:]+)/, '문의 가능 시간');
const email = pick(ko.contact, /<a href="mailto:([^"]+)">/, '이메일');
const koAddr = pick(ko.index, /본사 ([^<]+)<br>/, '본사 주소');
const koBranch = pick(ko.index, /지사 ([^<]+)<br>/, '지사 주소');
/* 주소 로마자 줄의 번지 숫자가 국문 주소의 숫자와 같은지 */
const num = (s) => (s.match(/\d+/g) || []);
if (!num(D.contact.hqLine).includes(num(koAddr)[num(koAddr).length - 1])) fail(`본사 주소 번지가 다릅니다: ${D.contact.hqLine} ↔ ${koAddr}`);
if (!num(D.contact.branchLine).includes(num(koBranch)[num(koBranch).length - 1])) fail(`지사 주소 번지가 다릅니다: ${D.contact.branchLine} ↔ ${koBranch}`);
const intl = (n) => D.contact.phonePrefix + n.replace(/^0/, '');   // 061-682-5537 → +82-61-682-5537
/* og:image 는 국문 홈과 같은 사진(35차: 영문 쪽에 og:image 가 없던 것을 보강) */
const OG_IMAGE = (() => { const m = ko.index.match(/<meta property="og:image" content="[^"]*?(assets\/[^"]+)">\s*<meta property="og:image:width" content="(\d+)">\s*<meta property="og:image:height" content="(\d+)">/); if (!m) fail('국문 홈의 og:image 를 찾지 못했습니다'); return { src: m[1], w: m[2], h: m[3] }; })();
const koYear = new Date().getFullYear();

/* ---------- 공통 틀 ---------- */
const ICON = {
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9.5 12l2 2 3.5-4"/></svg>',
  remote: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="9" width="10" height="12" rx="2"/><path d="M12 9V5M9 5.5a4 4 0 0 1 6 0"/><circle cx="12" cy="15" r="1.2"/></svg>',
  wave: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="8" r="2.2"/><path d="M11.2 8h1.6"/></svg>',
  tank2: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="3"/><path d="M5 9h14M5 15h14"/></svg>'
};
const arrow = (s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
const C = D.common;

function head(o) {
  return `<!doctype html>
<html lang="en" class="is-preview">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(C.draftTitle + o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="format-detection" content="telephone=no">
<meta name="theme-color" content="#0e2e4a">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.brand)}">
<meta property="og:title" content="${esc(C.draftTitle + o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${SITE_URL}en/${o.file === 'index.html' ? '' : o.file}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${SITE_URL}${OG_IMAGE.src}">
<meta property="og:image:width" content="${OG_IMAGE.w}">
<meta property="og:image:height" content="${OG_IMAGE.h}">
<link rel="icon" href="../assets/logo/shinjeong-symbol.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/logo/shinjeong-symbol.png">
<link rel="preload" href="../assets/fonts/sub/PretendardVariable-0.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/site.css">
</head>
<body class="moB-root" data-page="${o.page}">
<a class="skip-link" href="#main">${esc(C.skip)}</a>
<div class="sianbar" role="note" style="--sian: ${SIAN.color || '#c2410c'}"><span class="sianbar__name">${esc(SIAN.name ? 'Draft B' : 'Draft')}</span><span class="sianbar__note">${esc(C.draftBar.replace(/^Draft B — /, ''))}</span></div>
`;
}
function header(page) {
  const nav = [['index.html', C.nav.home, 'index'], ['technology.html', C.nav.technology, 'technology'], ['contact.html', C.nav.contact, 'contact']];
  const a = (n, extra) => `<a href="${n[0]}"${n[2] === page ? ' aria-current="page"' : ''}>${esc(n[1])}${extra || ''}</a>`;
  return `<header class="hdr">
  <a class="hdr__brand" href="index.html">
    <img class="hdr__logo" src="../assets/logo/shinjeong-symbol.svg" width="36" height="44" alt="" aria-hidden="true">
    <span class="hdr__brandtext"><b>${esc(C.brand)}</b><span aria-hidden="true">${esc(C.brandCo)}</span></span>
  </a>
  <nav class="gnb" aria-label="Main menu">
${nav.map((n) => `      ${a(n)}`).join('\n')}
  </nav>
  <div class="hdr__act">
    <a class="hdr__lang" href="../index.html" hreflang="ko" lang="ko">${esc(C.toKorean)}</a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="drawer" aria-label="${esc(C.menuOpen)}"><i></i><i></i><i></i></button>
  </div>
</header>

<div class="drawer" id="drawer" aria-hidden="true">
  <nav aria-label="Menu">
${nav.map((n, i) => `    ${a(n, `<span>0${i + 1}</span>`)}`).join('\n')}
    <a href="../index.html" hreflang="ko" lang="ko">${esc(C.toKorean)}<span>04</span></a>
  </nav>
  <div class="drawer__foot">
    ${esc(C.brandCo)} · ${esc(C.footerTagline)} · ${esc(C.since)} ${founded}<br>
    <a href="tel:${intl(tel).replace(/-/g, '')}">${esc(intl(tel))}</a><br>
    <a href="mailto:${email}">${email}</a>
  </div>
</div>
`;
}
function hero(h1, lead) {
  return `  <section class="phero">
    <div class="phero__grid" aria-hidden="true"></div>
    <div class="wrap">
      <h1>${esc(h1)}</h1>
      ${lead ? `<p class="phero__lead">${esc(lead)}</p>` : ''}
    </div>
  </section>
`;
}
function footer() {
  return `<footer class="ftr enB-ftr">
  <div class="wrap">
    <div class="ftr__top enB-ftr__top">
      <div class="ftr__brand">
        <img class="ftr__logo" src="../assets/logo/shinjeong-symbol.svg" width="30" height="37" alt="" aria-hidden="true">
        <b>${esc(C.brandCo)}</b>
        <p class="ftr__info">
          ${esc(C.footerTagline)} · ${esc(C.since)} ${founded}<br>
          ${esc(D.contact.hqLine)}<br>
          ${esc(D.contact.branchLine)}<br>
          ${esc(C.tel)} <a href="tel:${intl(tel).replace(/-/g, '')}">${esc(intl(tel))}</a> · ${esc(C.fax)} ${esc(intl(fax))}<br>
          <a href="mailto:${email}">${email}</a>
        </p>
      </div>
      <nav class="ftr__map enB-ftr__map" aria-label="Site map">
        <div>
          <ul>
            <li><a href="index.html">${esc(C.nav.home)}</a></li>
            <li><a href="technology.html">${esc(C.nav.technology)}</a></li>
            <li><a href="contact.html">${esc(C.nav.contact)}</a></li>
            <li><a href="../index.html" hreflang="ko" lang="ko">${esc(C.toKorean)}</a></li>
          </ul>
        </div>
      </nav>
    </div>
    <div class="ftr__bot">
      <p>&copy; <span data-year>${koYear}</span> ${esc(C.brandCo)} ${esc(C.copyright)}</p>
      <button class="totop" type="button" data-totop>${esc(C.toTop)} <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
    </div>
    <p class="ftr__ai">${esc(C.aiNotice)}</p>
  </div>
</footer>
<script src="../js/site.js"></script>
<script src="../js/moB.js"></script>
</body>
</html>
`;
}

/* ---------- 쪽 1: 홈 ---------- */
const H = D.home;
const homePage = head({ file: 'index.html', page: 'index', title: H.title, desc: H.desc }) + header('index') + `
<main id="main">
` + hero(H.heroTitle, H.heroSub) + `
  <section class="section section--sm section--navy trust" aria-label="${esc(H.statsLabel)}">
    <div class="wrap">
      <div class="stats" data-reveal>
${stats.map((n, i) => `        <div class="stat"><b><span data-count="${n}">${n}</span>${H.statsPlus[i] ? '<i>+</i>' : ''}</b><span>${esc(H.stats[i])}</span></div>`).join('\n')}
      </div>
      <div class="trust__info" data-reveal>
        <p class="trust__src">${esc(H.statsSource)}</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="head head--solo" data-reveal><div><h2>${esc(H.whatTitle)}</h2></div></div>
      <div class="grid grid--5 enB-svcs">
${H.services.map((s, i) => `        <article class="enB-svc" data-reveal${i ? ` data-delay="${i * 60}"` : ''}><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></article>`).join('\n')}
      </div>
      <div class="enB-band" data-reveal>
        <div><h2>${esc(H.robotsTitle)}</h2><p>${esc(H.robotsText)}</p></div>
        <a class="btn btn--fill" href="technology.html">${esc(H.robotsButton)}</a>
      </div>
    </div>
  </section>

</main>

` + footer();

/* ---------- 쪽 2: Technology ---------- */
const T = D.technology;
const techPage = head({ file: 'technology.html', page: 'technology', title: T.title, desc: T.desc }) + header('technology') + `
<main id="main">
` + hero(T.heroTitle, T.heroSub) + `
  <section class="section section--soft">
    <div class="wrap">
      <ul class="tecB-spec__tiles" aria-label="${esc(T.tilesLabel)}" data-reveal>
${T.tiles.map((t) => `        <li><span class="tecB-spec__ico">${ICON[t.ico]}</span><b>${esc(t.k)}</b><span>${esc(t.d)}</span></li>`).join('\n')}
      </ul>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="head head--solo" data-reveal><div><h2>${esc(T.workTitle)}</h2></div></div>
      <div class="tecB-wc" data-reveal>
        <div class="tecB-wc__in"><span class="tecB-wc__tag">${esc(T.inside)}</span>
          <div class="tecB-wc__row"><b>${esc(T.robot.n)}</b><p>${esc(T.robot.d)}</p></div>
        </div>
        <div class="tecB-wc__out"><span class="tecB-wc__tag">${esc(T.outside)}</span>
          <dl>
${T.outsideRows.map((r) => `            <div><dt>${esc(r.n)}</dt><dd>${esc(r.d)}</dd></div>`).join('\n')}
          </dl>
        </div>
      </div>
      <div class="enB-line" data-reveal>
        <p>${esc(T.bottomLine.replace('{gen}', generations).replace('{rnd}', rnd))}</p>
        <a class="btn btn--line btn--sm" href="../${pdfTech}" target="_blank" rel="noopener">${esc(T.pdfButton)}</a>
      </div>
    </div>
  </section>

</main>

` + footer();

/* ---------- 쪽 3: Contact ---------- */
const K = D.contact;
const contactPage = head({ file: 'contact.html', page: 'contact', title: K.title, desc: K.desc }) + header('contact') + `
<main id="main">
` + hero(K.heroTitle, '') + `
  <section class="section">
    <div class="wrap">
      <div class="ct-ways enB-ways" data-reveal>
        <div>
          <h3>${esc(K.phone)}</h3>
          <p class="ct-ways__main"><a href="tel:${intl(tel).replace(/-/g, '')}">${esc(intl(tel))}</a></p>
          <p class="ct-ways__sub">${esc(K.hours.replace('{hours}', hours.replace(' ~ ', '–')).replace('{fax}', intl(fax)))}</p>
        </div>
        <div>
          <h3>${esc(K.email)}</h3>
          <p class="ct-ways__main"><a href="mailto:${email}">${email}</a></p>
          <p class="ct-ways__sub">${esc(K.emailNote)}</p>
          <p class="ct-ways__act"><a class="btn btn--fill btn--sm" href="mailto:${email}">${esc(K.emailButton)}</a></p>
        </div>
        <div>
          <h3>${esc(K.address)}</h3>
          <p class="ct-ways__sub ct-ways__sub--lead">${esc(K.hqLine)}</p>
          <p class="ct-ways__sub">${esc(K.branchLine)}</p>
        </div>
      </div>
      <p class="note mt-24" data-reveal>${esc(K.privacy)}</p>
    </div>
  </section>

</main>

` + footer();

/* ---------- 쓰기: 화석(옛 전체 미러) 결과물은 지우고 3쪽만 남긴다 ---------- */
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).forEach((f) => {
  const p = path.join(OUT, f);
  if (f === 'js' && fs.statSync(p).isDirectory()) { fs.rmSync(p, { recursive: true, force: true }); return; }   // 옛 전체 미러의 번역된 JS
  if (/\.html$/.test(f) && !LITE_PAGES.includes(f)) fs.unlinkSync(p);
});
const out = { 'index.html': homePage, 'technology.html': techPage, 'contact.html': contactPage };
Object.keys(out).forEach((f) => fs.writeFileSync(path.join(OUT, f), out[f], 'utf8'));
console.log(`영문판(축약) 생성 완료: en/ ${Object.keys(out).length}쪽 (숫자 띠 ${stats.join('·')}, 설립 ${founded}, 연구소 ${rnd}, 로봇 ${generations}세대, 전화 ${intl(tel)}, 팩스 ${intl(fax)})`);
