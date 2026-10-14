import assert from 'node:assert/strict'
import { parseYouTubeId } from './youtube.js'

const id = 'dQw4w9WgXcQ'
assert.equal(parseYouTubeId(`https://youtube.com/shorts/${id}`), id)
assert.equal(parseYouTubeId(`https://www.youtube.com/watch?v=${id}`), id)
assert.equal(parseYouTubeId(`https://youtu.be/${id}`), id)
assert.equal(parseYouTubeId(`https://m.youtube.com/watch?v=${id}`), id)
assert.equal(parseYouTubeId('https://example.com/shorts/dQw4w9WgXcQ'), null)
assert.equal(parseYouTubeId('https://youtube.com/shorts/too-short'), null)
assert.equal(parseYouTubeId('not a url'), null)
console.log('YouTube URL parser: PASS')
