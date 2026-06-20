/**
 * Erro HTTP com status code, para os serviços sinalizarem 400/404/409 etc.
 * O error-handler converte em resposta JSON { error }.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
