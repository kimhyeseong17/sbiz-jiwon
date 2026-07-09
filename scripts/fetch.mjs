// K-Startup(창업진흥원) 지원사업 공고 수집 → data/announcements.json (ID 기준 upsert)
// data.go.kr 오픈API: kisedKstartupService01 / getAnnouncementInformation01
// 사용: SERVICE_KEY=발급키 node scripts/fetch.mjs   (.env 자동 로드)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "announcements.json");

// .env 간단 로더 (의존성 0)
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
  console.error("❌ SERVICE_KEY 없음. .env 에 SERVICE_KEY=발급키 를 넣거나 환경변수로 전달하세요.");
  console.error("   (키 없이도 build.mjs 는 data/sample.json 으로 사이트를 생성합니다.)");
  process.exit(1);
}

const ENDPOINT = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";
const PER_PAGE = 100;
const MAX_PAGES = 10; // 개발계정 트래픽 보호

async function fetchPage(page) {
  const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(KEY)}&page=${page}&perPage=${PER_PAGE}&returnType=json`;
  const res = await fetch(url);
  const text = await res.text();
  if (res.status === 401) {
    throw new Error("401 인증 실패 — 키가 아직 활성화되지 않았을 수 있음(승인 후 최대 1시간). 잠시 후 재시도.");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("JSON 파싱 실패: " + text.slice(0, 200)); }
  // 응답에서 배열(data/items) 추출
  const arr = json.data || json.items || (Array.isArray(json) ? json : []);
  return { rows: Array.isArray(arr) ? arr : [], total: json.totalCount ?? json.matchCount ?? null };
}

console.log("→ K-Startup 지원사업 공고 수집...");
let collected = [];
for (let page = 1; page <= MAX_PAGES; page++) {
  const { rows, total } = await fetchPage(page);
  collected.push(...rows);
  console.log(`  page ${page}: ${rows.length}건 (누적 ${collected.length}${total ? "/" + total : ""})`);
  if (rows.length < PER_PAGE) break;
}

const normalized = collected.map(normalize).filter((a) => a.title);

// 기존 데이터와 ID 기준 upsert (중복 방지)
let prev = [];
if (existsSync(OUT)) {
  try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}
}
const map = new Map(prev.map((a) => [a.id, a]));
let added = 0;
for (const a of normalized) {
  if (!map.has(a.id)) added++;
  map.set(a.id, { ...map.get(a.id), ...a });
}
const merged = [...map.values()];

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(merged, null, 2), "utf8");
console.log(`✅ 저장: ${OUT}`);
console.log(`   신규 ${added}건 / 수집 ${normalized.length}건 / 누적 ${merged.length}건`);
