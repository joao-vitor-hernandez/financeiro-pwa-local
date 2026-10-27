export const environment = {
  production: true,
  // Aponta para o subdomínio do túnel da API no seu domínio entrefilas.com.br
  apiUrl:
    (typeof window !== 'undefined' && (window as any).__API_URL__) ||
    'https://api-fin.entrefilas.com.br/api/v1',
};
