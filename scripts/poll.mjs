// 키 활성화될 때까지 fetch 재시도 → 성공하면 build까지 실행 (백그라운드용)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX = 20, GAP = 180000; // 3분 간격, 최대 20회(~60분)

for (let i = 1; i <= MAX; i++) {
  console.log(`\n[시도 ${i}/${MAX}] fetch 실행...`);
  const f = spawnSync(node, [join(dir, "fetch.mjs")], { stdio: "inherit" });
  if (f.status === 0) {
    console.log("✅ 수집 성공 → build 실행");
    spawnSync(node, [join(dir, "build.mjs")], { stdio: "inherit" });
    console.log("🎉 DONE — 실데이터로 사이트 생성 완료");
    process.exit(0);
  }
  if (i < MAX) {
    console.log(`대기 ${GAP / 1000}s 후 재시도...`);
    await sleep(GAP);
  }
}
console.log("⏱ TIMEOUT: 키가 아직 활성화되지 않음. 나중에 다시 실행하세요.");
process.exit(2);
