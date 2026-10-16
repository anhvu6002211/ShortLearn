package com.shortlearn.app.externalcaptions

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class ExternalCaptionsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var projectionPromise: Promise? = null
  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_MEDIA_PROJECTION) return
      val promise = projectionPromise
      projectionPromise = null
      if (resultCode != Activity.RESULT_OK || data == null) {
        promise?.reject("permission_denied", "Người dùng chưa cho phép thu âm thanh màn hình.")
        return
      }
      try {
        ExternalCaptionsService.start(context, resultCode, data)
        promise?.resolve(null)
      } catch (error: Exception) {
        promise?.reject("start_failed", error.message, error)
      }
    }
  }

  init { context.addActivityEventListener(activityListener); reactContext = context }
  override fun getName() = "ExternalCaptions"

  @ReactMethod fun getStatus(promise: Promise) { promise.resolve(statusMap()) }

  @ReactMethod fun requestOverlayPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
      promise.resolve(true); return
    }
    val activity = context.currentActivity ?: run {
      promise.reject("no_activity", "Không tìm thấy Activity để mở cài đặt quyền overlay."); return
    }
    activity.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")))
    promise.resolve(false)
  }

  @ReactMethod fun start(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("unsupported", "Âm thanh nội bộ cần Android 10 trở lên."); return
    }
    if (!Settings.canDrawOverlays(context)) {
      promise.reject("overlay_permission_denied", "Hãy cấp quyền hiển thị trên ứng dụng khác."); return
    }
    val activity = context.currentActivity ?: run {
      promise.reject("no_activity", "Không tìm thấy Activity để xin quyền MediaProjection."); return
    }
    if (projectionPromise != null) {
      promise.reject("already_requesting", "Yêu cầu quyền MediaProjection đang mở."); return
    }
    val manager = activity.getSystemService(android.media.projection.MediaProjectionManager::class.java)
    projectionPromise = promise
    activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
  }

  @ReactMethod fun startMicrophone(promise: Promise) {
    if (!Settings.canDrawOverlays(context)) {
      promise.reject("overlay_permission_denied", "Hãy cấp quyền hiển thị trên ứng dụng khác."); return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("microphone_permission_denied", "Hãy cấp quyền microphone trong ShortLearn trước khi dùng nguồn dự phòng."); return
    }
    try {
      ExternalCaptionsService.startMicrophone(context)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("start_microphone_failed", error.message, error)
    }
  }

  @ReactMethod fun setFilterLevel(level: String, promise: Promise) {
    ExternalCaptionsService.configureFilter(level)
    promise.resolve(null)
  }

  @ReactMethod fun setTranslation(sourceText: String, translatedText: String, generation: Double, promise: Promise) {
    ExternalCaptionsService.setTranslation(sourceText, translatedText, generation.toLong())
    promise.resolve(null)
  }

  @ReactMethod fun setLookupResult(word: String, meaning: String, generation: Double, promise: Promise) {
    ExternalCaptionsService.setLookupResult(word, meaning, generation.toLong()); promise.resolve(null)
  }

  @ReactMethod fun setSaveResult(word: String, message: String, generation: Double, promise: Promise) {
    ExternalCaptionsService.setSaveResult(word, message, generation.toLong()); promise.resolve(null)
  }

  @ReactMethod fun stop(promise: Promise) {
    ExternalCaptionsService.stop(context)
    promise.resolve(null)
  }

  private fun statusMap() = Arguments.createMap().apply {
    putBoolean("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
    putBoolean("overlayGranted", Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context))
    putBoolean("running", ExternalCaptionsService.running)
    putString("state", ExternalCaptionsService.state)
    putString("source", ExternalCaptionsService.source)
    putString("filterLevel", ExternalCaptionsService.selectedFilter)
    putMap("metrics", Arguments.createMap().apply {
      ExternalCaptionsService.instance?.metrics()?.forEach { (key, value) -> putDouble(key, value) }
    })
  }

  companion object {
    private const val REQUEST_MEDIA_PROJECTION = 8317
    private const val EVENT_CAPTION = "externalCaption"
    private const val EVENT_WORD_LOOKUP = "externalWordLookup"
    private const val EVENT_WORD_SAVE = "externalWordSave"
    @Volatile private var reactContext: ReactApplicationContext? = null
    private fun emit(event: String, payload: WritableMap) { reactContext?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit(event, payload) }
    fun emitCaption(text: String, generation: Long) { emit(EVENT_CAPTION, Arguments.createMap().apply { putString("text", text); putDouble("generation", generation.toDouble()) }) }
    fun emitWordLookup(word: String, context: String, generation: Long) { emit(EVENT_WORD_LOOKUP, Arguments.createMap().apply { putString("word", word); putString("context", context); putDouble("generation", generation.toDouble()) }) }
    fun emitWordSave(word: String, context: String, generation: Long) { emit(EVENT_WORD_SAVE, Arguments.createMap().apply { putString("word", word); putString("context", context); putDouble("generation", generation.toDouble()) }) }
  }
}
