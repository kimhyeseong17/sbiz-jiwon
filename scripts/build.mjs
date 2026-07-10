// 정적 사이트 생성: data → dist/
// 사용: node scripts/build.mjs   (BUILD_DATE=YYYY-MM-DD 로 기준일 고정 가능)
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize, renderIndex, renderDetail, renderCategory, renderStaticPage, staticPages, renderSitemap, searchIndex, slug, ROBOTS } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const DATA = join(ROOT, "data", "announcements.json");
const SAMPLE = join(ROOT, "data", "sample.json");

const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

const src = existsSync(DATA) ? DATA : SAMPLE;
console.log(`→ 데이터 소스: ${src === DATA ? "announcements.json (실데이터)" : "sample.json (샘플)"}`);
const list = JSON.parse(await readFile(src, "utf8")).map(normalize).filter((a) => a.title);

// 마감 지난 지 30일 넘은 공고는 제외(SEO 위생) — 최근 마감은 유지
const alive = list.filter((a) => {
  if (!a.applyEnd) return true;
  const ms = Date.parse(a.applyEnd + "T00:00:00") - Date.parse(today + "T00:00:00");
  return ms >= -30 * 86400000;
});

// 카테고리 그룹핑 (지역별/분야별, 최소 건수 이상만)
const MIN_CAT = 5;
function groupBy(items, key) {
  const m = new Map();
  for (const a of items) {
    const v = (a[key] || "").trim();
    if (!v) continue;
    if (!m.has(v)) m.set(v, []);
    m.get(v).push(a);
  }
  return [...m.entries()]
    .filter(([, arr]) => arr.length >= MIN_CAT)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, arr]) => ({ name, slug: slug(name), count: arr.length, items: arr }));
}
const regionCats = groupBy(alive, "region");
const fieldCats = groupBy(alive, "field");
const cats = {
  region: regionCats.map(({ name, slug, count }) => ({ name, slug, count })),
  field: fieldCats.map(({ name, slug, count }) => ({ name, slug, count })),
};

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "g"), { recursive: true });
await mkdir(join(DIST, "r"), { recursive: true });
await mkdir(join(DIST, "c"), { recursive: true });

await writeFile(join(DIST, "index.html"), renderIndex(alive, today, cats), "utf8");
for (const a of alive) {
  await writeFile(join(DIST, "g", `${a.id}.html`), renderDetail(a, today), "utf8");
}
const catPaths = [];
for (const c of regionCats) {
  await writeFile(join(DIST, "r", `${c.slug}.html`), renderCategory({ kind: "r", name: c.name, items: c.items, today, cats }), "utf8");
  catPaths.push(`/r/${encodeURIComponent(c.slug)}.html`);
}
for (const c of fieldCats) {
  await writeFile(join(DIST, "c", `${c.slug}.html`), renderCategory({ kind: "c", name: c.name, items: c.items, today, cats }), "utf8");
  catPaths.push(`/c/${encodeURIComponent(c.slug)}.html`);
}
// 안내 페이지 (소개/개인정보/약관/문의)
const pages = staticPages(today);
for (const p of pages) {
  await writeFile(join(DIST, p.path.replace(/^\//, "")), renderStaticPage(p), "utf8");
  catPaths.push(p.path);
}
await writeFile(join(DIST, "sitemap.xml"), renderSitemap(alive, today, catPaths), "utf8");
await writeFile(join(DIST, "robots.txt"), ROBOTS, "utf8");
await writeFile(join(DIST, "search-index.json"), JSON.stringify(searchIndex(alive)), "utf8");

console.log(`✅ 생성 완료 (기준일 ${today})`);
console.log(`   index.html 1개`);
console.log(`   g/*.html ${alive.length}개 (공고 상세)`);
console.log(`   r/*.html ${regionCats.length}개 (지역별), c/*.html ${fieldCats.length}개 (분야별)`);
console.log(`   sitemap.xml (${1 + catPaths.length + alive.length} URL), robots.txt`);
console.log(`   (전체 ${list.length}건 중 ${list.length - alive.length}건은 마감 30일 경과로 제외)`);
