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

/** Token de injeção: uma classe instanciável sem argumentos. */
type Token<T> = new () => T;

/** Instâncias singleton já criadas, por token. */
const instances = new Map<Token<unknown>, unknown>();

/** Factories customizadas por token (opcional; default é `new Token()`). */
const providers = new Map<Token<unknown>, () => unknown>();

/** Detecta ciclos de dependência durante a resolução. */
const resolving = new Set<Token<unknown>>();

/** Registra uma factory customizada para um token (sobrescreve o default). */
export function provide<T>(token: Token<T>, factory: () => T): void {
  providers.set(token as Token<unknown>, factory as () => unknown);
  instances.delete(token as Token<unknown>);
}

/** Resolve (e memoiza) a instância singleton de um token. */
export function inject<T>(token: Token<T>): T {
  const key = token as Token<unknown>;
  if (instances.has(key)) return instances.get(key) as T;

  if (resolving.has(key)) {
    const name = (token as { name?: string })?.name ?? String(token);
    throw new Error(`Ciclo de dependência detectado ao injetar ${name}.`);
  }

  resolving.add(key);
  try {
    const factory = providers.get(key) ?? (() => new token());
    const instance = factory();
    instances.set(key, instance);
    return instance as T;
  } finally {
    resolving.delete(key);
  }
}

/** Limpa instâncias e providers (testes). */
export function reset() {
  instances.clear();
  providers.clear();
  resolving.clear();
}
