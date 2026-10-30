// PDF → 텍스트 추출 (pdf.js 내장판) — 좌표 기반 줄 재구성으로 OFP 컬럼 레이아웃 보존, 전부 기기 안 처리(R4)
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

// 한 페이지의 textContent 아이템들을 y로 묶고 x로 정렬해 고정폭 레이아웃 비슷하게 복원
function rebuildPage(items) {
  const rows = new Map(); // yKey -> [{x, str, w}]
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 2) * 2; // 2pt 허용오차로 같은 줄 묶기
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x: it.transform[4], str: it.str, w: it.width || 0 });
  }
  // 평균 글자폭 (고정폭 가정, OFP는 모노스페이스)
  let tw = 0, tc = 0;
  for (const arr of rows.values()) for (const c of arr) { if (c.w > 0 && c.str.length) { tw += c.w; tc += c.str.length; } }
  const cw = tc ? tw / tc : 6;
  const minX = Math.min(...[...rows.values()].flat().map((c) => c.x));
  const lines = [];
  const ys = [...rows.keys()].sort((a, b) => b - a); // PDF 좌표는 위가 큼
  for (const y of ys) {
    const cells = rows.get(y).sort((a, b) => a.x - b.x);
    let line = '';
    for (const c of cells) {
      const col = Math.max(0, Math.round((c.x - minX) / cw));
      if (col > line.length) line += ' '.repeat(col - line.length);
      else if (line.length && !line.endsWith(' ')) line += ' ';
      line += c.str;
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}

export async function extractPdfText(arrayBuffer, onProgress) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(rebuildPage(tc.items));
    if (onProgress) onProgress(i, doc.numPages);
  }
  await doc.destroy();
  return pages.join('\n');
}
