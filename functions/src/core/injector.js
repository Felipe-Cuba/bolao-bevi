/**
 * Injetor de dependências minimalista, inspirado no `inject()` do Angular.
 *
 * - `inject(Token)` devolve a instância única (singleton) associada ao token, criando-a
 *   sob demanda na primeira chamada (lazy).
 * - O token é a própria classe. Por padrão, o provider é a classe instanciada sem args;
 *   o construtor pode chamar `inject()` para obter suas dependências (resolução lazy).
 * - `provide(Token, factory)` permite sobrescrever a criação (ex.: testes/mocks).
 * - `reset()` limpa as instâncias (útil em testes).
 *
 * Uso:
 *   class Repo {}
 *   class Service { repo = inject(Repo); }
 *   const service = inject(Service);
 */

/** Instâncias singleton já criadas, por token. */
const instances = new Map();

/** Factories customizadas por token (opcional; default é `new Token()`). */
const providers = new Map();

/** Detecta ciclos de dependência durante a resolução. */
const resolving = new Set();

/** Registra uma factory customizada para um token (sobrescreve o default). */
export function provide(token, factory) {
  providers.set(token, factory);
  instances.delete(token);
}

/** Resolve (e memoiza) a instância singleton de um token. */
export function inject(token) {
  if (instances.has(token)) return instances.get(token);

  if (resolving.has(token)) {
    const name = token?.name ?? String(token);
    throw new Error(`Ciclo de dependência detectado ao injetar ${name}.`);
  }

  resolving.add(token);
  try {
    const factory = providers.get(token) ?? (() => new token());
    const instance = factory();
    instances.set(token, instance);
    return instance;
  } finally {
    resolving.delete(token);
  }
}

/** Limpa instâncias e providers (testes). */
export function reset() {
  instances.clear();
  providers.clear();
  resolving.clear();
}
