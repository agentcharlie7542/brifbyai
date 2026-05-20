const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// scripts/ → brifbyai/ → 부모 → iheal/
const samplePath = path.resolve(__dirname, '../../iheal/iHEAL _ PR用参考資料(ヴィーナス乳酸菌）.pdf');
console.log('Looking for:', samplePath);
const buf = fs.readFileSync(samplePath);
console.log('PDF size:', buf.length, 'bytes');

pdfParse(buf).then((r) => {
  console.log('Pages:', r.numpages);
  console.log('Text length:', r.text.length);
  console.log('--- first 600 chars ---');
  console.log(r.text.slice(0, 600));
  console.log('--- last 200 chars ---');
  console.log(r.text.slice(-200));
}).catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
