import test from 'node:test'; import assert from 'node:assert/strict';
import { cleanCaptionText } from '../.build/content/youtube/domCaptions.js';
test('cleans YouTube speaker and music markers without dropping short speech', () => {
  assert.equal(cleanCaptionText('>> Really?'), 'Really?');
  assert.equal(cleanCaptionText('[Music] >> No way! ♪'), 'No way!');
});