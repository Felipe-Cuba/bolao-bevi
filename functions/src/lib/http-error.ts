/**
 * Erro HTTP com status code, para os serviços sinalizarem 400/404/409 etc.
 * O error-handler converte em resposta padronizada { message, data }.
 */
export class HttpError extends Error {
  public status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
