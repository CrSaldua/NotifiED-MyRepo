import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'notified_auth';

export type StoredSession = {
  accessToken: string;
  refreshToken?: string;
  email: string;
  expiresAt: number;
  profileCompleted: boolean;
};

export async function saveSession(session: StoredSession) {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function markProfileCompleted() {
  const session = await getSession();
  if (session) {
    session.profileCompleted = true;
    await saveSession(session);
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}