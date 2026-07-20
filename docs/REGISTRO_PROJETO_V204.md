# Registro do projeto — V20.4.2

## Versão e referência

- Versão anterior: V20.3.
- Versão desta atualização: V20.4.2 — prontidão, privacidade e moderação preventiva para o piloto.
- Branch canônica da aplicação completa: `mvp-checkin-v1`.
- Projeto Supabase: `xijjohgokwfkqfkkhsyn` (`bafafa-club-connect`).
- Projeto Vercel: `prj_h2SFRn7SZPyB38U8jQgPfYeEUCQD`.
- Produção não foi alterada nesta atualização.

## Decisões preservadas

- Navegação pública com BAFAFEED, Fofoquinhas, Resenha e Perfil.
- Agenda/Eventos preservada tecnicamente e oculta do cliente.
- Sessão da Casa é termo interno; o cliente vê apenas noite, presença e Resenha.
- Clique externo é mensurado, mas compra externa não é afirmada pelo app.
- Painel de criação de eventos não foi repaginado.

## Escopo concluído

- Consentimentos explícitos no telefone e no e-mail, versão 2.1.
- Marketing opcional e desligado por padrão.
- Página pública de termos, privacidade, comunidade e direitos.
- Controlador, CNPJ, endereço e canal `bafafa.bar@gmail.com` publicados na política.
- Critérios formais de retenção e relatório trimestral somente de leitura documentados.
- Perfil público fechado por padrão para novos cadastros.
- Dez perfis legados fechados por padrão, sem apagar dados, com snapshot em auditoria.
- Maioridade derivada do nascimento e exigida em check-in/Resenha.
- Salves lidos por RPC segura, sem leitura direta de perfis.
- Conversa privada com limite de envio, bloqueio, denúncia e moderação.
- Moderação preventiva de nomes, `@`, Resenha, salves e conversa privada em cinco categorias.
- Normalização de acentos, caixa, separadores, repetições e substituições comuns antes do bloqueio.
- Lista de termos no schema privado, sem acesso de visitante ou cliente autenticado.
- Listagem ampla de objetos dos buckets públicos removida.
- Funções de gatilho indisponíveis como endpoints de cliente.
- Contraste, foco, navegação atual, alvos de toque e movimento reduzido revisados.
- CSP estática conciliada com o Google Maps já usado pelo painel.
- Tipos Supabase regenerados e `typecheck` incluído na CI.

## Banco e histórico

- Migration no repositório: `20260729120000_pilot_readiness_v204.sql`.
- Migration de conciliação: `20260730120000_privacy_defaults_v2041.sql`.
- Migration de moderação: `20260731120000_content_moderation_v2042.sql`.
- Registro criado pelo conector no Supabase: `20260718033310 / pilot_readiness_v204`.
- Registro criado pelo conector para a conciliação: `20260718163928 / privacy_defaults_v2041`.
- Registro remoto da moderação: pendente. O conector recusou a chamada de aplicação em 18/07/2026;
  não houve alteração parcial no banco.
- A diferença de timestamp é do registro automático do conector; o SQL aplicado é o mesmo da migration.
- As migrations antigas continuam sem histórico remoto. Elas não devem ser reaplicadas em lote.
- Nenhum dado existente foi apagado. As preferências anteriores dos dez perfis foram preservadas em
  `audit_logs`; todos começaram privados e podem publicar novamente pelo próprio Perfil.
- A migration de moderação é incremental, não apaga histórico e rejeita conteúdo novo antes da
  persistência. O script de verificação também procura correspondências no conteúdo legado.
- Merge e deploy de produção permanecem bloqueados até aplicar `content_moderation_v2042` e confirmar
  `verificacao_ok = true` no projeto correto.

## Pendências antes de convidar usuários

1. Confirmar provedor de SMS, remetente e entrega real de OTP em um telefone externo.
2. Executar o roteiro de aceitação em dois celulares reais e com contas distintas.
3. Criar backup imediatamente antes do primeiro piloto e registrar responsável operacional.
4. Validar a primeira revisão trimestral antes de automatizar qualquer exclusão por retenção.
5. Executar os casos de falso positivo e disfarce do roteiro de moderação em aparelho real.

## Riscos conhecidos

- 54 avisos do advisor sobre `SECURITY DEFINER` permanecem porque as RPCs são endpoints intencionais;
  cada função precisa continuar validando `auth.uid()` e/ou papel internamente.
- Há 183 alertas de performance herdados. Alterações globais de índices e RLS foram adiadas para não
  aumentar o risco antes do piloto; medir lentidão real antes de priorizar.
- A proteção nativa contra senhas vazadas exige Supabase Pro. O risco foi aceito para o piloto porque
  o acesso canônico do cliente será telefone + OTP pela Twilio; e-mail/senha será contingência temporária.
- A conciliação dos dez perfis existentes foi executada e verificada: nenhum permanece público.
- Não há suíte automatizada de E2E. Build, lint, tipos, verificação SQL e resposta HTTP local cobrem a
  atualização, mas não substituem os testes em aparelhos reais.
- Os bundles principais continuam acima de 500 kB; dividir scanner e painel é a próxima otimização.
- A lista automática não interpreta contexto. Denúncia, bloqueio e revisão humana continuam sendo a
  proteção para ironia, novas gírias e disfarces ainda desconhecidos.

## Próximo passo recomendado

Executar o roteiro `TESTE_ACEITACAO_PILOTO_V204.md` em uma janela operacional controlada. Só depois
aprovar o merge e o comando de deploy de produção.
