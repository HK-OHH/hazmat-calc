// 소방청_국가 위험물 정보 조회 서비스 → data/materials.json
// 실행: DATA_GO_KR_KEY=인증키 node scripts/fetch-materials.mjs
// 데이터 출처: 소방청_국가 위험물 정보 조회 서비스 (공공데이터포털, 공공누리)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const KEY = process.env.DATA_GO_KR_KEY;
const fail = (msg) => { console.log(`::error title=위험물 정보 수집 실패::${msg}`); process.exit(1); };
if (!KEY) fail('DATA_GO_KR_KEY 시크릿이 비어 있습니다 (Settings → Secrets → Actions 확인)');
process.on('unhandledRejection', e => fail(`${e && e.message}${e && e.cause ? ' / 원인: ' + (e.cause.code || e.cause.message) : ''}`));
const BASE = process.env.API_BASE || 'https://apis.data.go.kr/1661000/materialInfoSvc/getMaterialList';
const ROWS = 1000;

const unxml = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (x, t) => unxml((x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1]);

async function page(no) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(KEY)}&pageNo=${no}&numOfRows=${ROWS}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = (await res.text()).trim();
      // 응답이 JSON 또는 XML 둘 다 올 수 있음
      if (text.startsWith('{')) {
        const j = JSON.parse(text);
        const code = String(j?.header?.resultCode ?? j?.response?.header?.resultCode ?? '');
        if (code !== '0' && code !== '00') throw new Error(`API 오류 ${code} ${j?.header?.resultMsg || text.slice(0, 200)}`);
        const body = j.body || j.response?.body || {};
        let raw = body.items?.item ?? body.items ?? [];
        if (!Array.isArray(raw)) raw = [raw];
        const items = raw.map(i => ({ name: String(i.chemicalname ?? '').trim(), cas: String(i.casno ?? '').trim(), un: String(i.unno ?? '').trim(), cls: String(i.hazardmaterialclass ?? '').trim() }));
        return { total: +body.totalCount || 0, items };
      }
      const xml = text;
      const code = tag(xml, 'resultCode');
      if (code !== '0' && code !== '00') throw new Error(`API 오류 ${code} ${tag(xml, 'resultMsg') || xml.slice(0, 200)}`);
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => ({
        name: tag(m[1], 'chemicalname'), cas: tag(m[1], 'casno'), un: tag(m[1], 'unno'), cls: tag(m[1], 'hazardmaterialclass'),
      }));
      return { total: +tag(xml, 'totalCount') || 0, items };
    } catch (e) {
      console.warn(`page ${no} 시도 ${attempt} 실패: ${e.message}${e.cause ? ' / ' + (e.cause.code || e.cause.message) : ''}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

let first;
try { first = await page(1); }
catch (e) { fail(`API 호출 실패: ${e.message}${e.cause ? ' / 원인: ' + (e.cause.code || e.cause.message) : ''}`); }
let all = first.items;
const pages = Math.ceil(first.total / ROWS);
for (let p = 2; p <= pages; p++) {
  try { all = all.concat((await page(p)).items); }
  catch (e) { fail(`${p}페이지 호출 실패: ${e.message}`); }
}
console.log(`수집 ${all.length} / 전체 ${first.total}`);

// 비정상 응답으로 기존 데이터를 덮어쓰지 않도록 안전장치
const prevPath = 'data/materials.json';
const prevTotal = existsSync(prevPath) ? (JSON.parse(readFileSync(prevPath, 'utf8')).total || 0) : 0;
if (all.length < 1000 || all.length < first.total * 0.95 || (prevTotal && all.length < prevTotal * 0.8)) {
  fail(`수집 건수(${all.length})가 비정상적으로 적어 저장하지 않습니다`);
}

// 중복 제거(이름+CAS) 후 이름순 정렬, 분류 문자열은 번호로 압축
const seen = new Set();
all = all.filter(i => i.name && !seen.has(i.name + '|' + i.cas) && seen.add(i.name + '|' + i.cas))
         .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
const classes = [...new Set(all.map(i => i.cls))];
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const head = { source: '소방청_국가 위험물 정보 조회 서비스 (공공데이터포털)', updated: today, total: all.length, fields: ['물질명', 'CAS', 'UN', '분류번호'], classes };
const body = all.map(i => JSON.stringify([i.name, i.cas, i.un, classes.indexOf(i.cls)])).join(',\n');
const out = JSON.stringify(head, null, 1).replace(/\n}$/, `,\n "items": [\n${body}\n]\n}`);
writeFileSync(prevPath, out + '\n');
console.log(`저장 완료: ${prevPath} (${(Buffer.byteLength(out) / 1024).toFixed(0)} KB, 분류 ${classes.length}종)`);
