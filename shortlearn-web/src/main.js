import './style.css'
import { parseYouTubeId } from './youtube.js'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const app = document.querySelector('#app')
let timer
let currentVideoId
let processingDeadline = 0
let auth = { user: null, accessToken: null, refreshToken: null }
let pendingVerification = null
let reviewCards = []
let reviewIndex = 0
let resetToken = null
let refreshPromise = null
let installPrompt = null
let lessonCues = []
let selectedCueIndex = 0
let selectedLookup = null

const icons = { play: '▶', link: '↗', retry: '↻', user: '●' }


async function api(path, options = {}, canRefresh = true) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(20_000),
      headers: {
        'Content-Type': 'application/json',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (!navigator.onLine) throw new Error('Bạn đang ngoại tuyến. Hãy kết nối mạng rồi thử lại.')
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('Máy chủ phản hồi quá lâu. Hãy thử lại sau.')
    throw new Error('Không thể kết nối máy chủ. Hãy kiểm tra API Gateway hoặc thử lại sau.')
  }
  const requestId = response.headers.get('x-request-id')
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}))
  if (response.status === 401 && canRefresh && auth.refreshToken && !path.includes('/auth/')) {
    try {
      refreshPromise ||= api('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: auth.refreshToken }) }, false)
      const refreshed = await refreshPromise
      auth.accessToken = refreshed.tokens.access_token
      auth.refreshToken = refreshed.tokens.refresh_token
      return api(path, options, false)
    } catch {
      auth = { user: null, accessToken: null, refreshToken: null }
      renderAuth('Lỗi: Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      throw new Error('Phiên đăng nhập đã hết hạn.')
    } finally { refreshPromise = null }
  }
  if (!response.ok && payload.status !== 'FAILED') {
    const fallback = response.status === 429
      ? 'Bạn thao tác quá nhanh. Hãy chờ một lát rồi thử lại.'
      : response.status >= 500 ? 'Máy chủ đang gặp sự cố. Hãy thử lại sau.' : 'Không thể hoàn tất yêu cầu.'
    throw Object.assign(new Error(payload.error || payload.message || fallback), { requestId, code: payload.code, status: response.status })
  }
  return { ...payload, requestId }
}

function shell(content, active = 'learn') {
  app.innerHTML = `
    <header class="topbar"><a class="brand" href="#" aria-label="ShortLearn trang chủ"><span class="brand-mark">S</span><strong>ShortLearn</strong></a>
      <nav aria-label="Điều hướng chính"><button class="nav-item ${active === 'learn' ? 'active' : ''}" data-nav="home">Học ngay</button><button class="nav-item ${active === 'review' ? 'active' : ''}" data-nav="review">Ôn tập</button><button class="nav-item ${active === 'account' ? 'active' : ''}" data-nav="account">Tài khoản</button></nav>
      <button class="icon-button" data-nav="account" aria-label="Tài khoản">${icons.user}</button>
    </header>
    <div id="network" class="network ${navigator.onLine ? '' : 'offline'}" role="status">${navigator.onLine ? 'Đang trực tuyến · Có thể gửi video mới' : 'Bạn đang ngoại tuyến. Kết nối mạng để xử lý video mới.'}</div>
    <main>${content}</main>
    <footer><strong>ShortLearn</strong><span>Biến video ngắn thành bài học tiếng Anh.</span><span>© 2026 ShortLearn</span></footer>`
  document.querySelectorAll('[data-nav="home"], [data-home]').forEach(node => node.addEventListener('click', renderHome))
  document.querySelectorAll('[data-nav="review"]').forEach(node => node.addEventListener('click', renderReview))
  document.querySelectorAll('[data-nav="account"]').forEach(node => node.addEventListener('click', () => auth.user ? renderAccount() : renderAuth()))
}

function renderHome(message = '') {
  clearTimeout(timer)
  shell(`<section class="hero"><div class="eyebrow">YOUTUBE SHORTS · PHỤ ĐỀ SONG NGỮ</div><h1>Biến Shorts thành bài học <em>tiếng Anh</em></h1><p>Dán liên kết YouTube Shorts. ShortLearn tạo phụ đề Anh–Việt để bạn nghe, tra từ và ghi nhớ.</p>
    <form id="url-form" class="studio" novalidate><div class="platforms"><button type="button" class="platform selected">● YouTube Shorts</button><button type="button" class="platform" disabled>♪ TikTok <small>Đang phát triển</small></button>${installPrompt ? '<button type="button" class="ai-label" id="install-app">Cài ShortLearn</button>' : '<span class="ai-label">Xử lý phụ đề bằng AI</span>'}</div>
      <label for="video-url">Liên kết video Shorts</label><div class="input-row"><input id="video-url" type="url" inputmode="url" autocomplete="url" placeholder="https://youtube.com/shorts/VIDEO_ID" aria-describedby="url-feedback" required><button class="primary" type="submit">Tạo bài học ${icons.link}</button></div>
      <p id="url-feedback" class="feedback ${message ? 'error' : ''}" role="alert">${message || 'Chỉ xử lý liên kết công khai. Không yêu cầu mật khẩu YouTube.'}</p>
    </form></section>
    <section class="empty"><div class="empty-icon">${icons.play}</div><h2>Bài học gần đây</h2><p>Bạn chưa tạo bài học nào.</p><button class="secondary" id="focus-url">Dán liên kết đầu tiên</button></section>`)
  document.querySelector('#focus-url').addEventListener('click', () => document.querySelector('#video-url').focus())
  document.querySelector('#install-app')?.addEventListener('click', async () => {
    installPrompt.prompt()
    await installPrompt.userChoice
    installPrompt = null
    renderHome()
  })
  document.querySelector('#url-form').addEventListener('submit', event => {
    event.preventDefault()
    const id = parseYouTubeId(document.querySelector('#video-url').value)
    if (!id) return renderHome('Liên kết không hợp lệ. Hãy dán URL YouTube Shorts công khai.')
    if (!navigator.onLine) return renderHome('Bạn đang ngoại tuyến. Kết nối mạng để xử lý video mới.')
    currentVideoId = id
    beginLesson(false)
  })
}

async function beginLesson(retry) {
  processingDeadline = Date.now() + 10 * 60_000
  renderProcessing('PENDING')
  try {
    const result = await api('/api/v1/subtitles/request', { method: 'POST', body: JSON.stringify({ platform: 'youtube', video_id: currentVideoId, retry }) })
    handleTask(result)
  } catch (error) { renderError(error.message, error.requestId) }
}

function renderProcessing(status, requestId = '') {
  shell(`<section class="process"><div class="request-line">Mã yêu cầu: <code>${requestId || 'đang tạo…'}</code></div><div class="process-grid">
    <article class="panel status-card"><span class="status ${status.toLowerCase()}">${status}</span><p class="overline">TIẾN TRÌNH BÀI HỌC</p><h1>Đang chuẩn bị bài học song ngữ</h1><p>ShortLearn đang xử lý video. Trang sẽ tự cập nhật khi phụ đề sẵn sàng.</p></article>
    <article class="panel"><p class="overline">QUY TRÌNH PHÂN TÍCH</p><h2>Đang xử lý bài học</h2><ol class="steps"><li>Kiểm tra liên kết</li><li>Lấy phụ đề hoặc âm thanh</li><li>Tạo transcript tiếng Anh</li><li>Dịch sang tiếng Việt</li></ol><p class="muted">Các bước giữ trạng thái trung tính vì API chưa cung cấp tiến độ chi tiết.</p></article>
  </div><div class="actions"><button class="text-button" data-home>Dán liên kết khác</button><button class="secondary" data-home>Dừng chờ</button></div></section>`)
}

function handleTask(result) {
  if (result.status === 'READY') return renderLesson(result.data)
  if (result.status === 'FAILED') return renderError('Không thể xử lý video. Bạn có thể thử lại.', result.requestId, true)
  renderProcessing(result.status || 'PROCESSING', result.requestId)
  const wait = Math.max(2, result.retry_after_seconds || 2) * 1000
  timer = setTimeout(pollLesson, wait)
}

async function pollLesson() {
  if (Date.now() >= processingDeadline) {
    return renderError('Quá trình xử lý mất nhiều thời gian hơn dự kiến. Bạn có thể thử lại để kiểm tra hoặc tạo lại tác vụ.', '', true)
  }
  try {
    const result = await api(`/api/v1/subtitles/${encodeURIComponent(currentVideoId)}?platform=youtube`)
    handleTask(result)
  } catch (error) { renderError(error.message, error.requestId) }
}

function wordTokens(text, cueIndex) {
  return text.split(/(\s+)/).map(part => {
    const word = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’-]+$/gu, '')
    return word ? `<button class="word" data-word="${escapeHtml(word)}" data-cue="${cueIndex}">${escapeHtml(part)}</button>` : escapeHtml(part)
  }).join('')
}

function renderLesson(cues) {
  lessonCues = cues
  const rows = cues.map((cue, index) => `<div class="cue ${index === 0 ? 'current' : ''}" data-index="${index}" tabindex="0" role="button"><time>${formatTime(cue.start_time)}</time><span>${wordTokens(cue.en_text || '', index)}</span><small>${escapeHtml(cue.vi_text || 'Bản dịch tiếng Việt hiện chưa khả dụng.')}</small></div>`).join('')
  shell(`<section class="workspace"><div class="video-column"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${currentVideoId}?controls=1" title="Video bài học YouTube" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p class="native-controls-note">Dùng điều khiển YouTube để phát, tạm dừng hoặc tua video.</p></div>
    <article class="transcript panel"><div class="transcript-head"><div><p class="overline">PHỤ ĐỀ SONG NGỮ</p><h1>Bài học của bạn</h1></div><span class="status ready">READY</span></div><label class="search-label" for="search">Tìm trong transcript</label><input id="search" class="search" placeholder="Tìm câu hoặc từ…"><div id="cues" class="cues">${rows}</div></article></section><div id="lookup-root"></div>`)
  document.querySelector('#search').addEventListener('input', event => {
    const q = event.target.value.toLocaleLowerCase('vi')
    document.querySelectorAll('.cue').forEach(cue => { cue.hidden = !cue.textContent.toLocaleLowerCase('vi').includes(q) })
  })
  const selectCue = cue => { document.querySelector('.cue.current')?.classList.remove('current'); cue.classList.add('current'); selectedCueIndex = Number(cue.dataset.index) }
  document.querySelectorAll('.cue').forEach(cue => {
    cue.addEventListener('click', event => { if (!event.target.closest('.word')) selectCue(cue) })
    cue.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target === cue) { event.preventDefault(); selectCue(cue) } })
  })
  document.querySelectorAll('.word').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); selectedCueIndex = Number(button.dataset.cue); openWordLookup(button.dataset.word, button)
  }))
}

async function translateWord(word) {
  let response
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`
    response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  } catch {
    throw new Error('Chưa thể tra nghĩa. Hãy nhập nghĩa tiếng Việt.')
  }
  if (!response.ok) throw new Error('Chưa thể tra nghĩa. Hãy nhập nghĩa tiếng Việt.')
  const payload = await response.json()
  const meaning = Array.isArray(payload?.[0]) ? payload[0].map(segment => segment?.[0] || '').join('').trim() : ''
  if (!meaning || meaning.toLocaleLowerCase() === word.toLocaleLowerCase()) throw new Error('Chưa thể tra nghĩa. Hãy nhập nghĩa tiếng Việt.')
  return meaning
}

function openWordLookup(word, trigger, message = 'Đang tra nghĩa…') {
  const cue = lessonCues[selectedCueIndex]
  selectedLookup = { word, cue }
  const root = document.querySelector('#lookup-root')
  root.innerHTML = `<div class="sheet-backdrop" id="sheet-close"></div><aside class="word-sheet" role="dialog" aria-modal="true" aria-labelledby="lookup-title"><button class="sheet-x" id="sheet-x" aria-label="Đóng">×</button><p class="overline">TRA TỪ TRONG NGỮ CẢNH</p><h2 id="lookup-title">${escapeHtml(word)}</h2><p class="context-line">${escapeHtml(cue.en_text || '')}</p><label>Nghĩa tiếng Việt<input id="word-meaning" value="" placeholder="${escapeHtml(message)}"></label><p id="lookup-message" class="feedback" role="status"></p><button id="save-word" class="primary">Lưu vào bộ thẻ</button></aside>`
  const dialog = document.querySelector('.word-sheet')
  const close = () => { root.innerHTML = ''; selectedLookup = null; trigger?.focus() }
  document.querySelector('#sheet-close').addEventListener('click', close)
  document.querySelector('#sheet-x').addEventListener('click', close)
  document.querySelector('#save-word').addEventListener('click', saveSelectedWord)
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
    const first = focusable[0]; const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
  document.querySelector('#word-meaning').focus()
  translateWord(word).then(meaning => { if (selectedLookup?.word === word) document.querySelector('#word-meaning').value = meaning }).catch(error => { if (selectedLookup?.word === word) document.querySelector('#lookup-message').textContent = error.message })
}

async function saveSelectedWord() {
  if (!selectedLookup) return
  if (!auth.user) { document.querySelector('#lookup-message').textContent = 'Đăng nhập ShortLearn để lưu và đồng bộ flashcard.'; return }
  const meaning = document.querySelector('#word-meaning').value.trim()
  if (!meaning) { document.querySelector('#lookup-message').textContent = 'Hãy nhập nghĩa tiếng Việt trước khi lưu.'; return }
  const button = document.querySelector('#save-word'); button.disabled = true
  try {
    const result = await api('/api/v1/vocabulary/save', { method: 'POST', body: JSON.stringify({ word: selectedLookup.word, meaning, context_sentence: selectedLookup.cue.en_text, video_id: currentVideoId, platform: 'youtube', timestamp_mark: Number(selectedLookup.cue.start_time) || 0 }) })
    document.querySelector('#lookup-message').textContent = result.created ? 'Đã lưu vào bộ thẻ.' : 'Đã cập nhật thẻ đã lưu.'
    button.textContent = 'Đã lưu'
  } catch (error) { document.querySelector('#lookup-message').textContent = error.message; button.disabled = false }
}

function renderError(message, requestId = '', retry = false) {
  clearTimeout(timer)
  shell(`<section class="error-page panel"><div class="error-symbol">!</div><p class="overline">KHÔNG THỂ HOÀN TẤT</p><h1>Không thể xử lý video</h1><p>${escapeHtml(message)}</p>${requestId ? `<p class="request-line">Mã yêu cầu: <code>${escapeHtml(requestId)}</code></p>` : ''}<div class="actions">${retry ? `<button id="retry" class="primary">${icons.retry} Thử lại</button>` : ''}<button class="secondary" data-home>Dán liên kết khác</button></div></section>`)
  document.querySelector('#retry')?.addEventListener('click', () => beginLesson(true))
}

function setSession(result) {
  auth = { user: result.user, accessToken: result.tokens.access_token, refreshToken: result.tokens.refresh_token }
  renderAccount()
}

function authForm(title, fields, action, alternate, message = '') {
  shell(`<section class="auth-wrap panel"><p class="overline">TÀI KHOẢN SHORTLEARN</p><h1>${title}</h1>${message ? `<p class="feedback ${message.startsWith('Lỗi:') ? 'error' : ''}" role="alert">${escapeHtml(message)}</p>` : ''}<form id="auth-form" class="auth-form">${fields}<button class="primary" type="submit">${action}</button></form><button id="auth-alt" class="text-button">${alternate}</button><p class="security-note">Không chia sẻ mã OTP hoặc mật khẩu với bất kỳ ai.</p></section>`, 'account')
}

function renderAuth(message = '') {
  authForm('Đăng nhập ShortLearn', `<label>Email<input name="email" type="email" autocomplete="email" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label><button id="forgot" class="text-button" type="button">Quên mật khẩu?</button>`, 'Đăng nhập', 'Chưa có tài khoản? Đăng ký', message)
  document.querySelector('#auth-alt').addEventListener('click', renderRegister)
  document.querySelector('#forgot').addEventListener('click', renderForgotPassword)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try { setSession(await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password'), device: { platform: 'web', name: navigator.userAgent.slice(0, 80), app_version: '1.0.0' } }) })) }
    catch (error) { renderAuth(`Lỗi: ${error.message}`) }
  })
}

function renderRegister(message = '') {
  authForm('Tạo tài khoản', `<label>Tên hiển thị<input name="display_name" autocomplete="name" maxlength="100" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Mật khẩu<input name="password" type="password" autocomplete="new-password" minlength="10" required></label>`, 'Đăng ký', 'Đã có tài khoản? Đăng nhập', message)
  document.querySelector('#auth-alt').addEventListener('click', renderAuth)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try { const result = await api('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(data)) }); pendingVerification = { email: data.get('email'), challengeId: result.verification.challenge_id }; renderOtp() }
    catch (error) { renderRegister(`Lỗi: ${error.message}`) }
  })
}

function renderOtp(message = '') {
  if (!pendingVerification) return renderRegister()
  authForm('Xác minh mã OTP', `<p>Mã đã gửi tới <strong>${escapeHtml(pendingVerification.email)}</strong></p><label>Mã gồm 6 chữ số<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>`, 'Xác minh', 'Quay lại đăng nhập', message)
  document.querySelector('#auth-alt').addEventListener('click', renderAuth)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try { setSession(await api('/api/v1/auth/otp/verify', { method: 'POST', body: JSON.stringify({ challenge_id: pendingVerification.challengeId, purpose: 'verify_email', code: data.get('code'), device: { platform: 'web', name: 'Browser', app_version: '1.0.0' } }) })) }
    catch (error) { renderOtp(`Lỗi: ${error.message}`) }
  })
}

function renderForgotPassword(message = '') {
  authForm('Quên mật khẩu', `<label>Email<input name="email" type="email" autocomplete="email" required></label>`, 'Gửi mã OTP', 'Quay lại đăng nhập', message)
  document.querySelector('#auth-alt').addEventListener('click', renderAuth)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const email = new FormData(event.currentTarget).get('email')
    try { const result = await api('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); pendingVerification = { email, challengeId: result.challenge_id, purpose: 'password_reset' }; renderPasswordOtp() }
    catch (error) { renderForgotPassword(`Lỗi: ${error.message}`) }
  })
}

function renderPasswordOtp(message = '') {
  if (!pendingVerification) return renderForgotPassword()
  authForm('Xác minh mã OTP', `<p>Nếu tài khoản tồn tại, mã đã được gửi tới <strong>${escapeHtml(pendingVerification.email)}</strong>.</p><label>Mã gồm 6 chữ số<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label>`, 'Xác minh', 'Quay lại đăng nhập', message)
  document.querySelector('#auth-alt').addEventListener('click', renderAuth)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const code = new FormData(event.currentTarget).get('code')
    try { const result = await api('/api/v1/auth/otp/verify', { method: 'POST', body: JSON.stringify({ challenge_id: pendingVerification.challengeId, purpose: 'password_reset', code }) }); resetToken = result.reset_token; renderResetPassword() }
    catch (error) { renderPasswordOtp(`Lỗi: ${error.message}`) }
  })
}

function renderResetPassword(message = '') {
  if (!resetToken) return renderForgotPassword()
  authForm('Đặt mật khẩu mới', `<label>Mật khẩu mới<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><label>Xác nhận mật khẩu<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label>`, 'Cập nhật mật khẩu', 'Quay lại đăng nhập', message)
  document.querySelector('#auth-alt').addEventListener('click', renderAuth)
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    if (data.get('password') !== data.get('confirm')) return renderResetPassword('Lỗi: Mật khẩu xác nhận không khớp.')
    try { await api('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ reset_token: resetToken, new_password: data.get('password') }) }); resetToken = null; pendingVerification = null; renderAuth('Mật khẩu đã cập nhật. Hãy đăng nhập lại.') }
    catch (error) { renderResetPassword(`Lỗi: ${error.message}`) }
  })
}

async function renderAccount() {
  if (!auth.user) return renderAuth()
  shell(`<section class="account-page"><article class="account panel"><div class="avatar">${escapeHtml((auth.user.display_name || auth.user.email)[0].toUpperCase())}</div><p class="overline">TÀI KHOẢN</p><h1>${escapeHtml(auth.user.display_name || 'Người học')}</h1><p>${escapeHtml(auth.user.email)}</p><div id="account-stats" class="stats"><div><strong>—</strong><span>Từ đã lưu</span></div><div><strong>—</strong><span>Đến hạn hôm nay</span></div></div><div class="platform-account"><strong>YouTube</strong><span>Sẵn sàng</span></div><div class="platform-account disabled"><strong>TikTok</strong><span>Đang phát triển</span></div><button id="logout" class="secondary">Đăng xuất</button></article><article class="saved panel"><div class="saved-head"><div><p class="overline">THƯ VIỆN CỦA BẠN</p><h2>Từ đã lưu</h2></div><button id="start-review" class="primary">Ôn thẻ đến hạn</button></div><label class="search-label" for="saved-search">Tìm từ hoặc nghĩa</label><input id="saved-search" class="search" placeholder="Tìm trong bộ thẻ…" disabled><div id="saved-list" class="saved-list"><p class="muted">Đang tải bộ thẻ…</p></div></article></section>`, 'account')
  document.querySelector('#logout').addEventListener('click', async () => { try { await api('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: auth.refreshToken }) }) } finally { auth = { user: null, accessToken: null, refreshToken: null }; renderHome() } })
  document.querySelector('#start-review').addEventListener('click', renderReview)
  try {
    const saved = await api('/api/v1/vocabulary/saved?limit=200')
    document.querySelector('#account-stats').innerHTML = `<div><strong>${saved.total_items}</strong><span>Từ đã lưu</span></div><div><strong>${saved.total_due}</strong><span>Đến hạn hôm nay</span></div>`
    renderSavedWords(saved.items)
    const search = document.querySelector('#saved-search'); search.disabled = false
    search.addEventListener('input', () => renderSavedWords(saved.items, search.value))
  } catch (error) { document.querySelector('#saved-list').innerHTML = `<div class="inline-error"><strong>Không tải được bộ thẻ</strong><p>${escapeHtml(error.message)}</p><button id="reload-saved" class="secondary">Thử lại</button></div>`; document.querySelector('#reload-saved').addEventListener('click', renderAccount) }
}

function renderSavedWords(items, query = '') {
  const normalized = query.trim().toLocaleLowerCase('vi')
  const visible = items.filter(item => !normalized || [item.word, item.meaning, item.context_sentence].some(value => String(value || '').toLocaleLowerCase('vi').includes(normalized)))
  const list = document.querySelector('#saved-list')
  if (!visible.length) { list.innerHTML = `<div class="library-empty"><strong>${items.length ? 'Không tìm thấy từ phù hợp.' : 'Bạn chưa lưu từ nào.'}</strong><p>${items.length ? 'Thử từ khóa khác.' : 'Bấm vào một từ trong transcript để tạo thẻ đầu tiên.'}</p></div>`; return }
  list.innerHTML = visible.map(item => `<article class="saved-card"><div><span class="due-dot ${Number(item.is_due) ? 'is-due' : ''}"></span><strong>${escapeHtml(item.word)}</strong>${item.phonetic ? `<small>${escapeHtml(item.phonetic)}</small>` : ''}</div><p>${escapeHtml(item.meaning)}</p>${item.context_sentence ? `<blockquote>${escapeHtml(item.context_sentence)}</blockquote>` : ''}<footer><span>${Number(item.is_due) ? 'Đến hạn' : `Ôn ${formatDate(item.next_review)}`}</span>${item.platform_video_id && item.platform === 'youtube' ? `<button class="text-button" data-replay="${escapeHtml(item.platform_video_id)}" data-time="${Number(item.timestamp_mark) || 0}">Mở ngữ cảnh ↗</button>` : ''}</footer></article>`).join('')
  list.querySelectorAll('[data-replay]').forEach(button => button.addEventListener('click', () => { window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(button.dataset.replay)}&t=${Math.max(0, Math.floor(Number(button.dataset.time) || 0))}s`, '_blank', 'noopener,noreferrer') }))
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'sau' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date)
}

async function renderReview() {
  if (!auth.user) return renderAuth('Đăng nhập để đồng bộ phiên ôn tập.')
  shell(`<section class="review panel"><p class="overline">ÔN TẬP</p><h1>Đang tải thẻ đến hạn…</h1></section>`, 'review')
  try { const result = await api('/api/v1/vocabulary/due'); reviewCards = result.cards; reviewIndex = 0; renderReviewCard() }
  catch (error) { renderError(error.message, error.requestId) }
}

function renderReviewCard(message = '') {
  const card = reviewCards[reviewIndex]
  if (!card) { shell(`<section class="review panel"><p class="overline">HOÀN THÀNH</p><h1>${reviewCards.length ? 'Bạn đã hoàn thành phiên ôn tập.' : 'Hôm nay chưa có thẻ đến hạn.'}</h1><button class="primary" data-home>Học bài mới</button></section>`, 'review'); return }
  shell(`<section class="review panel"><p class="overline">THẺ ${reviewIndex + 1} / ${reviewCards.length}</p><h1>${escapeHtml(card.word)}</h1><p>${escapeHtml(card.context_sentence || '')}</p><button id="reveal" class="primary">Hiện đáp án</button><div id="answer" hidden><h2>${escapeHtml(card.meaning || 'Chưa có nghĩa')}</h2><div class="ratings">${['Quên','Khó','Tốt','Dễ'].map((label, index) => `<button data-rating="${index + 1}" class="secondary">${label}</button>`).join('')}</div></div>${message ? `<p class="feedback error">${escapeHtml(message)}</p>` : ''}</section>`, 'review')
  document.querySelector('#reveal').addEventListener('click', event => { event.currentTarget.hidden = true; document.querySelector('#answer').hidden = false })
  document.querySelectorAll('[data-rating]').forEach(button => button.addEventListener('click', async () => { try { await api('/api/v1/vocabulary/review', { method: 'POST', body: JSON.stringify({ word: card.word, rating: Number(button.dataset.rating) }) }); reviewIndex += 1; renderReviewCard() } catch (error) { renderReviewCard(error.message) } }))
}

function formatTime(seconds) { const n = Number(seconds) || 0; return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML }
window.addEventListener('online', renderHome)
window.addEventListener('offline', () => renderHome('Bạn đang ngoại tuyến. Kết nối mạng để xử lý video mới.'))
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; renderHome() })
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js')
renderHome()
