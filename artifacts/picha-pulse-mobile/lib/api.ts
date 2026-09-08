import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'auth_session_token';
export const API_ORIGIN = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

if (API_ORIGIN) {
  setBaseUrl(API_ORIGIN);
}

setAuthTokenGetter(() => SecureStore.getItemAsync(AUTH_TOKEN_KEY));

export function objectUrl(objectPath: string) {
  return `${API_ORIGIN}/api/storage${objectPath}`;
}

export async function uploadLocalFile(
  uploadUrl: string,
  uri: string,
  contentType: string,
) {
  const fileResponse = await fetch(uri);
  const blob = await fileResponse.blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    throw new Error('The file upload did not complete.');
  }
}