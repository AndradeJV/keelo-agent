/**
 * Google OAuth Configuration
 * 
 * Configure no .env (ou Vercel Environment Variables):
 * - VITE_GOOGLE_CLIENT_ID: Client ID do Google Cloud Console
 */

export const googleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};

export const isGoogleConfigured = (): boolean => {
  return !!googleConfig.clientId && googleConfig.clientId.length > 10;
};
