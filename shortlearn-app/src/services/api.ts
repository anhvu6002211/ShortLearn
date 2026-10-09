import { Platform } from 'react-native';

const normalizeBaseUrl = (value: string): string => {
  const baseUrl = value.trim().replace(/\/+$/, '');
  return baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
};

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL;
const platformDefaults = Platform.OS === 'web'
  ? ['http://localhost:5000']
  : Platform.OS === 'android'
    ? [
      'http://10.0.2.2:5000', // Android Emulator ánh xạ máy host qua 10.0.2.2.
      'http://127.0.0.1:5000', // Thiết bị USB dùng `adb reverse tcp:5000 tcp:5000`.
    ]
    : ['http://localhost:5000'];

export const API_BASE_URLS = Array.from(new Set(
  [configuredBaseUrl, ...platformDefaults]
    .filter((value): value is string => Boolean(value))
    .map(normalizeBaseUrl)
));

let preferredBaseUrl: string | null = null;

/**
 * Gọi API Gateway với timeout ngắn và tự thử địa chỉ kế tiếp khi host hiện tại
 * không thể kết nối. Có thể đặt EXPO_PUBLIC_API_URL để bỏ phụ thuộc IP LAN mặc định.
 */
export async function apiRequest(
  path: string,
  init: RequestInit = {},
  timeoutMs = 2500
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let lastError: unknown = new Error('Không có địa chỉ API Gateway khả dụng.');

  const candidates = preferredBaseUrl
    ? [preferredBaseUrl, ...API_BASE_URLS.filter((baseUrl) => baseUrl !== preferredBaseUrl)]
    : API_BASE_URLS;

  for (const baseUrl of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const callerSignal = init.signal;
    const abortFromCaller = () => controller.abort();
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      preferredBaseUrl = baseUrl;
      return response;
    } catch (error) {
      clearTimeout(timeout);
      // An explicit cancellation must not be retried against another host.
      if (callerSignal?.aborted) throw error;
      lastError = error;
    } finally {
      callerSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  throw lastError;
}

export async function getApiError(response: Response): Promise<string> {
  let body: { error?: unknown; message?: unknown; code?: unknown } | null = null;
  try {
    body = await response.json();
  } catch {
    // Fall through to the status mapping below.
  }

  if (response.status === 401) return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
  if (response.status === 403) return 'Bạn chưa có quyền thực hiện thao tác này.';
  if (response.status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
  if (response.status === 409) return 'Dữ liệu này đã tồn tại hoặc vừa được thay đổi.';
  if (response.status === 429) return 'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.';
  if (response.status >= 500) return 'Dịch vụ đang gặp sự cố. Hãy thử lại sau.';

  const message = typeof body?.message === 'string' ? body.message : body?.error;
  return typeof message === 'string' && message.trim()
    ? message.trim().slice(0, 240)
    : 'Yêu cầu chưa hợp lệ. Vui lòng kiểm tra lại thông tin.';
}
