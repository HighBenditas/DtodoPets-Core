function normalizedBaseUrl(value: string | undefined) {
  const candidate = value?.trim() || 'http://localhost:3000/api/v1';
  if (!candidate.startsWith('/') && !/^https?:\/\//i.test(candidate)) {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) URL or absolute path');
  }
  return candidate.replace(/\/+$/, '');
}

export const environment = {
  apiBaseUrl: normalizedBaseUrl(import.meta.env.VITE_API_BASE_URL),
  defaultOrganizationSlug:
    import.meta.env.VITE_DEFAULT_ORGANIZATION_SLUG?.trim() || '',
} as const;

