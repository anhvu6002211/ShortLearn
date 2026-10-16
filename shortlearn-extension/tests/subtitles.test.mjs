import test from 'node:test'; import assert from 'node:assert/strict';
import { cueAt, parseJson3 } from '../.build/shared/subtitles.js';
test('parses JSON3 and removes music markers', () => {
  const cues = parseJson3({ events: [{ tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: '[Music] Hello ' }, { utf8: 'world' }] }] });
  assert.deepEqual(cues, [{ start: 1, duration: 2, text: 'Hello world' }]);
  assert.equal(cueAt(cues, 2)?.text, 'Hello world'); assert.equal(cueAt(cues, 4), null);
});
