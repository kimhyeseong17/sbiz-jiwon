// 정적 사이트 생성: data → dist/
// 사용: node scripts/build.mjs   (BUILD_DATE=YYYY-MM-DD 로 기준일 고정 가능)
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize, renderIndex, renderDetail, renderSitemap, ROBOTS } from "./lib.mjs";

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

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "g"), { recursive: true });

await writeFile(join(DIST, "index.html"), renderIndex(alive, today), "utf8");
for (const a of alive) {
  await writeFile(join(DIST, "g", `${a.id}.html`), renderDetail(a, today), "utf8");
}
await writeFile(join(DIST, "sitemap.xml"), renderSitemap(alive, today), "utf8");
await writeFile(join(DIST, "robots.txt"), ROBOTS, "utf8");

console.log(`✅ 생성 완료 (기준일 ${today})`);
console.log(`   index.html 1개`);
console.log(`   g/*.html ${alive.length}개`);
console.log(`   sitemap.xml, robots.txt`);
console.log(`   (전체 ${list.length}건 중 ${list.length - alive.length}건은 마감 30일 경과로 제외)`);
