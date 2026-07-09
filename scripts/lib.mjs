// 공유 유틸: 정규화 + 날짜 + HTML 템플릿
// 의존성 0 (Node 내장만 사용)

export const SITE = {
  name: "지원금찾기",
  tagline: "소상공인·자영업 정부지원금 5분 만에 찾기",
  // 배포 도메인 (canonical·sitemap·OG태그 기준)
  baseUrl: "https://jovial-fairy-eb03cf.netlify.app",
  desc: "소상공인·자영업자를 위한 정부지원금·정책자금·창업지원사업을 업종·지역별로 쉽게 정리했습니다.",
};

export function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "20260701" | "2026-07-01" | "2026.07.01" → "2026-07-01"
export function normDate(v) {
  if (!v) return "";
  const digits = String(v).replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return String(v).trim();
}

// today: "YYYY-MM-DD" 기준 마감까지 남은 일수 (음수면 마감)
export function daysUntil(endDate, today) {
  if (!endDate) return null;
  const a = Date.parse(endDate + "T00:00:00");
  const b = Date.parse(today + "T00:00:00");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

// HTML 엔티티 디코드 + 태그 제거 + 공백 정리
export function cleanText(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

// 지원사업 공고 원본(기업마당/K-Startup) → 내부 표준 스키마로 정규화
export function normalize(raw) {
  // 원시값 우선 픽 (숫자 ID 등 clean 불필요)
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw[k] != null && String(raw[k]).trim() !== "") return String(raw[k]).trim();
    }
    return "";
  };
  // 텍스트 픽 (엔티티/태그 정리)
  const pickC = (...keys) => cleanText(pick(...keys));

  // 신청기간이 "20260701 ~ 20260815" 형태로 한 필드에 오는 경우 분해
  let start = pick("applyStart", "reqstBeginDe", "pbanc_rcpt_bgng_dt");
  let end = pick("applyEnd", "reqstEndDe", "pbanc_rcpt_end_dt");
  const range = pick("reqstBeginEndDe", "applyPeriod");
  if ((!start || !end) && range) {
    const parts = range.split(/[~∼-]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      start = start || parts[0];
      end = end || parts[parts.length - 1];
    }
  }

  // ID: K-Startup는 pbanc_sn(실제 공고번호). raw.id는 행번호라 쓰지 않음.
  const realId = pick("pbanc_sn", "pblancId", "id");

  // 공식 링크: K-Startup은 pbanc_sn으로 딥링크 구성이 가장 안정적
  let url = pick("sourceUrl", "pblancUrl", "biz_gdnc_url", "detl_pg_url", "rceptEngnHmpgUrl");
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
    summary: truncate(pickC("summary", "bsnsSumryCn", "pbanc_ctnt"), 220),
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ---- HTML 템플릿 ----

const CSS = `
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e8e8e8;--brand:#1b64da;--warn:#d64545;--soft:#f5f7fb}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,'Malgun Gothic',sans-serif;color:var(--fg);background:var(--bg);line-height:1.6}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:820px;margin:0 auto;padding:0 16px}
header.top{border-bottom:1px solid var(--line);padding:14px 0}
header.top .brand{font-size:20px;font-weight:800;color:var(--fg)}
header.top .tag{color:var(--mut);font-size:13px}
h1{font-size:22px;line-height:1.35;margin:18px 0 6px}
.meta{color:var(--mut);font-size:13px;margin-bottom:14px}
.card{display:block;border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;background:#fff;transition:.15s}
.card:hover{border-color:var(--brand);box-shadow:0 2px 10px rgba(27,100,218,.08);text-decoration:none}
.card h2{font-size:17px;margin:0 0 6px;color:var(--fg)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.tag{font-size:12px;background:var(--soft);color:#33507d;border-radius:999px;padding:3px 9px}
.badge{font-size:11px;font-weight:700;border-radius:6px;padding:2px 7px;margin-left:6px;vertical-align:middle}
.badge.new{background:#e7f1ff;color:var(--brand)}
.badge.soon{background:#fdecec;color:var(--warn)}
.summary{color:#333;font-size:14px;margin:6px 0}
table.info{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
table.info th{text-align:left;width:110px;color:var(--mut);font-weight:600;padding:8px 10px;vertical-align:top;background:var(--soft);border-bottom:1px solid var(--line)}
table.info td{padding:8px 10px;border-bottom:1px solid var(--line)}
.cta{display:block;text-align:center;background:var(--brand);color:#fff;border-radius:10px;padding:13px;font-weight:700;margin:18px 0}
.cta:hover{text-decoration:none;opacity:.92}
.lead{border:1px dashed var(--line);border-radius:10px;padding:14px;background:var(--soft);font-size:14px;margin:18px 0}
.notice{background:#fff9e6;border:1px solid #f0e3b0;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#7a6a2f;margin:16px 0}
footer{border-top:1px solid var(--line);margin-top:28px;padding:18px 0;color:var(--mut);font-size:12.5px}
.sec{font-size:15px;font-weight:800;margin:22px 0 4px}
@media (prefers-color-scheme:dark){
  :root{--bg:#16181d;--fg:#e9eaed;--mut:#9aa0aa;--line:#2c2f36;--soft:#1e2229}
  .card,header.top{background:transparent}
  .tag{color:#a9c2ef}
}
`;

function shell({ title, desc, canonical, body, jsonld = "" }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">${SITE.name}</a>
  <div class="tag">${escapeHtml(SITE.tagline)}</div>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">
  <p>본 사이트는 <b>공식 정부 사이트가 아닙니다.</b> 공고 정보는 기업마당 등 공개 데이터를 요약·재구성한 것으로,
  정확한 내용과 신청은 반드시 각 공고의 <b>공식 출처</b>에서 확인하세요.</p>
  <p>© ${SITE.name} · 정보 제공 목적 · 문의/제휴 환영</p>
</div></footer>
</body>
</html>`;
}

function card(a, today) {
  const d = daysUntil(a.applyEnd, today);
  let badge = "";
  if (d != null && d >= 0 && d <= 7) badge = `<span class="badge soon">D-${d} 마감임박</span>`;
  else if (isNew(a.registeredAt, today)) badge = `<span class="badge new">NEW</span>`;
  return `<a class="card" href="/g/${encodeURIComponent(a.id)}.html">
  <h2>${escapeHtml(a.title)}${badge}</h2>
  <div class="tags">
    <span class="tag">${escapeHtml(a.field || "지원")}</span>
    <span class="tag">${escapeHtml(a.region)}</span>
    <span class="tag">${escapeHtml(a.industry)}</span>
    ${a.amount ? `<span class="tag">💰 ${escapeHtml(a.amount)}</span>` : ""}
  </div>
  <div class="summary">${escapeHtml(a.summary || "")}</div>
  <div class="meta">신청 ~ ${escapeHtml(a.applyEnd || "상시")} · ${escapeHtml(a.org || a.agency)}</div>
</a>`;
}

function isNew(registeredAt, today) {
  const d = daysUntil(today, registeredAt); // today - registered
  return d != null && d >= 0 && d <= 7;
}

export function renderIndex(list, today) {
  const soon = list
    .filter((a) => {
      const d = daysUntil(a.applyEnd, today);
      return d != null && d >= 0 && d <= 7;
    })
    .sort((x, y) => (x.applyEnd || "").localeCompare(y.applyEnd || ""));
  const rest = list
    .filter((a) => !soon.includes(a))
    .sort((x, y) => (y.registeredAt || "").localeCompare(x.registeredAt || ""));

  const body = `
  <h1>소상공인·자영업 정부지원금 모음</h1>
  <div class="meta">총 ${list.length}건 · 매일 자동 업데이트 · 기준일 ${today}</div>
  <div class="lead">💡 원하는 <b>업종·지역</b>으로 좁혀서 보세요. 각 공고에서 "누가 / 얼마 / 언제까지 / 어떻게"를 3줄로 정리해 드립니다.</div>
  ${soon.length ? `<div class="sec">⏰ 이번 주 마감임박</div>${soon.map((a) => card(a, today)).join("")}` : ""}
  <div class="sec">📋 전체 지원사업</div>
  ${rest.map((a) => card(a, today)).join("")}
  `;
  return shell({
    title: `${SITE.name} — ${SITE.tagline}`,
    desc: SITE.desc,
    canonical: SITE.baseUrl + "/",
    body,
  });
}

export function renderDetail(a, today) {
  const d = daysUntil(a.applyEnd, today);
  const dtxt = d == null ? "상시/미정" : d < 0 ? "마감됨" : `마감 D-${d}`;
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `${a.title} 지원 대상은?`, acceptedAnswer: { "@type": "Answer", text: a.target || "공고 원문 참고" } },
      { "@type": "Question", name: "지원 금액은 얼마인가요?", acceptedAnswer: { "@type": "Answer", text: a.amount || "공고 원문 참고" } },
      { "@type": "Question", name: "언제까지 신청하나요?", acceptedAnswer: { "@type": "Answer", text: a.applyEnd ? `${a.applyEnd}까지` : "상시/공고 참고" } },
      { "@type": "Question", name: "어떻게 신청하나요?", acceptedAnswer: { "@type": "Answer", text: a.howto || "공식 출처에서 신청" } },
    ],
  };
  const body = `
  <h1>${escapeHtml(a.title)}</h1>
  <div class="tags">
    <span class="tag">${escapeHtml(a.field || "지원")}</span>
    <span class="tag">${escapeHtml(a.region)}</span>
    <span class="tag">${escapeHtml(a.industry)}</span>
    <span class="tag">${escapeHtml(dtxt)}</span>
  </div>
  <p class="summary">${escapeHtml(a.summary || "")}</p>
  <div class="sec">한눈에 보기 (누가 / 얼마 / 언제까지 / 어떻게)</div>
  <table class="info">
    <tr><th>지원 대상</th><td>${escapeHtml(a.target || "-")}</td></tr>
    <tr><th>지원 금액</th><td>${escapeHtml(a.amount || "-")}</td></tr>
    <tr><th>신청 기간</th><td>${escapeHtml(a.applyStart || "-")} ~ ${escapeHtml(a.applyEnd || "상시")}</td></tr>
    <tr><th>신청 방법</th><td>${escapeHtml(a.howto || "공식 출처에서 신청")}</td></tr>
    <tr><th>주관/수행</th><td>${escapeHtml([a.agency, a.org].filter(Boolean).join(" / ") || "-")}</td></tr>
  </table>
  ${a.sourceUrl ? `<a class="cta" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener">📄 공식 공고문 보러가기</a>` : ""}
  <div class="lead">
    <b>🧑‍💼 이 지원금, 내가 받을 수 있을지 헷갈리시나요?</b><br>
    세무·정책자금 전문가에게 무료로 물어보세요. <i>(제휴 상담 영역 — 추후 리드폼 연결)</i>
  </div>
  <div class="notice">⚠️ 지원 조건·마감은 변경될 수 있습니다. 신청 전 반드시 공식 공고문을 확인하세요.</div>
  <p><a href="/">← 다른 지원금 더 보기</a></p>
  `;
  return shell({
    title: `${a.title} | ${SITE.name}`,
    desc: `${a.title} — 대상: ${a.target || "소상공인"} / 금액: ${a.amount || "공고 참고"} / 신청 ~${a.applyEnd || "상시"}`,
    canonical: `${SITE.baseUrl}/g/${encodeURIComponent(a.id)}.html`,
    body,
    jsonld: JSON.stringify(faq),
  });
}

export function renderSitemap(list, today) {
  const urls = [`${SITE.baseUrl}/`, ...list.map((a) => `${SITE.baseUrl}/g/${encodeURIComponent(a.id)}.html`)];
  const items = urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

export const ROBOTS = `User-agent: *
Allow: /
Sitemap: ${SITE.baseUrl}/sitemap.xml
`;
