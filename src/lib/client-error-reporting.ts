/**
 * Erros do cliente não são enviados a terceiros por padrão.
 * Em desenvolvimento, o erro completo continua disponível no console.
 * Quando um provedor de monitoramento for adotado, configure remoção de PII antes do envio.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (!import.meta.env.DEV) return;
  console.error("[Bafafá client error]", { error, context });
}
