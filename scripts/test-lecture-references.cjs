#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  listReferences,
  addReference,
  addReferencesBatch,
  importReferenceTextHeuristic,
  updateReference,
  deleteReference,
  importReferenceImage,
  getReferenceAsset
} = require('../main/lectureReferences.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-refs-'));
const refsDir = path.join(tmp, 'references');
fs.mkdirSync(refsDir, { recursive: true });

const pngPath = path.join(tmp, 'sample.png');
fs.writeFileSync(
  pngPath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

const linkRes = addReference(tmp, {
  type: 'link',
  url: 'https://youtube.com/watch?v=test',
  description: 'ANOVA recap video'
});
assert.strictEqual(linkRes.success, true);
assert.strictEqual(linkRes.item.type, 'link');

const imgRes = importReferenceImage(tmp, pngPath);
assert.strictEqual(imgRes.success, true);
assert.ok(imgRes.item.fileName);
assert.ok(fs.existsSync(path.join(refsDir, imgRes.item.fileName)));

const textRes = addReference(tmp, {
  type: 'text',
  body: 'ANOVA assumes equal variances across groups.',
  description: 'Quick recap of assumptions'
});
assert.strictEqual(textRes.success, true);
assert.strictEqual(textRes.item.type, 'text');
assert.ok(textRes.item.body.includes('ANOVA'));

const mixed = importReferenceTextHeuristic(
  tmp,
  'See https://example.com/guide and https://youtube.com/watch?v=abc for more.\n\nRemember homogeneity of variance.'
);
assert.strictEqual(mixed.success, true);
assert.ok(mixed.count >= 2);

const listed = listReferences(tmp);
assert.strictEqual(listed.length, 6);

const asset = getReferenceAsset(tmp, imgRes.item.fileName);
assert.strictEqual(asset.success, true);
assert.ok(asset.dataUrl.startsWith('data:image/'));

const updated = updateReference(tmp, {
  id: linkRes.item.id,
  description: 'Updated caption'
});
assert.strictEqual(updated.success, true);
assert.strictEqual(updated.item.description, 'Updated caption');

const deleted = deleteReference(tmp, imgRes.item.id);
assert.strictEqual(deleted.success, true);
assert.strictEqual(listReferences(tmp).length, 5);
assert.ok(!fs.existsSync(path.join(refsDir, imgRes.item.fileName)));

console.log('test-lecture-references: ok');
