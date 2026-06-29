import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envolve um handler async para encaminhar rejeições ao error-handler do Express
 * (sem precisar de try/catch em cada rota).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
