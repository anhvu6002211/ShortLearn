cmake_minimum_required(VERSION 3.13)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

set(CMAKE_CXX_STANDARD 17)
set(WHISPER_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules/whisper.rn/cpp)
include_directories(${WHISPER_DIR} ${WHISPER_DIR}/ggml-cpu)

add_library(shortlearn_external_captions SHARED
    external/external_captions_jni.cpp
    ${WHISPER_DIR}/ggml.c
    ${WHISPER_DIR}/ggml.cpp
    ${WHISPER_DIR}/ggml-alloc.c
    ${WHISPER_DIR}/ggml-backend.cpp
    ${WHISPER_DIR}/ggml-backend-meta.cpp
    ${WHISPER_DIR}/ggml-backend-reg.cpp
    ${WHISPER_DIR}/ggml-backend-dl.cpp
    ${WHISPER_DIR}/ggml-cpu/amx/amx.cpp
    ${WHISPER_DIR}/ggml-cpu/amx/mmq.cpp
    ${WHISPER_DIR}/ggml-cpu/ggml-cpu.c
    ${WHISPER_DIR}/ggml-cpu/ggml-cpu.cpp
    ${WHISPER_DIR}/ggml-cpu/quants.c
    ${WHISPER_DIR}/ggml-cpu/traits.cpp
    ${WHISPER_DIR}/ggml-cpu/repack.cpp
    ${WHISPER_DIR}/ggml-cpu/unary-ops.cpp
    ${WHISPER_DIR}/ggml-cpu/binary-ops.cpp
    ${WHISPER_DIR}/ggml-cpu/vec.cpp
    ${WHISPER_DIR}/ggml-cpu/ops.cpp
    ${WHISPER_DIR}/ggml-opt.cpp
    ${WHISPER_DIR}/ggml-threading.cpp
    ${WHISPER_DIR}/ggml-quants.c
    ${WHISPER_DIR}/gguf.cpp
    ${WHISPER_DIR}/whisper.cpp
)

target_compile_definitions(shortlearn_external_captions PRIVATE _GNU_SOURCE WSP_GGML_CPU_GENERIC)
target_compile_options(shortlearn_external_captions PRIVATE -O3 -DNDEBUG -DWSP_GGML_USE_CPU -DWSP_GGML_USE_CPU_REPACK -pthread)
target_link_libraries(shortlearn_external_captions log android)