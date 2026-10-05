import * as SecureStore from 'expo-secure-store';

const YOUTUBE_SESSION_KEY = 'shortlearn.youtube-session.v1';
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export interface YouTubeAccount {
  displayName: string;
  email?: string;
  photoUrl?: string;
  channelId?: string;
  channelTitle?: string;
}

export interface YouTubeSession {
  accessToken: string;
  expiresAt: number;
  account: YouTubeAccount;
}

const readError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    return body?.error?.message || body?.error_description || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
};

const isValidSession = (value: unknown): value is YouTubeSession => {
  const session = value as Partial<YouTubeSession> | null;
  return Boolean(
    session &&
    typeof session.accessToken === 'string' &&
    typeof session.expiresAt === 'number' &&
    session.account &&
    typeof session.account.displayName === 'string'
  );
};

export const isSessionActive = (session: YouTubeSession): boolean => (
  session.expiresAt > Date.now() + EXPIRY_SAFETY_MARGIN_MS
);

export async function loadYouTubeSession(): Promise<YouTubeSession | null> {
  try {
    const storedValue = await SecureStore.getItemAsync(YOUTUBE_SESSION_KEY);
    if (!storedValue) return null;

    const session: unknown = JSON.parse(storedValue);
    if (!isValidSession(session) || !isSessionActive(session)) {
      await SecureStore.deleteItemAsync(YOUTUBE_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveYouTubeSession(session: YouTubeSession): Promise<void> {
  await SecureStore.setItemAsync(YOUTUBE_SESSION_KEY, JSON.stringify(session));
}

export async function clearYouTubeSession(): Promise<void> {
  await SecureStore.deleteItemAsync(YOUTUBE_SESSION_KEY);
}

/** Lấy thông tin hiển thị; chỉ giữ metadata cần cho UI, không lưu mật khẩu hay refresh token. */
export async function fetchYouTubeAccount(accessToken: string): Promise<YouTubeAccount> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [profileResponse, channelResponse] = await Promise.all([
    fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers }),
    fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers }),
  ]);

  if (!profileResponse.ok) {
    throw new Error(await readError(profileResponse));
  }

  const profile = await profileResponse.json();
  const channelPayload = channelResponse.ok ? await channelResponse.json() : null;
  const channel = Array.isArray(channelPayload?.items) ? channelPayload.items[0] : null;
  const displayName = channel?.snippet?.title || profile?.name || profile?.email || 'Tài khoản YouTube';

  return {
    displayName,
    email: typeof profile?.email === 'string' ? profile.email : undefined,
    photoUrl: channel?.snippet?.thumbnails?.default?.url || profile?.picture,
    channelId: channel?.id,
    channelTitle: channel?.snippet?.title,
  };
}
