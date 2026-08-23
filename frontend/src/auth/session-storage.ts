const refreshTokenKey = 'dtodopets.admin.refresh-token.v1';

export function storedRefreshToken() {
  return window.sessionStorage.getItem(refreshTokenKey);
}

export function storeRefreshToken(refreshToken: string) {
  window.sessionStorage.setItem(refreshTokenKey, refreshToken);
}

export function clearStoredRefreshToken() {
  window.sessionStorage.removeItem(refreshTokenKey);
}

