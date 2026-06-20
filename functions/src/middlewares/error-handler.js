import { HttpError } from '../lib/http-error.js';

/**
 * Error-handler central: HttpError → status declarado; qualquer outro → 500 genérico
 * (sem vazar detalhes). Loga o erro completo no servidor.
 */
// eslint-disable-next-line no-unused-vars -- assinatura de 4 args é exigida pelo Express
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[api] erro não tratado:', err);
  res.status(500).json({ error: 'Falha ao processar a requisição.' });
}

/** 404 para rotas não mapeadas. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}
