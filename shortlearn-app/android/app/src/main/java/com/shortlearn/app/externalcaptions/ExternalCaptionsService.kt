package com.shortlearn.app.externalcaptions

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.shortlearn.app.R

class ExternalCaptionsService : Service() {
  private var projection: MediaProjection? = null
  private var projectionCallback: MediaProjection.Callback? = null
  private var recorder: AudioRecord? = null
  private var readerThread: Thread? = null
  private var windowManager: WindowManager? = null
  private var overlay: View? = null
  private var params: WindowManager.LayoutParams? = null
  private var controls: View? = null
  private var controlParams: WindowManager.LayoutParams? = null
  private var lookupPanel: View? = null
  private var selectedWord = ""
  @Volatile private var capturing = false
  @Volatile private var cleaningUp = false
  private var whisper: ExternalWhisper? = null
  private val pcmWindow = ShortArray(MAX_WINDOW_SAMPLES)
  private var pcmWindowSize = 0
  private var speechActive = false
  private var silenceSamples = 0
  private var lastCaption = ""
  private var captionGeneration = 0L
  private var generation = 0L
  @Volatile private var filterLevel = selectedFilter
  @Volatile private var lastInferenceMs = 0L
  @Volatile private var lastRtf = 0.0
  @Volatile private var transcribedWindows = 0L
  @Volatile private var droppedWindows = 0L
  @Volatile private var duplicateCaptions = 0L
  @Volatile private var filteredCaptions = 0L

  override fun onBind(intent: Intent?) = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      cleanup(); stopSelf(); return START_NOT_STICKY
    }
    if (intent?.action == ACTION_START_MIC) {
      cleanupCapture()
      hideLookupPanel()
      overlay?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
      controls?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
      overlay = null; controls = null
      startForegroundNow(ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE, "Microphone")
      showOverlay()
      startMicrophoneCapture()
      return START_NOT_STICKY
    }
    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
    val data = if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra(EXTRA_DATA, Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_DATA)
    if (resultCode != Activity.RESULT_OK || data == null || !Settings.canDrawOverlays(this)) {
      state = "permission_denied"; stopSelf(); return START_NOT_STICKY
    }
    startForegroundNow(ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION, "Âm thanh nội bộ")
    startCapture(resultCode, data)
    return START_NOT_STICKY
  }

  private fun startForegroundNow(type: Int, source: String) {
    val stopIntent = PendingIntent.getService(this, 2, Intent(this, javaClass).setAction(ACTION_STOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("ShortLearn đang tạo phụ đề")
      .setContentText("Nguồn: $source. Nhấn Dừng để kết thúc.")
      .setOngoing(true).addAction(0, "Dừng", stopIntent).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, type)
    else startForeground(NOTIFICATION_ID, notification)
  }

  private fun startCapture(resultCode: Int, data: Intent) {
    cleanupCapture()
    val manager = getSystemService(MediaProjectionManager::class.java)
    projection = manager.getMediaProjection(resultCode, data)
    val callback = object : MediaProjection.Callback() {
      override fun onStop() { Handler(Looper.getMainLooper()).post { state = "stopped"; cleanup(); stopSelf() } }
    }
    projectionCallback = callback
    projection?.registerCallback(callback, Handler(Looper.getMainLooper()))
    showOverlay()
    try {
      val config = android.media.AudioPlaybackCaptureConfiguration.Builder(projection!!)
        .addMatchingUsage(android.media.AudioAttributes.USAGE_MEDIA)
        .addMatchingUsage(android.media.AudioAttributes.USAGE_GAME)
        .build()
      val format = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(SAMPLE_RATE).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build()
      val size = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT).coerceAtLeast(SAMPLE_RATE)
      recorder = AudioRecord.Builder().setAudioFormat(format).setBufferSizeInBytes(size * 2).setAudioPlaybackCaptureConfig(config).build()
      loadWhisperModel()
      recorder?.startRecording()
      capturing = true; running = true; source = "playback"
      if (state != "model_missing") state = "running"
      readerThread = Thread({ readPcm(size) }, "ShortLearnPlaybackCapture").apply { start() }
    } catch (error: Exception) {
      state = "blocked"
      updateCaption("Nguồn âm thanh không cho phép capture. Dừng phiên hoặc chọn microphone trong ShortLearn.")
    }
  }

  private fun startMicrophoneCapture() {
    try {
      val format = AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(SAMPLE_RATE).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build()
      val size = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT).coerceAtLeast(SAMPLE_RATE)
      recorder = AudioRecord.Builder().setAudioSource(android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION).setAudioFormat(format).setBufferSizeInBytes(size * 2).build()
      loadWhisperModel()
      recorder?.startRecording()
      capturing = true; running = true; source = "microphone"
      if (state != "model_missing") state = "running"
      updateCaption(if (whisper == null) "Microphone · chưa có model Whisper" else "Microphone · đang nghe tiếng Anh…")
      readerThread = Thread({ readPcm(size) }, "ShortLearnMicrophoneCapture").apply { start() }
    } catch (error: Exception) {
      state = "error"
      updateCaption("Không thể mở microphone: ${error.message ?: "lỗi không xác định"}")
    }
  }

  private fun loadWhisperModel() {
    val model = java.io.File(filesDir, MODEL_NAME)
    if (!model.isFile) {
      state = "model_missing"
      updateCaption("Chưa có model Whisper. Mở ShortLearn > Cài đặt > Bật mic để tải model một lần.")
    } else {
      whisper = ExternalWhisper(model)
    }
  }

  private fun readPcm(size: Int) {
    val buffer = ShortArray(size)
    var silentReads = 0
    while (capturing) {
      val count = recorder?.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING) ?: break
      if (count <= 0) continue
      val rms = calculateRms(buffer, count)
      if (rms < BLOCKED_RMS) silentReads++ else silentReads = 0
      if (silentReads == BLOCKED_READS) {
        state = "blocked"
        resetSpeechWindow()
        Handler(Looper.getMainLooper()).post { updateCaption("Không nhận được âm thanh nội bộ. Ứng dụng nguồn có thể đã chặn capture.") }
      } else if (rms >= BLOCKED_RMS && state == "blocked") {
        state = if (whisper == null) "model_missing" else "running"
        Handler(Looper.getMainLooper()).post { updateCaption(if (whisper == null) "Đang nhận âm thanh nhưng chưa có model Whisper." else "Đang nghe tiếng Anh…") }
      }
      if (whisper != null) processVadFrame(buffer, count, rms)
    }
    java.util.Arrays.fill(buffer, 0)
    resetSpeechWindow()
  }

  private fun calculateRms(buffer: ShortArray, count: Int): Double {
    var energy = 0.0
    for (index in 0 until count) {
      val sample = buffer[index].toDouble()
      energy += sample * sample
    }
    return kotlin.math.sqrt(energy / count.coerceAtLeast(1))
  }

  private fun processVadFrame(buffer: ShortArray, count: Int, rms: Double) {
    val speechRms = when (filterLevel) {
      FILTER_LIGHT -> 30.0
      FILTER_STRONG -> 120.0
      else -> 60.0
    }
    if (!speechActive && rms < speechRms) return
    if (!speechActive) {
      speechActive = true
      silenceSamples = 0
    }
    appendPcm(buffer, count)
    silenceSamples = if (rms < speechRms) silenceSamples + count else 0
    if (silenceSamples >= END_SILENCE_SAMPLES || pcmWindowSize >= pcmWindow.size) transcribeWindow()
  }

  private fun appendPcm(buffer: ShortArray, count: Int) {
    val copied = minOf(count, pcmWindow.size - pcmWindowSize)
    if (copied > 0) {
      System.arraycopy(buffer, 0, pcmWindow, pcmWindowSize, copied)
      pcmWindowSize += copied
    }
  }

  private fun transcribeWindow() {
    val sampleCount = pcmWindowSize - silenceSamples.coerceAtMost(pcmWindowSize)
    val currentGeneration = generation
    val audio = if (sampleCount >= MIN_SPEECH_SAMPLES) pcmWindow.copyOf(sampleCount) else null
    resetSpeechWindow()
    if (audio == null) { droppedWindows++; return }
    val startedAt = SystemClock.elapsedRealtime()
    val text = whisper?.transcribe(audio).orEmpty().replace(Regex("\\s+"), " ").trim()
    lastInferenceMs = SystemClock.elapsedRealtime() - startedAt
    lastRtf = lastInferenceMs.toDouble() / (sampleCount * 1000.0 / SAMPLE_RATE)
    transcribedWindows++
    java.util.Arrays.fill(audio, 0)
    if (!capturing || currentGeneration != generation) return
    if (!isMeaningfulCaption(text)) { filteredCaptions++; return }
    if (text.equals(lastCaption, ignoreCase = true)) { duplicateCaptions++; return }
    lastCaption = text
    captionGeneration++
    val eventGeneration = captionGeneration
    Handler(Looper.getMainLooper()).post {
      if (capturing && currentGeneration == generation) {
        updateCaption(text)
        refreshLookupPanel()
        ExternalCaptionsModule.emitCaption(text, eventGeneration)
      }
    }
  }

  private fun isMeaningfulCaption(text: String): Boolean {
    if (text.length < 2 || text.none { it.isLetterOrDigit() }) return false
    val normalized = text.lowercase()
    if (normalized in FILTERED_CAPTIONS || Regex("^(\\b\\w+\\b)(?:\\s+\\1){2,}$", RegexOption.IGNORE_CASE).matches(text)) return false
    return filterLevel != FILTER_STRONG || (text.length >= 4 && text.count { it.isLetterOrDigit() } >= 3)
  }

  fun setFilterLevel(level: String) {
    filterLevel = normalizeFilter(level)
    selectedFilter = filterLevel
  }

  fun showTranslation(sourceText: String, translatedText: String, eventGeneration: Long) {
    if (!capturing || eventGeneration != captionGeneration || sourceText != lastCaption || translatedText.isBlank()) return
    Handler(Looper.getMainLooper()).post {
      if (capturing && eventGeneration == captionGeneration && sourceText == lastCaption) updateCaption("$sourceText\n$translatedText")
    }
  }

  fun metrics() = mapOf(
    "lastInferenceMs" to lastInferenceMs.toDouble(),
    "lastRtf" to lastRtf,
    "transcribedWindows" to transcribedWindows.toDouble(),
    "droppedWindows" to droppedWindows.toDouble(),
    "duplicateCaptions" to duplicateCaptions.toDouble(),
    "filteredCaptions" to filteredCaptions.toDouble()
  )

  private fun resetSpeechWindow() {
    java.util.Arrays.fill(pcmWindow, 0)
    pcmWindowSize = 0
    silenceSamples = 0
    speechActive = false
  }

  private fun showLookupPanel() {
    lookupPanel?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
    val panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(16, 12, 16, 12); setBackgroundColor(Color.argb(245, 15, 23, 42)) }
    panel.addView(TextView(this).apply { text = "Chọn từ trong câu gần nhất"; setTextColor(Color.WHITE); textSize = 14f })
    val words = lastCaption.split(Regex("\\s+")).map { it.trim { c -> !c.isLetterOrDigit() && c != '\'' } }.filter { it.length > 1 }.distinctBy { it.lowercase() }.take(12)
    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    words.forEach { word -> row.addView(Button(this).apply { text = word; setOnClickListener { selectedWord = word; ExternalCaptionsModule.emitWordLookup(word, lastCaption, captionGeneration); text = "$word…" } }) }
    panel.addView(HorizontalScrollView(this).apply { addView(row) })
    panel.addView(TextView(this).apply { id = LOOKUP_MEANING_ID; text = if (words.isEmpty()) "Chưa có câu tiếng Anh." else "Chạm một từ để tra nghĩa."; setTextColor(Color.LTGRAY); setPadding(4, 8, 4, 8) })
    panel.addView(Button(this).apply { id = LOOKUP_SAVE_ID; text = "Lưu Flashcard"; isEnabled = false; setOnClickListener { if (selectedWord.isNotBlank()) ExternalCaptionsModule.emitWordSave(selectedWord, lastCaption, captionGeneration) } })
    panel.addView(Button(this).apply { text = "Đóng"; setOnClickListener { hideLookupPanel() } })
    val layout = WindowManager.LayoutParams((resources.displayMetrics.widthPixels * .9).toInt(), WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; y = 80 }
    lookupPanel = panel; windowManager?.addView(panel, layout)
  }

  private fun refreshLookupPanel() { if (lookupPanel != null) showLookupPanel() }
  private fun hideLookupPanel() { lookupPanel?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }; lookupPanel = null; selectedWord = "" }
  fun showLookupResult(word: String, meaning: String, eventGeneration: Long) {
    if (eventGeneration != captionGeneration || word != selectedWord || meaning.isBlank()) return
    Handler(Looper.getMainLooper()).post {
      lookupPanel?.findViewById<TextView>(LOOKUP_MEANING_ID)?.text = "$word · $meaning"
      lookupPanel?.findViewById<Button>(LOOKUP_SAVE_ID)?.isEnabled = true
    }
  }
  fun showSaveResult(word: String, message: String, eventGeneration: Long) {
    if (eventGeneration != captionGeneration || word != selectedWord) return
    Handler(Looper.getMainLooper()).post { lookupPanel?.findViewById<TextView>(LOOKUP_MEANING_ID)?.text = message }
  }

  private fun showOverlay() {
    windowManager = getSystemService(WindowManager::class.java)
    val caption = TextView(this).apply {
      id = CAPTION_ID
      text = "Đang kiểm tra âm thanh nội bộ…"
      setTextColor(Color.WHITE)
      textSize = 17f
      gravity = Gravity.CENTER
      setPadding(24, 18, 24, 18)
      setBackgroundColor(Color.argb(220, 9, 13, 22))
    }
    val captionLayout = WindowManager.LayoutParams(
      (resources.displayMetrics.widthPixels * .82).toInt(), WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL; y = 180 }
    params = captionLayout; overlay = caption; windowManager?.addView(caption, captionLayout)

    val handle = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(10, 4, 4, 4)
      setBackgroundColor(Color.argb(235, 20, 30, 45))
    }
    val drag = TextView(this).apply { text = "⋮⋮ ShortLearn"; setTextColor(Color.rgb(88, 236, 210)); textSize = 13f; setPadding(10, 10, 14, 10) }
    val lookup = Button(this).apply { text = "Tra từ"; setOnClickListener { showLookupPanel() } }
    val collapse = Button(this).apply { text = "—"; setOnClickListener { caption.visibility = if (caption.visibility == View.GONE) View.VISIBLE else View.GONE } }
    val stop = Button(this).apply { text = "Dừng"; setOnClickListener { cleanup(); stopSelf() } }
    handle.addView(drag); handle.addView(lookup); handle.addView(collapse); handle.addView(stop)
    val handleLayout = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.END; x = 18; y = 100 }
    controlParams = handleLayout; controls = handle; windowManager?.addView(handle, handleLayout)
    var downX = 0f; var downY = 0f; var startX = 0; var startY = 0
    drag.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> { downX = event.rawX; downY = event.rawY; startX = handleLayout.x; startY = handleLayout.y; true }
        MotionEvent.ACTION_MOVE -> {
          handleLayout.x = startX - (event.rawX - downX).toInt(); handleLayout.y = startY + (event.rawY - downY).toInt()
          captionLayout.y = handleLayout.y + handle.height
          windowManager?.updateViewLayout(handle, handleLayout); windowManager?.updateViewLayout(caption, captionLayout); true
        }
        else -> false
      }
    }
  }

  private fun updateCaption(text: String) { overlay?.findViewById<TextView>(CAPTION_ID)?.text = text }
  private fun cleanupCapture() {
    capturing = false
    try { recorder?.stop() } catch (_: Exception) {}
    recorder?.release(); recorder = null
    readerThread?.interrupt(); readerThread = null
    whisper?.close(); whisper = null
    generation++
    captionGeneration++
    lastCaption = ""
    resetSpeechWindow()
    projectionCallback?.let { projection?.unregisterCallback(it) }; projectionCallback = null
    projection?.stop(); projection = null
  }
  private fun cleanup() {
    if (cleaningUp) return
    cleaningUp = true
    cleanupCapture()
    hideLookupPanel()
    overlay?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
    controls?.let { try { windowManager?.removeView(it) } catch (_: Exception) {} }
    overlay = null; params = null; controls = null; controlParams = null
    running = false; if (state != "blocked") state = "stopped"
    stopForeground(STOP_FOREGROUND_REMOVE)
    cleaningUp = false
  }
  override fun onDestroy() { cleanup(); if (instance === this) instance = null; super.onDestroy() }
  override fun onTaskRemoved(rootIntent: Intent?) { cleanup(); stopSelf(); super.onTaskRemoved(rootIntent) }
  private fun createChannel() { if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel(CHANNEL, "Phụ đề ngoài ứng dụng", NotificationManager.IMPORTANCE_LOW)) }

  companion object {
    const val ACTION_STOP = "com.shortlearn.app.externalcaptions.STOP"
    const val ACTION_START_MIC = "com.shortlearn.app.externalcaptions.START_MIC"
    private const val EXTRA_RESULT_CODE = "resultCode"; private const val EXTRA_DATA = "data"
    private const val CHANNEL = "external_captions"; private const val NOTIFICATION_ID = 8317; private const val CAPTION_ID = 8318; private const val LOOKUP_MEANING_ID = 8319; private const val LOOKUP_SAVE_ID = 8320; private const val SAMPLE_RATE = 16000
    private const val MODEL_NAME = "ggml-tiny.bin"; private const val MAX_WINDOW_SAMPLES = SAMPLE_RATE * 8
    private const val MIN_SPEECH_SAMPLES = SAMPLE_RATE; private const val END_SILENCE_SAMPLES = SAMPLE_RATE * 3 / 4
    private const val BLOCKED_RMS = 8.0; private const val BLOCKED_READS = 40
    const val FILTER_LIGHT = "light"; const val FILTER_BALANCED = "balanced"; const val FILTER_STRONG = "strong"
    private val FILTERED_CAPTIONS = setOf("[music]", "[applause]", "[silence]", "thank you.", "thanks for watching.")
    @Volatile var running = false; @Volatile var state = "idle"; @Volatile var source = "none"; @Volatile var selectedFilter = FILTER_BALANCED; @Volatile var instance: ExternalCaptionsService? = null
    fun normalizeFilter(level: String) = if (level == FILTER_LIGHT || level == FILTER_STRONG) level else FILTER_BALANCED
    fun configureFilter(level: String) { selectedFilter = normalizeFilter(level); instance?.setFilterLevel(selectedFilter) }
    fun setTranslation(sourceText: String, translatedText: String, generation: Long) { instance?.showTranslation(sourceText, translatedText, generation) }
    fun setLookupResult(word: String, meaning: String, generation: Long) { instance?.showLookupResult(word, meaning, generation) }
    fun setSaveResult(word: String, message: String, generation: Long) { instance?.showSaveResult(word, message, generation) }
    fun start(context: Context, resultCode: Int, data: Intent) { ContextCompat.startForegroundService(context, Intent(context, ExternalCaptionsService::class.java).putExtra(EXTRA_RESULT_CODE, resultCode).putExtra(EXTRA_DATA, data)) }
    fun startMicrophone(context: Context) { ContextCompat.startForegroundService(context, Intent(context, ExternalCaptionsService::class.java).setAction(ACTION_START_MIC)) }
    fun stop(context: Context) { context.startService(Intent(context, ExternalCaptionsService::class.java).setAction(ACTION_STOP)) }
  }
}
