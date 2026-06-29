import { randomBytes } from 'node:crypto';

/** Geração do código/id de grupo (a "senha" do grupo). Classe estática. */
export class GroupCode {
  static #ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /** Gera um código/id de grupo longo e aleatório (24 chars base62). */
  public static generate() {
    const bytes = randomBytes(24);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += GroupCode.#ALPHABET[bytes[i] % GroupCode.#ALPHABET.length];
    }
    return out;
  }
}
