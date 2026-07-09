// 중소벤처기업부 사업공고 수집 → data/announcements.json 병합 (최신 N건)
// data.go.kr: mssBizService_v2 / getbizList_v2 (XML)
// 사용: SERVICE_KEY=발급키 node scripts/fetch-mss.mjs  (.env 자동 로드)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "announcements.json");

async function loadEnv() {
  const p = join(ROOT, ".env");
  if (!existsSync(p)) return;
  const txt = await readFile(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
await loadEnv();

const KEY = process.env.SERVICE_KEY || process.env.CRTFC_KEY;
if (!KEY || KEY.includes("붙여넣기")) {
  console.error("❌ SERVICE_KEY 없음. .env 에 SERVICE_KEY=발급키 를 넣어주세요.");
  process.exit(1);
}

const ENDPOINT = "https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2";
const NUM_ROWS = 100;
const MAX_PAGES = 3; // 최신 ~300건만 (일일 트래픽 100 제한 고려)

// 간단 XML 필드 추출 (CDATA/빈태그 대응)
function tag(block, name) {
  const re = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

console.log("→ 중소벤처기업부 사업공고 수집...");
let raws = [];
for (let page = 1; page <= MAX_PAGES; page++) {
  const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(KEY)}&pageNo=${page}&numOfRows=${NUM_ROWS}`;
  const res = await fetch(url);
  const xml = await res.text();
  if (res.status === 401) { console.error("❌ 401 — 키 미활성/오류"); process.exit(1); }
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of items) {
    raws.push({
      id: "mss_" + tag(b, "itemId"),
      title: tag(b, "title"),
      dataContents: tag(b, "dataContents"),
      applicationStartDate: tag(b, "applicationStartDate"),
      applicationEndDate: tag(b, "applicationEndDate"),
      viewUrl: tag(b, "viewUrl"),
      agency: "중소벤처기업부",
      org: tag(b, "writerPosition"),
      field: "중기부 지원사업",
      region: "전국",
    });
  }
  console.log(`  page ${page}: ${items.length}건 (누적 ${raws.length})`);
  if (items.length < NUM_ROWS) break;
}

const normalized = raws.map(normalize).filter((a) => a.title && a.id !== "mss_");

// 병합 (ID 기준 upsert)
let prev = [];
if (existsSync(OUT)) { try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {} }
const map = new Map(prev.map((a) => [a.id, a]));
let added = 0;
for (const a of normalized) {
  if (!map.has(a.id)) added++;
  map.set(a.id, { ...map.get(a.id), ...a });
}
const merged = [...map.values()];

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(merged, null, 2), "utf8");
console.log(`✅ 병합 저장: ${OUT}`);
console.log(`   중기부 신규 ${added}건 / 수집 ${normalized.length}건 / 전체 누적 ${merged.length}건`);
