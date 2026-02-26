/**
 * Okta Configuration
 * 
 * Configure estas variáveis no arquivo .env:
 * - VITE_OKTA_ISSUER: https://your-domain.okta.com/oauth2/default
 * - VITE_OKTA_CLIENT_ID: your-client-id
 * - VITE_OKTA_REDIRECT_URI: http://localhost:5173/callback
 */

export const oktaConfig = {
  issuer: import.meta.env.VITE_OKTA_ISSUER || 'https://your-domain.okta.com/oauth2/default',
  clientId: import.meta.env.VITE_OKTA_CLIENT_ID || 'your-client-id',
  redirectUri: import.meta.env.VITE_OKTA_REDIRECT_URI || `${window.location.origin}/callback`,
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
};

export const isOktaConfigured = (): boolean => {
  return (
    oktaConfig.issuer !== 'https://your-domain.okta.com/oauth2/default' &&
    oktaConfig.clientId !== 'your-client-id'
  );
};

