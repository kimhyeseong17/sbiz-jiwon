// 공유 유틸: 정규화 + 날짜 + HTML 템플릿 (의존성 0)

export const SITE = {
  name: "지원온",
  tagline: "소상공인·창업 정부지원금을 한눈에",
  baseUrl: "https://jovial-fairy-eb03cf.netlify.app",
  desc: "지원온 — 소상공인·자영업자·예비창업자를 위한 정부·지자체 지원사업을 매일 자동으로 모아 지역·분야별로 쉽게 찾을 수 있는 정보 서비스입니다.",
  // 검색엔진 소유권 확인용 (삭제 금지)
  googleVerification: "C3PipA9O20tJBMXDGbpjp8Yf-stMDBUm57gzBB0rezE",
  naverVerification: "67387dc167dcff6289229d0f0bfd5aaaec2989d9",
  contactEmail: "hatto3992@gmail.com",
};

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%232563eb'/%3E%3Ctext x='32' y='45' font-family='sans-serif' font-size='32' font-weight='700' fill='white' text-anchor='middle'%3E%EC%98%A8%3C/text%3E%3C/svg%3E";

export function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function normDate(v) {
  if (!v) return "";
  const digits = String(v).replace(/[^0-9]/g, "");
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return String(v).trim();
}

export function daysUntil(endDate, today) {
  if (!endDate) return null;
  const a = Date.parse(endDate + "T00:00:00");
  const b = Date.parse(today + "T00:00:00");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

export function cleanText(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&apos;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&nbsp;", " ").replaceAll("&amp;", "&")
    .replace(/\s+/g, " ").trim();
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

// 지원사업 공고 원본(기업마당/K-Startup/중기부) → 내부 표준 스키마
export function normalize(raw) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw[k] != null && String(raw[k]).trim() !== "") return String(raw[k]).trim();
    }
    return "";
  };
  const pickC = (...keys) => cleanText(pick(...keys));

  let start = pick("applyStart", "reqstBeginDe", "pbanc_rcpt_bgng_dt", "applicationStartDate");
  let end = pick("applyEnd", "reqstEndDe", "pbanc_rcpt_end_dt", "applicationEndDate");
  const range = pick("reqstBeginEndDe", "applyPeriod");
  if ((!start || !end) && range) {
    const parts = range.split(/[~∼-]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) { start = start || parts[0]; end = end || parts[parts.length - 1]; }
  }

  const realId = pick("pbanc_sn", "pblancId", "id");
  let url = pick("sourceUrl", "pblancUrl", "biz_gdnc_url", "detl_pg_url", "viewUrl", "rceptEngnHmpgUrl");
  const sn = pick("pbanc_sn");
  if (sn) url = `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=${sn}`;
  else if (url && url.startsWith("/")) url = "https://www.bizinfo.go.kr" + url;
  else if (url && !/^https?:\/\//.test(url)) url = "https://" + url;

  return {
    id: realId || "NOID_" + Math.abs(hash(pickC("title", "pblancNm", "biz_pbanc_nm"))),
    title: pickC("title", "pblancNm", "biz_pbanc_nm", "intg_pbanc_biz_nm"),
    field: pickC("field", "pldirSportRealmLclasCodeNm", "pldirSportRealmLclasCode", "supt_biz_clsfc"),
    agency: pickC("agency", "jrsdInsttNm", "pbanc_ntrp_nm", "sprv_inst"),
    org: pickC("org", "excInsttNm", "biz_prch_dprt_nm"),
    target: truncate(pickC("target", "trgetNm", "aply_trgt_ctnt", "aply_trgt"), 300),
    region: pickC("region", "supt_regin") || "전국",
    industry: pickC("industry", "biz_supt_bizn_rlm") || "전업종",
    amount: pickC("amount", "supt_scale"),
    applyStart: normDate(start),
    applyEnd: normDate(end),
    registeredAt: normDate(pick("registeredAt", "creatPnttm", "creat_dt")),
    sourceUrl: url,
    howto: pickC("howto", "biz_aply_url"),
    summary: truncate(pickC("summary", "bsnsSumryCn", "pbanc_ctnt", "dataContents"), 220),
  };
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

export function slug(s = "") {
  return String(s).trim().replace(/[^0-9A-Za-z가-힣]+/g, "-").replace(/^-+|-+$/g, "") || "etc";
}

// 마감 빠른 순 정렬(진행중 우선, 마감/미정 뒤)
function sortForList(list, today) {
  return list.slice().sort((x, y) => {
    const dx = daysUntil(x.applyEnd, today), dy = daysUntil(y.applyEnd, today);
    const ax = dx == null || dx < 0 ? 1 : 0, ay = dy == null || dy < 0 ? 1 : 0;
    if (ax !== ay) return ax - ay;
    if (ax === 0) return (x.applyEnd || "9999").localeCompare(y.applyEnd || "9999");
    return (y.registeredAt || "").localeCompare(x.registeredAt || "");
  });
}

// ---- CSS ----
const CSS = `
:root{--bg:#fff;--fg:#0f172a;--mut:#64748b;--line:#e6e9f0;--soft:#f5f7fc;--brand:#2563eb;--brand-d:#1d4ed8;--brand-soft:#eaf1ff;--warn:#dc2626;--ok:#0e9f6e;--card:#fff;--shadow:0 1px 2px rgba(15,23,42,.04),0 4px 16px rgba(15,23,42,.05);--radius:14px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:var(--fg);background:var(--bg);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:960px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--line)}
header.top .bar{display:flex;align-items:center;justify-content:space-between;height:58px}
.logo{font-size:21px;font-weight:800;letter-spacing:-.02em;color:var(--fg);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}
.logo b{color:var(--brand)}
.logo .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);margin-left:5px;box-shadow:0 0 0 3px rgba(14,159,110,.15)}
nav.gnb{display:flex;gap:4px;align-items:center}
nav.gnb a{color:var(--mut);font-size:14px;font-weight:600;padding:7px 11px;border-radius:9px}
nav.gnb a:hover{color:var(--fg);background:var(--soft);text-decoration:none}
.hero{background:linear-gradient(180deg,var(--brand-soft),transparent);border-bottom:1px solid var(--line);padding:46px 0 32px}
.hero h1{font-size:32px;line-height:1.25;letter-spacing:-.03em;margin:0 0 10px;font-weight:800}
.hero .sub{font-size:16px;color:var(--mut);margin:0 0 22px}
.search{display:flex;gap:8px;max-width:640px}
.search input{flex:1;font-size:16px;padding:15px 18px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);box-shadow:var(--shadow);outline:none}
.search input:focus{border-color:var(--brand)}
.search .sbtn{background:var(--brand);color:#fff;border:none;border-radius:12px;padding:0 22px;font-size:15px;font-weight:700;cursor:pointer}
.search .sbtn:hover{background:var(--brand-d)}
.statrow{display:flex;flex-wrap:wrap;gap:26px;margin-top:22px}
.stat{display:flex;flex-direction:column;color:var(--mut);font-size:13px}
.stat b{color:var(--fg);font-size:19px;font-weight:800;letter-spacing:-.02em}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:22px 0 6px}
select.f{font-size:14px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);cursor:pointer}
.sec{font-size:16px;font-weight:800;margin:24px 0 10px;letter-spacing:-.01em}
.rcount{color:var(--brand);font-weight:800}
.grid{display:grid;gap:12px}
.card{display:block;border:1px solid var(--line);border-radius:var(--radius);padding:17px 18px;background:var(--card);box-shadow:var(--shadow);transition:transform .12s,box-shadow .12s,border-color .12s}
.card:hover{border-color:var(--brand);box-shadow:0 8px 24px rgba(37,99,235,.10);transform:translateY(-2px);text-decoration:none}
.card h3{font-size:16.5px;line-height:1.4;margin:0 0 8px;color:var(--fg);font-weight:700}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px}
.tag{font-size:12px;background:var(--soft);color:#3b5486;border-radius:999px;padding:4px 10px;font-weight:600}
.tag.money{background:#eafaf1;color:#0e7a53}
.badge{font-size:11px;font-weight:800;border-radius:6px;padding:2px 7px;margin-left:7px;vertical-align:middle}
.badge.soon{background:#fdecec;color:var(--warn)}.badge.new{background:var(--brand-soft);color:var(--brand)}
.summary{color:#475569;font-size:13.5px;margin:6px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .meta{color:var(--mut);font-size:12.5px;margin-top:6px}
.meta{color:var(--mut);font-size:13px}
.chiprow{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 4px}
.chip{font-size:13px;background:var(--card);color:#3b5486;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-weight:600;cursor:pointer}
.chip:hover{border-color:var(--brand);text-decoration:none}
.chip.chip-on{background:var(--brand);color:#fff;border-color:var(--brand)}
.chip b{color:var(--mut);font-weight:600;font-size:11px;margin-left:3px}.chip.chip-on b{color:#dbe6ff}
.crumb{color:var(--mut);font-size:13px;margin:18px 0 6px}
.dtitle{font-size:25px;line-height:1.3;letter-spacing:-.02em;margin:6px 0 12px;font-weight:800}
.panel{border:1px solid var(--line);border-radius:var(--radius);background:var(--card);box-shadow:var(--shadow);padding:4px 18px;margin:16px 0}
table.info{width:100%;border-collapse:collapse;font-size:14.5px}
table.info th{text-align:left;width:92px;color:var(--mut);font-weight:600;padding:13px 8px;vertical-align:top;border-bottom:1px solid var(--line)}
table.info td{padding:13px 8px;border-bottom:1px solid var(--line)}
table.info tr:last-child th,table.info tr:last-child td{border-bottom:none}
.cta{display:block;text-align:center;background:var(--brand);color:#fff;border-radius:12px;padding:15px;font-weight:800;margin:18px 0;box-shadow:0 6px 18px rgba(37,99,235,.25)}
.cta:hover{text-decoration:none;background:var(--brand-d)}
.lead{border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;background:var(--soft);font-size:14px;margin:18px 0}
.notice{background:#fff8ec;border:1px solid #f2e2b6;border-radius:10px;padding:11px 14px;font-size:12.5px;color:#8a6d23;margin:16px 0}
.morelinks{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
footer{border-top:1px solid var(--line);margin-top:44px;padding:28px 0 44px;color:var(--mut);font-size:12.5px;background:var(--soft)}
footer a{color:var(--mut)}footer .fbrand{font-weight:800;color:var(--fg);font-size:15px}
.rnote{display:none;color:var(--mut);font-size:13px;margin-top:12px;text-align:center}
h1,h2,h3{letter-spacing:-.01em}
.stitle{font-size:21px;font-weight:800;margin:38px 0 2px;letter-spacing:-.02em}
.stitle span{display:block;font-size:14px;font-weight:500;color:var(--mut);margin-top:5px}
.trust{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0 8px}
.ti{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:15px 16px;box-shadow:var(--shadow)}
.ti b{display:block;font-size:14px;margin-bottom:3px}.ti .ck{color:var(--ok);font-weight:800;margin-right:5px}
.ti p{margin:0;font-size:12.5px;color:var(--mut);line-height:1.5}
.catcards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0}
.catcard{display:block;border:1px solid var(--line);border-radius:14px;background:var(--card);box-shadow:var(--shadow);padding:16px 17px;transition:transform .12s,box-shadow .12s,border-color .12s}
.catcard:hover{border-color:var(--brand);transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.10);text-decoration:none}
.catcard .ic{font-size:23px}
.catcard h3{margin:9px 0 3px;font-size:15.5px;color:var(--fg)}
.catcard p{margin:0;font-size:12.5px;color:var(--mut);line-height:1.5}
.catcard .cnt{display:inline-block;margin-top:9px;font-size:12px;font-weight:800;color:var(--brand);background:var(--brand-soft);border-radius:999px;padding:2px 10px}
.how{margin:8px 0}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}
.step{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:18px;box-shadow:var(--shadow)}
.step .n{width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px}
.step h3{margin:11px 0 4px;font-size:15.5px}.step p{margin:0;font-size:13px;color:var(--mut);line-height:1.55}
.faq details{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:0 16px;margin:10px 0;box-shadow:var(--shadow)}
.faq summary{cursor:pointer;font-weight:700;padding:15px 0;font-size:15px;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";float:right;color:var(--mut);font-weight:800;font-size:18px}
.faq details[open] summary::after{content:"−"}
.faq p{margin:0 0 15px;font-size:14px;color:#475569;line-height:1.6}
@media (max-width:640px){.trust,.catcards,.steps{grid-template-columns:1fr}}
@media (prefers-color-scheme:dark){.faq p{color:#aeb6c2}}
@media (max-width:560px){.hero h1{font-size:25px}.hero{padding:32px 0 24px}.dtitle{font-size:21px}nav.gnb{gap:0}nav.gnb a{padding:6px 7px;font-size:13px}.logo{font-size:19px}.wrap{padding:0 15px}.statrow{gap:16px}.search .sbtn{padding:0 15px}}
@media (prefers-color-scheme:dark){
 :root{--bg:#0d1117;--fg:#e8eaed;--mut:#9aa4b2;--line:#232a35;--soft:#161b22;--card:#141a22;--brand:#4f8cff;--brand-d:#3b7bf0;--brand-soft:#152238;--shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.35)}
 header.top{background:rgba(13,17,23,.85)}
 .tag{color:#a9c2ef}.tag.money{background:#0f2a1e;color:#57d09a}.summary{color:#aeb6c2}
 .notice{background:#241f10;border-color:#3d3413;color:#d8c78a}
}
`;

function shell({ title, desc, canonical, body, jsonld = "" }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="${FAVICON}">
${SITE.googleVerification ? `<meta name="google-site-verification" content="${SITE.googleVerification}">` : ""}
${SITE.naverVerification ? `<meta name="naver-site-verification" content="${SITE.naverVerification}">` : ""}
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
</head>
<body>
<header class="top"><div class="wrap bar">
  <a class="logo" href="/">지원<b>온</b><span class="dot"></span></a>
  <nav class="gnb">
    <a href="/#browse">지역·분야</a>
    <a href="/about.html">소개</a>
    <a href="/contact.html">문의</a>
  </nav>
</div></header>
<main>
${body}
</main>
<footer><div class="wrap">
  <p class="fbrand">${SITE.name}</p>
  <p>소상공인·창업 정부지원금을 매일 자동으로 모아 드립니다.</p>
  <p>본 사이트는 <b>공식 정부 사이트가 아닙니다.</b> 공고 정보는 공공데이터포털 등 공개 데이터를 요약·재구성한 것으로, 정확한 내용과 신청은 반드시 각 공고의 <b>공식 출처</b>에서 확인하세요.</p>
  <p><a href="/about.html">소개</a> · <a href="/privacy.html">개인정보처리방침</a> · <a href="/terms.html">이용약관·면책</a> · <a href="/contact.html">문의·제휴</a></p>
  <p>© ${SITE.name} · 정보 제공 목적</p>
</div></footer>
</body>
</html>`;
}

function card(a, today) {
  const d = daysUntil(a.applyEnd, today);
  let badge = "";
  if (d != null && d >= 0 && d <= 7) badge = `<span class="badge soon">D-${d}</span>`;
  else if (isNew(a.registeredAt, today)) badge = `<span class="badge new">NEW</span>`;
  return `<a class="card" href="/g/${encodeURIComponent(a.id)}.html">
  <h3>${escapeHtml(a.title)}${badge}</h3>
  <div class="tags"><span class="tag">${escapeHtml(a.field || "지원")}</span><span class="tag">${escapeHtml(a.region)}</span>${a.amount ? `<span class="tag money">💰 ${escapeHtml(truncate(a.amount, 24))}</span>` : ""}</div>
  ${a.summary ? `<p class="summary">${escapeHtml(a.summary)}</p>` : ""}
  <div class="meta">신청 ~ ${escapeHtml(a.applyEnd || "상시")} · ${escapeHtml(a.org || a.agency || "")}</div>
</a>`;
}

function isNew(registeredAt, today) {
  const d = daysUntil(today, registeredAt);
  return d != null && d >= 0 && d <= 7;
}

function catNav(cats, activeKey = "") {
  const row = (label, kind, arr) =>
    arr && arr.length
      ? `<div class="sec">${label}</div><div class="chiprow">${arr
          .map((c) => {
            const on = `${kind}:${c.name}` === activeKey ? " chip-on" : "";
            return `<a class="chip${on}" href="/${kind}/${encodeURIComponent(c.slug)}.html">${escapeHtml(c.name)} <b>${c.count}</b></a>`;
          }).join("")}</div>`
      : "";
  return row("📍 지역별로 찾기", "r", cats.region) + row("🗂 분야별로 찾기", "c", cats.field);
}

// 홈: 검색·필터(클라이언트) 클라이언트 스크립트 (자기완결 함수 → 소스 직렬화)
function CLIENT_FN() {
  var T = window.__T__;
  var idx = [], st = { q: "", region: "", field: "", soon: false };
  var $ = function (s) { return document.querySelector(s); };
  function dU(e) { if (!e) return null; var a = Date.parse(e + "T00:00:00"), b = Date.parse(T + "T00:00:00"); if (isNaN(a) || isNaN(b)) return null; return Math.round((a - b) / 86400000); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bdg(e) { var d = dU(e); return d != null && d >= 0 && d <= 7 ? '<span class="badge soon">D-' + d + "</span>" : ""; }
  function trc(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }
  function cardH(a) {
    var tags = '<span class="tag">' + esc(a.f || "지원") + '</span><span class="tag">' + esc(a.r) + "</span>" + (a.m ? '<span class="tag money">💰 ' + esc(trc(a.m, 24)) + "</span>" : "");
    return '<a class="card" href="/g/' + encodeURIComponent(a.id) + '.html"><h3>' + esc(a.t) + bdg(a.e) + '</h3><div class="tags">' + tags + "</div>" + (a.s ? '<p class="summary">' + esc(a.s) + "</p>" : "") + '<div class="meta">신청 ~ ' + esc(a.e || "상시") + " · " + esc(a.o || "") + "</div></a>";
  }
  function run() {
    var q = st.q.trim().toLowerCase();
    var res = idx.filter(function (a) {
      if (st.region && a.r !== st.region) return false;
      if (st.field && a.f !== st.field) return false;
      if (st.soon) { var d = dU(a.e); if (!(d != null && d >= 0 && d <= 7)) return false; }
      if (q) { var h = ((a.t || "") + " " + (a.g || "") + " " + (a.r || "") + " " + (a.f || "") + " " + (a.o || "")).toLowerCase(); if (h.indexOf(q) < 0) return false; }
      return true;
    });
    res.sort(function (x, y) {
      var dx = dU(x.e), dy = dU(y.e), ax = dx == null || dx < 0 ? 1 : 0, ay = dy == null || dy < 0 ? 1 : 0;
      if (ax !== ay) return ax - ay;
      if (ax === 0) return (x.e || "9999").localeCompare(y.e || "9999");
      return (y.n || "").localeCompare(x.n || "");
    });
    var cnt = $("#rcount"); if (cnt) cnt.textContent = res.length.toLocaleString();
    var CAP = 120, box = $("#results");
    box.innerHTML = res.slice(0, CAP).map(cardH).join("") || '<p class="meta">조건에 맞는 지원사업이 없어요. 검색어나 필터를 바꿔보세요.</p>';
    var note = $("#rnote"); if (note) note.style.display = res.length > CAP ? "block" : "none";
  }
  function wire() {
    var q = $("#q"); if (q) { var t; q.addEventListener("input", function () { st.q = q.value; clearTimeout(t); t = setTimeout(run, 160); }); }
    var b = $("#sbtn"); if (b) b.addEventListener("click", function () { run(); var r = $("#results"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); });
    var rr = $("#fRegion"); if (rr) rr.addEventListener("change", function () { st.region = rr.value; run(); });
    var ff = $("#fField"); if (ff) ff.addEventListener("change", function () { st.field = ff.value; run(); });
    var sn = $("#fSoon"); if (sn) sn.addEventListener("click", function () { st.soon = !st.soon; sn.classList.toggle("chip-on", st.soon); run(); });
  }
  fetch("/search-index.json").then(function (r) { return r.json(); }).then(function (d) { idx = d; wire(); run(); }).catch(function () {});
}

const FIELD_META = {
  "사업화": { ic: "🚀", d: "시제품 제작·마케팅 등 사업화 자금" },
  "멘토링ㆍ컨설팅ㆍ교육": { ic: "🧑‍🏫", d: "전문가 멘토링·컨설팅·교육" },
  "시설ㆍ공간ㆍ보육": { ic: "🏢", d: "사무공간·입주·창업보육" },
  "행사ㆍ네트워크": { ic: "🤝", d: "데모데이·네트워킹·행사" },
  "창업교육": { ic: "📚", d: "창업 기초·실전 교육 과정" },
  "판로ㆍ해외진출": { ic: "📦", d: "판로개척·수출·해외진출" },
  "글로벌": { ic: "🌍", d: "해외 진출·글로벌 프로그램" },
  "기술개발(R&D)": { ic: "🔬", d: "기술개발 R&D 자금" },
  "중기부 지원사업": { ic: "🏛", d: "중소벤처기업부 지원 공고" },
  "정책자금": { ic: "💰", d: "융자·정책자금 지원" },
  "융자ㆍ보증": { ic: "🏦", d: "융자·신용보증 지원" },
  "인력": { ic: "👥", d: "인력 채용·양성 지원" },
};

const FAQ = [
  { q: "지원온은 어떤 서비스인가요?", a: "소상공인·자영업자·예비창업자를 위한 정부·지자체 지원사업을 매일 자동으로 모아 지역·분야별로 쉽게 찾도록 정리하는 정보 서비스입니다. 공식 정부 사이트는 아닙니다." },
  { q: "정보는 정확한가요?", a: "공공데이터포털(K-Startup·중소벤처기업부 등)의 공식 오픈API를 기반으로 매일 갱신합니다. 다만 지원 조건·마감은 변경될 수 있어, 신청 전 각 지원사업의 공식 공고문을 반드시 확인하셔야 합니다." },
  { q: "신청은 어디서 하나요?", a: "각 지원사업 상세페이지의 '공식 공고문' 버튼을 누르면 해당 기관의 공식 신청 페이지로 이동합니다. 지원온은 신청 대행이나 정책자금 중개를 하지 않습니다." },
  { q: "이용 요금이 있나요?", a: "무료입니다. 회원가입 없이 모든 지원사업 정보를 열람할 수 있습니다." },
];

export function renderIndex(list, today, cats = { region: [], field: [] }) {
  const sorted = sortForList(list, today);
  const ssr = sorted.slice(0, 60).map((a) => card(a, today)).join("");
  const opt = (arr) => arr.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.count})</option>`).join("");

  const fieldCards = cats.field.slice(0, 9).map((c) => {
    const m = FIELD_META[c.name] || { ic: "📋", d: "지원사업 모음" };
    return `<a class="catcard" href="/c/${encodeURIComponent(c.slug)}.html"><div class="ic">${m.ic}</div><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(m.d)}</p><span class="cnt">${c.count}건</span></a>`;
  }).join("");
  const regionChips = cats.region.map((c) => `<a class="chip" href="/r/${encodeURIComponent(c.slug)}.html">${escapeHtml(c.name)} <b>${c.count}</b></a>`).join("");

  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  const body = `
<section class="hero"><div class="wrap">
  <h1>흩어진 정부지원금,<br>${SITE.name}에서 한 번에 찾으세요</h1>
  <p class="sub">소상공인·자영업·예비창업자를 위한 정부·지자체 지원사업을 <b>공공데이터 기반</b>으로 매일 자동 정리합니다.</p>
  <div class="search">
    <input id="q" type="search" placeholder="🔍 사업명·지역·분야로 검색 (예: 서울 창업, 소상공인 자금)" aria-label="지원사업 검색">
    <button class="sbtn" id="sbtn">검색</button>
  </div>
  <div class="statrow">
    <div class="stat"><b>${list.length.toLocaleString()}</b>진행 중 지원사업</div>
    <div class="stat"><b>${cats.region.length}</b>개 지역</div>
    <div class="stat"><b>${cats.field.length}</b>개 분야</div>
    <div class="stat"><b>매일</b>자동 업데이트</div>
  </div>
</div></section>

<div class="wrap">
  <div class="trust">
    <div class="ti"><b><span class="ck">✓</span>공공데이터 출처 공개</b><p>K-Startup·중소벤처기업부 등 공식 공공데이터를 사용합니다.</p></div>
    <div class="ti"><b><span class="ck">✓</span>매일 자동 업데이트</b><p>새 공고와 마감 정보를 매일 갱신해 최신 상태를 유지합니다.</p></div>
    <div class="ti"><b><span class="ck">✓</span>공식 공고 링크 제공</b><p>각 지원사업의 공식 신청 페이지로 바로 연결합니다.</p></div>
  </div>

  <h2 class="stitle">분야별로 골라보세요<span>내 상황에 맞는 지원사업을 빠르게 찾을 수 있어요</span></h2>
  <div class="catcards">${fieldCards}</div>

  <h2 class="stitle" id="browse">전체 지원사업 검색<span>지역·분야·키워드로 원하는 지원금을 즉시 필터링하세요</span></h2>
  <div class="filters">
    <select class="f" id="fRegion"><option value="">📍 지역 전체</option>${opt(cats.region)}</select>
    <select class="f" id="fField"><option value="">🗂 분야 전체</option>${opt(cats.field)}</select>
    <span class="chip" id="fSoon">⏰ 마감임박만</span>
  </div>
  <div class="sec" style="margin-top:12px">검색 결과 <span id="rcount" class="rcount">${list.length.toLocaleString()}</span>건</div>
  <div class="grid" id="results">${ssr}</div>
  <p class="rnote" id="rnote">더 많은 결과가 있어요. 위 검색·필터로 좁혀보세요.</p>

  <h2 class="stitle">지역별로 찾기<span>내 지역의 소상공인·창업 지원사업 모음</span></h2>
  <div class="chiprow">${regionChips}</div>

  <section class="how">
    <h2 class="stitle">지원온, 이렇게 이용하세요<span>복잡한 정부지원금, 3단계로 끝</span></h2>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>검색·필터</h3><p>지역·분야·키워드로 내게 맞는 지원사업을 빠르게 찾습니다.</p></div>
      <div class="step"><div class="n">2</div><h3>핵심 요약 확인</h3><p>누가·얼마·언제까지·어떻게를 한눈에 확인합니다.</p></div>
      <div class="step"><div class="n">3</div><h3>공식 신청</h3><p>공식 공고문 링크로 이동해 바로 신청합니다.</p></div>
    </div>
  </section>

  <section class="faq">
    <h2 class="stitle">자주 묻는 질문</h2>
    ${FAQ.map((f) => `<details><summary>${escapeHtml(f.q)}</summary><p>${escapeHtml(f.a)}</p></details>`).join("")}
  </section>
</div>
<script>window.__T__=${JSON.stringify(today)};(${CLIENT_FN.toString()})();</script>`;

  return shell({
    title: `${SITE.name} — ${SITE.tagline}`,
    desc: SITE.desc,
    canonical: SITE.baseUrl + "/",
    body,
    jsonld: JSON.stringify(faqLd),
  });
}

export function renderCategory({ kind, name, items, today, cats }) {
  const labelKo = kind === "r" ? "지역" : "분야";
  const sorted = sortForList(items, today);
  const h1 = kind === "r" ? `${name} 창업·소상공인 지원사업 모음` : `${name} 분야 창업지원사업 모음`;
  const intro = kind === "r"
    ? `${name} 지역 소상공인·예비창업자가 신청할 수 있는 정부·지자체 지원사업 ${items.length}건을 모았습니다. 마감 임박 순으로 정리했으니 놓치지 마세요.`
    : `'${name}' 분야의 창업·소상공인 지원사업 ${items.length}건입니다. 대상·금액·신청기간을 한눈에 확인하고 바로 신청하세요.`;
  const body = `<div class="wrap">
  <p class="crumb"><a href="/">홈</a> › ${labelKo}별 › ${escapeHtml(name)}</p>
  <h1 class="dtitle">${escapeHtml(h1)}</h1>
  <div class="lead">${escapeHtml(intro)}</div>
  ${catNav(cats, `${kind}:${name}`)}
  <div class="sec">📋 ${escapeHtml(name)} 지원사업 ${items.length}건</div>
  <div class="grid">${sorted.map((a) => card(a, today)).join("")}</div>
  <p style="margin-top:18px"><a href="/">← 전체 지원사업 보기</a></p>
</div>`;
  return shell({
    title: `${name} 지원사업 ${items.length}건 | ${SITE.name}`,
    desc: intro,
    canonical: `${SITE.baseUrl}/${kind}/${encodeURIComponent(slug(name))}.html`,
    body,
  });
}

export function renderDetail(a, today) {
  const d = daysUntil(a.applyEnd, today);
  const dtxt = d == null ? "상시/미정" : d < 0 ? "마감됨" : `D-${d}`;
  const badge = d != null && d >= 0 && d <= 7 ? `<span class="badge soon">${dtxt} 마감임박</span>` : "";
  const faq = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `${a.title} 지원 대상은?`, acceptedAnswer: { "@type": "Answer", text: a.target || "공고 원문 참고" } },
      { "@type": "Question", name: "지원 금액은 얼마인가요?", acceptedAnswer: { "@type": "Answer", text: a.amount || "공고 원문 참고" } },
      { "@type": "Question", name: "언제까지 신청하나요?", acceptedAnswer: { "@type": "Answer", text: a.applyEnd ? `${a.applyEnd}까지` : "상시/공고 참고" } },
      { "@type": "Question", name: "어떻게 신청하나요?", acceptedAnswer: { "@type": "Answer", text: a.howto || "공식 출처에서 신청" } },
    ],
  };
  const body = `<div class="wrap">
  <p class="crumb"><a href="/">홈</a> › <a href="/r/${encodeURIComponent(slug(a.region))}.html">${escapeHtml(a.region)}</a> › 지원사업</p>
  <h1 class="dtitle">${escapeHtml(a.title)}${badge}</h1>
  <div class="tags"><span class="tag">${escapeHtml(a.field || "지원")}</span><span class="tag">${escapeHtml(a.region)}</span>${a.amount ? `<span class="tag money">💰 ${escapeHtml(truncate(a.amount, 30))}</span>` : ""}</div>
  ${a.summary ? `<p class="summary" style="-webkit-line-clamp:unset;color:var(--fg);font-size:15px;margin:14px 0">${escapeHtml(a.summary)}</p>` : ""}
  <div class="sec">한눈에 보기 · 누가 / 얼마 / 언제까지 / 어떻게</div>
  <div class="panel"><table class="info">
    <tr><th>지원 대상</th><td>${escapeHtml(a.target || "-")}</td></tr>
    <tr><th>지원 내용</th><td>${escapeHtml(a.amount || "공고 참고")}</td></tr>
    <tr><th>신청 기간</th><td>${escapeHtml(a.applyStart || "-")} ~ ${escapeHtml(a.applyEnd || "상시")} ${d != null && d >= 0 ? `<b style="color:var(--warn)">(${dtxt})</b>` : ""}</td></tr>
    <tr><th>신청 방법</th><td>${escapeHtml(a.howto || "아래 '공식 공고문'에서 신청")}</td></tr>
    <tr><th>주관/수행</th><td>${escapeHtml([a.agency, a.org].filter(Boolean).join(" / ") || "-")}</td></tr>
  </table></div>
  ${a.sourceUrl ? `<a class="cta" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener">📄 공식 공고문에서 신청하기 →</a>` : ""}
  <div class="lead"><b>🧑‍💼 이 지원금, 내가 받을 수 있을지 헷갈리시나요?</b><br>세무·정책자금 전문가에게 무료로 물어보세요. <i>(제휴 상담 — 추후 연결 예정)</i></div>
  <div class="morelinks">
    <a class="chip" href="/r/${encodeURIComponent(slug(a.region))}.html">📍 ${escapeHtml(a.region)} 지원사업 더 보기</a>
    ${a.field ? `<a class="chip" href="/c/${encodeURIComponent(slug(a.field))}.html">🗂 ${escapeHtml(a.field)} 더 보기</a>` : ""}
  </div>
  <div class="notice">⚠️ 지원 조건·마감은 변경될 수 있습니다. 신청 전 반드시 공식 공고문을 확인하세요.</div>
  <p><a href="/">← 다른 지원사업 검색하기</a></p>
</div>`;
  return shell({
    title: `${a.title} | ${SITE.name}`,
    desc: `${a.title} — 대상: ${a.target || "소상공인"} / 금액: ${a.amount || "공고 참고"} / 신청 ~${a.applyEnd || "상시"}`,
    canonical: `${SITE.baseUrl}/g/${encodeURIComponent(a.id)}.html`,
    body, jsonld: JSON.stringify(faq),
  });
}

// 홈 검색용 인덱스 (경량 필드)
export function searchIndex(list) {
  return list.map((a) => ({
    id: a.id, t: a.title, r: a.region, f: a.field, m: a.amount,
    e: a.applyEnd, o: a.org || a.agency || "", s: a.summary || "",
    g: (a.target || "").slice(0, 80), n: a.registeredAt || "",
  }));
}

export function renderSitemap(list, today, extraPaths = []) {
  const urls = [
    `${SITE.baseUrl}/`,
    ...extraPaths.map((p) => `${SITE.baseUrl}${p}`),
    ...list.map((a) => `${SITE.baseUrl}/g/${encodeURIComponent(a.id)}.html`),
  ];
  const items = urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

export const ROBOTS = `User-agent: *
Allow: /
Sitemap: ${SITE.baseUrl}/sitemap.xml
`;

export function renderStaticPage({ path, title, desc, bodyHtml }) {
  return shell({
    title: `${title} | ${SITE.name}`,
    desc: desc || title,
    canonical: `${SITE.baseUrl}${path}`,
    body: `<div class="wrap"><p class="crumb"><a href="/">홈</a> › ${escapeHtml(title)}</p>\n<h1 class="dtitle">${escapeHtml(title)}</h1>\n${bodyHtml}</div>`,
  });
}

export function staticPages(today) {
  const email = SITE.contactEmail || "(문의 이메일 준비 중)";
  return [
    {
      path: "/about.html", title: "소개",
      desc: `${SITE.name}는 소상공인·예비창업자를 위해 정부·공공기관 지원사업 공고를 모아 쉽게 정리하는 정보 서비스입니다.`,
      bodyHtml: `
<p><b>${SITE.name}</b>는 소상공인·자영업자·예비창업자가 자신에게 맞는 <b>정부·공공기관 지원사업</b>을 빠르게 찾도록 돕는 정보 서비스입니다.</p>
<div class="sec">무엇을 하나요?</div>
<p>흩어져 있는 지원사업 공고를 한 곳에 모아 "누가 / 얼마 / 언제까지 / 어떻게" 신청하는지 쉽게 정리하고, 지역·분야별로 찾아볼 수 있게 제공합니다.</p>
<div class="sec">데이터 출처</div>
<p>공공데이터포털(data.go.kr)의 오픈API — <b>창업진흥원 K-Startup</b>, <b>중소벤처기업부 사업공고</b> 등에서 공개된 정보를 매일 자동으로 수집·요약합니다.</p>
<div class="notice">⚠️ 본 사이트는 <b>공식 정부 사이트가 아닙니다.</b> 지원 조건·마감은 변경될 수 있으며, 정확한 내용과 신청은 반드시 각 공고의 공식 출처에서 확인하세요.</div>
<p><a href="/">← 지원사업 둘러보기</a></p>`,
    },
    {
      path: "/privacy.html", title: "개인정보처리방침", desc: `${SITE.name} 개인정보처리방침`,
      bodyHtml: `
<p>${SITE.name}(이하 "사이트")는 이용자의 개인정보를 중요하게 생각하며, 아래와 같이 처리방침을 안내합니다. (시행일: ${today})</p>
<div class="sec">1. 수집하는 개인정보</div>
<p>본 사이트는 회원가입 없이 자유롭게 열람할 수 있으며, 별도의 개인정보를 직접 수집하지 않습니다. 향후 상담 신청 등 기능 도입 시, 수집 항목·목적·보유기간을 별도로 고지하고 동의를 받습니다.</p>
<div class="sec">2. 쿠키 및 광고</div>
<p>본 사이트는 서비스 운영을 위해 Google AdSense 등 제3자 광고를 게재할 수 있습니다. 광고 사업자는 쿠키를 사용하여 이용자의 관심에 기반한 광고를 제공할 수 있습니다. 이용자는 브라우저 설정 또는 <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 거부할 수 있습니다.</p>
<div class="sec">3. 접속 통계</div>
<p>서비스 개선을 위해 접속 통계 도구(예: Google Analytics)를 통해 비식별 통계 정보를 수집할 수 있습니다.</p>
<div class="sec">4. 문의</div>
<p>개인정보 관련 문의: ${escapeHtml(email)}</p>
<p><a href="/">← 홈으로</a></p>`,
    },
    {
      path: "/terms.html", title: "이용약관·면책", desc: `${SITE.name} 이용약관 및 면책 고지`,
      bodyHtml: `
<div class="sec">정보 제공 목적</div>
<p>본 사이트가 제공하는 모든 정보는 <b>참고용</b>이며, 지원사업의 정확성·완전성을 보증하지 않습니다. 최종 지원 조건·마감·자격은 반드시 각 공고의 <b>공식 출처</b>에서 확인하시기 바랍니다.</p>
<div class="sec">대행·중개가 아님</div>
<p>본 사이트는 <b>지원금 신청 대행이나 정책자금 중개(브로커) 서비스가 아닙니다.</b> 순수 정보 제공 및 합법적 제휴만을 목적으로 합니다.</p>
<div class="sec">저작권 및 출처</div>
<p>공고 원문의 저작권은 각 발행 기관에 있으며, 본 사이트는 공개 데이터를 요약·재구성하여 제공합니다. 각 공고에는 공식 출처 링크를 함께 표기합니다.</p>
<div class="sec">외부 링크</div>
<p>본 사이트에서 연결되는 외부 사이트의 내용·정책에 대해서는 책임지지 않습니다.</p>
<p><a href="/">← 홈으로</a></p>`,
    },
    {
      path: "/contact.html", title: "문의·제휴", desc: `${SITE.name} 문의 및 제휴 안내`,
      bodyHtml: `
<p>서비스 개선 제안, 오류 신고, 광고·제휴 문의를 환영합니다.</p>
<div class="panel"><table class="info">
  <tr><th>이메일</th><td>${escapeHtml(email)}</td></tr>
  <tr><th>운영</th><td>${SITE.name} 운영팀</td></tr>
</table></div>
<p>공고 정보의 오류나 마감된 사업을 발견하시면 알려주세요. 빠르게 반영하겠습니다.</p>
<p><a href="/">← 홈으로</a></p>`,
    },
  ];
}
