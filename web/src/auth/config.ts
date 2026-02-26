/**
 * OAuth Configuration
 * 
 * Configure via .env (or Vercel Environment Variables):
 * - VITE_GOOGLE_CLIENT_ID: Client ID from Google Cloud Console
 * - VITE_GITHUB_CLIENT_ID: Client ID from GitHub OAuth App
 */

export const googleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};

export const githubConfig = {
  clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
};

export const isGoogleConfigured = (): boolean => {
  return !!googleConfig.clientId && googleConfig.clientId.length > 10;
};

export const isGithubConfigured = (): boolean => {
  return !!githubConfig.clientId && githubConfig.clientId.length > 5;
};

export const isSocialLoginConfigured = (): boolean => {
  return isGoogleConfigured() || isGithubConfigured();
};
