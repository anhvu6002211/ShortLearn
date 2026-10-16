package com.shortlearn.app.externalcaptions

import java.io.File

class ExternalWhisper(model: File) : AutoCloseable {
  private var handle = nativeInit(model.absolutePath)

  init { require(handle != 0L) { "Khong the nap model Whisper" } }

  @Synchronized
  fun transcribe(pcm: ShortArray): String = if (handle == 0L) "" else nativeTranscribe(handle, pcm).trim()

  @Synchronized
  override fun close() {
    if (handle != 0L) nativeRelease(handle)
    handle = 0L
  }

  private external fun nativeInit(path: String): Long
  private external fun nativeTranscribe(handle: Long, pcm: ShortArray): String
  private external fun nativeRelease(handle: Long)

  companion object { init { System.loadLibrary("shortlearn_external_captions") } }
}
