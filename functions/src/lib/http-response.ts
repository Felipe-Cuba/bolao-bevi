// Resposta HTTP padronizada no formato { message, data }. Builder fluente + forma objeto.
//
// Uso (encadeado):
//   HttpResponse.create().status(404).message('Não encontrado').data(null).send(res);
// Uso (objeto):
//   HttpResponse.create({ status: 404, message: 'Não encontrado', data: null }).send(res);
//
// `toResponse()` devolve só o corpo { message, data }; `send(res)` aplica o status no Express.

import type { Response } from 'express';

interface HttpResponseInit {
  status?: number;
  message?: string;
  data?: unknown;
}

export class HttpResponse {
  private _status = 200;
  private _message = '';
  private _data: unknown = null;

  /** Cria uma resposta, opcionalmente já com { status, message, data }. */
  public static create(init: HttpResponseInit = {}): HttpResponse {
    const r = new HttpResponse();
    if (init.status !== undefined) r._status = init.status;
    if (init.message !== undefined) r._message = init.message;
    if (init.data !== undefined) r._data = init.data;
    return r;
  }

  public status(status: number): this {
    this._status = status;
    return this;
  }

  public message(message: string): this {
    this._message = message;
    return this;
  }

  public data(data: unknown): this {
    this._data = data;
    return this;
  }

  /** Status HTTP escolhido. */
  public get httpStatus(): number {
    return this._status;
  }

  /** Corpo da resposta: { message, data }. */
  public toResponse() {
    return { message: this._message, data: this._data ?? null };
  }

  /** Aplica o status e envia o corpo JSON pelo Express. */
  public send(res: Response): Response {
    return res.status(this._status).json(this.toResponse());
  }
}
