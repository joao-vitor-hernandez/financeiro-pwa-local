export const environment = {
  production: true,
  // Em produção no Cloudflare Pages, aponte para o subdomínio do seu Cloudflare Tunnel
  apiUrl: (typeof window !== 'undefined' && (window as any).__API_URL__) || 'https://api.seudominio.com/api/v1',
};
