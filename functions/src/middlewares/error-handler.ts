import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '#lib/http-error';
import { HttpResponse } from '#lib/http-response';

/**
 * Error-handler central: HttpError → status declarado; qualquer outro → 500 genérico
 * (sem vazar detalhes). Loga o erro completo no servidor. Resposta padronizada em
 * { message, data } via HttpResponse.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction, // assinatura de 4 args exigida pelo Express (mesmo sem uso)
): void {
  if (err instanceof HttpError) {
    HttpResponse.create({ status: err.status, message: err.message, data: null }).send(res);
    return;
  }
  console.error('[api] erro não tratado:', err);
  HttpResponse.create({ status: 500, message: 'Falha ao processar a requisição.', data: null }).send(res);
}

/** 404 para rotas não mapeadas. */
export function notFoundHandler(_req: Request, res: Response): void {
  HttpResponse.create({ status: 404, message: 'Rota não encontrada.', data: null }).send(res);
}
