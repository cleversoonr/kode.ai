import { env } from 'next-runtime-env';

export const getEnv = (key: string, defaultValue?: string): string => {
  try {
    const value = env(key);
    return value || defaultValue || '';
  } catch (error) {
    console.error(`Error getting environment variable ${key}:`, error);
    return defaultValue || '';
  }
};

export const getApiUrl = (): string => {
  const envUrl = getEnv('NEXT_PUBLIC_API_URL');
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }

  return 'http://localhost:8000';
};
