#include <jni.h>
#include <algorithm>
#include <string>
#include <vector>
#include "whisper.h"

extern "C" JNIEXPORT jlong JNICALL
Java_com_shortlearn_app_externalcaptions_ExternalWhisper_nativeInit(JNIEnv *env, jobject, jstring path) {
    const char *chars = env->GetStringUTFChars(path, nullptr);
    auto params = whisper_context_default_params();
    params.use_gpu = false;
    whisper_context *context = whisper_init_from_file_with_params(chars, params);
    env->ReleaseStringUTFChars(path, chars);
    return reinterpret_cast<jlong>(context);
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_shortlearn_app_externalcaptions_ExternalWhisper_nativeTranscribe(JNIEnv *env, jobject, jlong handle, jshortArray pcm) {
    auto *context = reinterpret_cast<whisper_context *>(handle);
    if (!context || !pcm) return env->NewStringUTF("");
    const jsize count = env->GetArrayLength(pcm);
    std::vector<jshort> input(count);
    env->GetShortArrayRegion(pcm, 0, count, input.data());
    std::vector<float> audio(count);
    std::transform(input.begin(), input.end(), audio.begin(), [](jshort sample) { return static_cast<float>(sample) / 32768.0f; });
    auto params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.language = "en";
    params.translate = false;
    params.no_context = true;
    params.single_segment = false;
    params.print_progress = false;
    params.print_realtime = false;
    params.print_timestamps = false;
    params.n_threads = 4;
    if (whisper_full(context, params, audio.data(), static_cast<int>(audio.size())) != 0) return env->NewStringUTF("");
    std::string text;
    const int segments = whisper_full_n_segments(context);
    for (int i = 0; i < segments; ++i) text += whisper_full_get_segment_text(context, i);
    return env->NewStringUTF(text.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_shortlearn_app_externalcaptions_ExternalWhisper_nativeRelease(JNIEnv *, jobject, jlong handle) {
    if (auto *context = reinterpret_cast<whisper_context *>(handle)) whisper_free(context);
}