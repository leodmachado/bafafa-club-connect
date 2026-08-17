# Conformidade LGPD — Clube do Bafafã (Bafafá Connect)

**Data:** agosto de 2026 · **Versão analisada:** V20.7 (`main`, commit `9d7c9d5`)
**Escopo:** todo o `supabase/migrations/`, todo o `src/`, e os documentos de privacidade,
retenção, moderação e resposta a incidentes em `docs/`.

---

## Aviso importante

**Não sou advogado e isto não é parecer jurídico.** Este documento é uma avaliação técnica
de risco: eu li o schema, as políticas de RLS, as funções do banco e as telas, e comparei o
que o código realmente faz com o que a Lei nº 13.709/2018 exige e com o que o próprio
aplicativo promete ao usuário. Onde cito artigos da LGPD, é para localizar o problema, não
para dizer qual seria a decisão de um juiz ou da ANPD. Antes de operar em escala — e
especialmente se houver um incidente real — busque orientação jurídica de verdade.

Também vale a calibragem: **isto é um piloto controlado de um bar em Natal, não um banco.**
Uma lista maximalista de exigências não ajudaria ninguém. O que está abaixo está ordenado por
dano concreto e plausível ao titular, e cada correção proposta é proporcional ao tamanho da
operação.

---

## Resumo executivo

O Bafafá Connect está, tecnicamente, **acima da média** do que se vê em aplicativos de porte
comparável. Há trabalho real e verificável de privacidade aqui: as coordenadas de
geolocalização **de fato** não são persistidas, o perfil público **de fato** nasce fechado,
o RLS de `profiles` **de fato** impede que um cliente leia o cadastro de outro, o
consentimento de marketing **de fato** é revogável e cada mudança gera um novo registro, e a
maioridade **de fato** é derivada da data de nascimento no servidor e não do que o cliente
declara. Isso não é decoração — eu conferi cada uma dessas afirmações no código.

O problema não é o que foi construído. É o que **não** foi construído: **os direitos do
titular (Art. 18) existem apenas como um endereço de e-mail.** Não há caminho de exclusão,
não há caminho de acesso individual, e — o achado mais duro deste relatório — o próprio banco
de dados **impede estruturalmente** a exclusão de um usuário que tenha qualquer consumo
registrado, por causa de duas chaves estrangeiras `ON DELETE RESTRICT`. Se um cliente pedir
"apaga tudo meu", hoje o operador não consegue cumprir, mesmo querendo.

O segundo eixo é **transparência (Art. 9)**: o aviso de privacidade era honesto no que dizia,
mas silenciava sobre categorias reais — identidade de gênero, telefone/WhatsApp, foto,
bairro, e principalmente o **histórico de consumo e a segmentação comercial de cada cliente**
— e sobre operadores reais (Cloudflare, Google). Corrigi os pontos factuais no
`src/routes/privacidade.tsx` (lista completa das edições no fim deste documento); a moldura
jurídica do texto eu não toquei.

**Cinco bloqueantes** para deixar gente de verdade entrar. Nenhum deles é caro. O mais caro
é escrever um script SQL de exclusão e testá-lo uma vez.

---

## Riscos ordenados por gravidade

### 🔴 BLOQUEANTE PARA O PILOTO

Coisas que eu não deixaria uma pessoa real usar sem resolver antes.

---

#### B1 — Não existe caminho de exclusão de dados, e o banco o impede na marra

**Artigos:** Art. 18, VI (eliminação dos dados tratados com consentimento) e Art. 16 (término
do tratamento). Também Art. 18, §1º (o pedido pode ser feito por meio simples e gratuito).

**Onde:**
- `supabase/migrations/20260726120000_crm_funil_comercial_v20.sql:487`
  → `public.sales.user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
- `supabase/migrations/20260726120000_crm_funil_comercial_v20.sql:683`
  → `public.collective_goal_contributions.user_id ... ON DELETE RESTRICT`
- `public.profiles.deleted_at` existe desde a primeira migration
  (`20260713150823_...sql:38`) e é **lido** em três lugares (`resenha.tsx:492`,
  `commercial-dashboard.tsx:140`, `admin-panel.tsx:222`), mas **nenhuma linha do projeto
  jamais escreve nessa coluna**. A exclusão lógica existe só no schema.
- Nenhuma função `delete_my_account`, `request_deletion` ou equivalente existe. Confirmei
  varrendo o inventário completo de funções das migrations e o `Functions` de
  `src/integrations/supabase/types.ts`.
- `src/routes/privacidade.tsx` promete exclusão e manda o usuário para
  `mailto:bafafa.bar@gmail.com`. `docs/PLANO_RETENCAO_E_DIREITOS_V2041.md` promete resposta em
  15 dias. Nenhum dos dois aponta para um mecanismo que funcione.

**Cenário de dano concreto:** uma cliente termina um relacionamento que começou no bar,
quer sumir do aplicativo e escreve para `bafafa.bar@gmail.com` pedindo exclusão. O operador
abre o painel do Supabase, tenta apagar o usuário e recebe um erro `23503` de violação de
chave estrangeira, porque ela tem uma venda registrada. Sem um roteiro, o desfecho realista é
um dos dois: ele desiste e responde "não consigo" (descumprimento do Art. 18), ou ele apaga
manualmente tabela por tabela, erra a ordem, e deixa órfãos — foto no Storage, mensagens de
DM com o `sender_id` apontando para o nada, e o nome dela ainda visível na fila de denúncias.

**Correção proporcional:** *não* construa um botão de auto-atendimento agora. Escreva **um
script SQL de exclusão, versionado e testado uma vez em transação**, que:
1. anonimize `sales.user_id` e `collective_goal_contributions.user_id` apontando para um
   usuário-lápide único (ou, melhor, mude essas duas FKs para `ON DELETE SET NULL` e torne a
   coluna anulável — os registros fiscais continuam válidos sem identificar a pessoa);
2. apague o avatar do bucket `avatars` (hoje nada faz isso — ver A3);
3. apague ou anonimize as mensagens de DM e da Resenha da pessoa;
4. só então `DELETE FROM auth.users WHERE id = ...`, deixando as 21 FKs `ON DELETE CASCADE`
   fazerem o resto;
5. registre em `audit_logs` que a exclusão ocorreu, sem copiar dado pessoal para o log.

Guarde o script em `docs/` junto de um roteiro `VERIFICAR_` como os outros. Isso é meia hora
de trabalho e transforma uma promessa em capacidade.

---

#### B2 — Não existe caminho de acesso ou portabilidade individual; o único export é um dump de todo mundo

**Artigos:** Art. 18, I e II (confirmação e acesso), Art. 18, V (portabilidade), Art. 19
(formato e prazo).

**Onde:** a única função de exportação é `public.admin_export_data(_kind, _event_id, _from, _to)`
(`supabase/migrations/20260716123000_management_metrics_pilot.sql:83`), chamada em
`src/components/admin/management-dashboard.tsx:331`. O tipo `'clients'`
(mesma migration, linhas 103–133) devolve, **para todos os clientes de uma vez e sem `LIMIT`**:

```sql
SELECT p.id, p.display_name AS nome, p.username,
  u.email,
  coalesce(u.phone, p.whatsapp) AS telefone,
  p.birth_date AS nascimento,
  p.city AS cidade, p.neighborhood AS bairro,
  p.how_found_us AS como_conheceu, ...
FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
```

Não há nenhum parâmetro `_user_id`.

**Cenário de dano concreto:** um cliente exerce o Art. 18 e pede "me manda tudo que vocês têm
sobre mim". A única ferramenta disponível gera um CSV com nome, e-mail, telefone e data de
nascimento de **toda a base**. Ou o operador responde à mão (e provavelmente incompleto,
porque ele não sabe de cor que existe `crm_segment_memberships`), ou — pior — alguém apressado
usa a ferramenta que existe e comete um vazamento ao tentar cumprir um direito.

**Correção proporcional:** adicione um `_user_id uuid DEFAULT NULL` a `admin_export_data`
que, quando presente, restrinja o `WHERE` a essa pessoa e cubra as tabelas que o titular
esperaria: `profiles`, `user_preferences`, `user_consents`, `checkins`, `user_rewards`,
`reward_redemptions`, `sales`/`sale_items`, `crm_segment_memberships`,
`event_chat_messages`, `private_chat_messages`. Alternativa mais barata ainda para o piloto:
um arquivo `docs/EXPORTAR_TITULAR.sql` com a consulta pronta e um parâmetro no topo. O
formato do Art. 19 pode ser CSV ou JSON; não precisa ser bonito, precisa ser completo.

---

#### B3 — Toda a equipe do bar lê a Resenha inteira, sem check-in, sem janela de tempo, e o usuário não era avisado

**Artigos:** Art. 6, I (finalidade), Art. 6, III (necessidade), Art. 9 (transparência),
Art. 46 (controle de acesso).

**Onde:** `supabase/migrations/20260718120000_security_base_v15.sql:236-240`, dentro de
`public.can_access_event_chat` (regra repetida em
`20260729120000_pilot_readiness_v204.sql:126-130` e em `can_read_event_chat`, linha 166-170):

```sql
  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'moderador')
     OR public.has_role(auth.uid(), 'equipe') THEN
    RETURN true;
  END IF;
```

O papel `equipe` é o do pessoal de porta e balcão — o mesmo que usa `/staff/checkin`. Esse
`RETURN true` acontece **antes** da checagem de check-in e **antes** da janela temporal do
evento, então qualquer pessoa com `equipe` lê qualquer Resenha, de qualquer evento, a
qualquer momento. O `admin-panel.tsx:247` puxa 1000 mensagens brutas de uma vez.

**Cenário de dano concreto:** este é, na minha leitura, o risco de **dano humano mais alto
de todo o projeto**. Duas pessoas se conhecem na Resenha de uma noite. Um barman com papel
`equipe` — colega de trabalho, ex-namorado, alguém com interesse pessoal — lê a conversa
inteira no dia seguinte, de casa, e comenta. Num bar, com álcool, com pessoas que se
conhecem, isso é assédio viabilizado pelo produto. E o aviso de privacidade dizia que "a
Resenha é para conversa entre pessoas com presença confirmada", o que o usuário lê como
"entre nós".

**Correção proporcional — escolha uma, hoje:**
- **Melhor:** remova `equipe` daquele `OR` nas duas funções, deixando apenas `admin` e
  `moderador`. A operação de porta não precisa ler o chat; ela precisa validar QR. Se algum
  dia precisar, faça pela fila de denúncias, que já existe e já é minimizada.
- **Mínimo aceitável:** mantenha o acesso, mas conte para o usuário. **Eu já fiz essa parte**
  — ver a edição E4 na lista do fim. Se você aplicar a correção melhor, volte e estreite
  aquela frase para "a moderação pode lê-la".

---

#### B4 — O plano de resposta a incidentes está com os responsáveis em branco e não tem o gatilho da ANPD

**Artigos:** Art. 48 (comunicação de incidente à ANPD e ao titular), Art. 50 (boas práticas).
Prazo operacional: Resolução CD/ANPD nº 15/2024 fixa **3 dias úteis** a partir do
conhecimento do incidente.

**Onde:** `docs/RESPOSTA_A_INCIDENTES_V18.md`, seção "Responsáveis":

```
Preencher antes do piloto:

- responsável pelo negócio:
- responsável técnico:
- responsável pela comunicação:
- contato jurídico/proteção de dados:
- canal de emergência:
```

Cinco linhas vazias. E, embora o documento diga "busque orientação jurídica e de proteção de
dados para avaliar comunicações e obrigações", ele **não menciona a ANPD, nem o prazo, nem o
dever de comunicar o titular**.

**Cenário de dano concreto:** às 2h da manhã de um sábado alguém percebe que a conta de admin
foi comprometida. O documento existe e é bom nos passos técnicos, mas ninguém sabe quem
liga para quem, e o relógio de 3 dias úteis começa a correr sem que ninguém saiba que ele
existe. Perder o prazo é uma infração autônoma, independentemente de o vazamento em si ter
sido pequeno.

**Correção proporcional:** dez minutos. Preencha os cinco nomes (num piloto de uma pessoa,
podem ser todos o mesmo nome — o ponto é estar escrito) e acrescente um bloco:

> **Comunicação à ANPD.** Se o incidente puder acarretar risco ou dano relevante aos
> titulares, comunicar à ANPD em até 3 dias úteis a contar do conhecimento, pelo formulário
> oficial, e comunicar os titulares afetados. Na dúvida sobre o "risco relevante", comunicar.
> Registrar em `audit_logs` a data do conhecimento, o escopo apurado e a decisão tomada.

---

#### B5 — O aviso de privacidade omitia categorias e operadores reais

**Artigos:** Art. 9 (o titular tem direito ao acesso facilitado às informações sobre o
tratamento, incluindo finalidade, forma, duração e **identificação do controlador e dos
demais responsáveis**), Art. 6, VI (transparência).

**Status: corrigido nesta entrega, pendente de revisão sua.** Detalho as quatro edições no
fim do documento. O que estava faltando:

- **Histórico de consumo e segmentação comercial.** O aviso dizia "Cadastro, consentimentos,
  preferências, presença, interações e segurança". Mas o schema guarda, por pessoa:
  `profiles.lifetime_net_spend_cents`, `profiles.visit_count`, `profiles.last_purchase_at`,
  `profiles.current_segment`, a tabela `sales`/`sale_items` item a item, a
  `customer_event_sessions` com totais e margem por noite, e `crm_segment_memberships` com
  rótulos como `sumido_da_resenha` e `cacador_de_fofoquinha`
  (`20260726120000_crm_funil_comercial_v20.sql:10-22, 30-46, 485-...`). "Entender ativação e
  retorno" não comunica isso a ninguém. **Essa era a omissão mais séria** — é exatamente o
  tipo de descompasso entre prática declarada e prática real que a ANPD costuma apontar.
- **Identidade de gênero, pronomes, telefone/WhatsApp, nascimento, bairro, foto, bio,
  preferências de bebida e comida** — todos coletados (`perfil.tsx:297-321`,
  `auth.tsx:317-325`), nenhum citado.
- **Operadores.** O aviso citava só Supabase, Vercel e Twilio. A CSP em
  `src/lib/security-headers.ts:14-49` e o `__root.tsx:120-124` mostram que o navegador do
  usuário também fala com **Cloudflare** (Turnstile, o captcha, em toda tela de cadastro e
  login) e com a **Google** (Fonts em toda página; Maps/Places no painel admin). Todos
  recebem, no mínimo, o IP do visitante.
- **Transferência internacional.** Supabase, Vercel, Cloudflare e Google mantêm servidores
  fora do Brasil. Art. 33 exige base para a transferência e o Art. 9 exige que ela seja
  informada. Acrescentei a menção factual ao aviso; a moldura jurídica (cláusulas-padrão,
  adequação) é conversa para o advogado.

---

### 🟠 ALTO — corrigir logo, mas não trava a primeira noite

---

#### A1 — Menores: o cadastro não é rejeitado no servidor, e a data de nascimento é editável depois sem validação

**Artigos:** Art. 14 (tratamento de dados de crianças e adolescentes no seu melhor interesse;
Art. 14, §1º exige consentimento específico e destacado de ao menos um dos pais para
crianças). Contexto agravante: é um aplicativo de casa noturna com álcool.

**O que está bem feito — e é bastante:**
- O seletor de ano em `src/routes/auth.tsx:724-727` só oferece anos de 18 anos atrás para
  trás: `Array.from({ length: 83 }, (_, i) => String(currentYear - 18 - i))`.
- `isAdultBirthDate` (`auth.tsx:1076-1085`) faz a conta certa, inclusive validando data real,
  e é chamada tanto no Zod (`superRefine`, linha 70) quanto imperativamente no fluxo por
  telefone (linha 288).
- No servidor, `handle_new_user` **ignora** a declaração do cliente e deriva a maioridade da
  data: `v_is_adult := v_birth IS NOT NULL AND v_birth <= (current_date - interval '18 years')::date`
  (`20260729120000_pilot_readiness_v204.sql:238-245`). O consentimento `'maioridade'` só é
  gravado `IF v_claimed_over18 AND v_is_adult`.
- Um gatilho reavalia em qualquer edição: `profiles_sync_age`
  (`20260715110000_profile_completion_event_chat.sql:159-178`).
- `is_verified_adult` (`v204.sql:64-80`) é aplicado com consistência **dos dois lados** em
  check-in (gatilho `checkins_require_verified_adult`), leitura e escrita na Resenha, envio e
  resposta de salve, e mensagem privada — inclusive verificando o destinatário
  (`v204.sql:382`, `v204.sql:583`).

Isso é bom trabalho e merece ser dito.

**O que falta:** `handle_new_user` **não rejeita** o cadastro. Um menor (ou alguém que chame
`supabase.auth.signUp` direto, sem passar pela tela) recebe linha em `auth.users`, linha em
`profiles` com nome, telefone e nascimento, e papel `gratuito`. Se a data de nascimento vier
malformada, o bloco `EXCEPTION WHEN others THEN v_birth := null` (linhas 238-242) simplesmente
grava `null` e segue. E na tela de perfil o campo é um `type="date"` cru, sem `min`/`max` e
sem chamar `isAdultBirthDate` (`perfil.tsx:690-696`): dá para gravar uma data de menor e
receber "Perfil salvinho."

**Cenário de dano concreto:** duplo. (a) Você acaba com dados pessoais de adolescentes
armazenados sem base legal e sem sequer saber que estão lá. (b) Um menor de 16 anos informa
uma data falsa de adulto, entra no bar por outro caminho, faz check-in e conversa por DM com
adultos dentro do seu produto. O controle real aqui é a porta física — a equipe vê a pessoa —,
o que é uma mitigação legítima e vale registrar.

**Correção proporcional:**
1. No `handle_new_user`, se `v_is_adult` for falso, `RAISE EXCEPTION` (o cadastro falha e
   nenhuma linha fica para trás). É uma linha.
2. Aplique `isAdultBirthDate` no `saveProfile` de `perfil.tsx`, ou simplesmente **remova** a
   edição de data de nascimento do perfil — ninguém precisa mudar a data de nascimento.
3. Escreva um parágrafo no plano de retenção: *"Ao identificar conta de menor de 18 anos,
   apagar imediatamente todos os dados, registrar em `audit_logs` apenas a ocorrência e a
   data, e não solicitar consentimento parental — o serviço é vedado a menores."* Para um
   serviço 18+, a postura correta do Art. 14 é **não tratar**, não é obter consentimento de
   responsável.

---

#### A2 — Na Resenha, nome, @, foto e selos aparecem mesmo com o perfil público fechado

**Artigos:** Art. 6, VI (transparência), Art. 9 (informação clara sobre a forma do
tratamento).

**Onde:** `public.get_event_chat_feed`
(`20260715160000_experience_block1_chat_readonly.sql:116-128`) devolve, por mensagem,
`display_name`, `username`, `avatar_url`, título ativo e selos do autor — **sem consultar
`profiles.is_public`**. `resenha.tsx:694-741` renderiza tudo isso como link para
`/u/$username`.

**Cenário de dano concreto:** a usuária fecha o perfil público justamente para não ser
achada, confia no card do perfil que diz "Telefone, nascimento, bairro (...) nunca aparecem
no perfil público", fala na Resenha, e outra pessoa colhe o `@` dali. O resultado é uma
sensação de controle que o produto não entrega. Note que é um vazamento **de expectativa**,
não de RLS: o dado exposto (nome de exibição e foto num chat) é intrínseco a haver chat.

**Correção proporcional:** transparência, não bloqueio. **Já corrigi o aviso** (edição E4).
O ideal é acrescentar a mesma frase, uma linha, na própria tela da Resenha antes da primeira
mensagem, para que ela chegue no momento em que importa.

---

#### A3 — Fotos de rosto ficam legíveis por URL pública para sempre, inclusive depois de fechar o perfil

**Artigos:** Art. 6, III (necessidade), Art. 15 e 16 (término do tratamento e eliminação),
Art. 46 (segurança).

**Onde:**
- Os dois buckets são `public = true`:
  `20260720120000_application_browser_security_v17.sql:5-8`
  → `('avatars', 'avatars', true, 1572864, ARRAY['image/webp'])`.
  Bucket público no Supabase é servido pela rota `/storage/v1/object/public/...`, que **não
  passa por RLS**. A V20.4 percebeu e documentou isso com honestidade
  (`v204.sql:41-42`: *"Buckets públicos continuam servindo URLs conhecidas"*) e endureceu a
  listagem, mas a URL direta continua aberta.
- O caminho embute o UUID do usuário: `storage.ts:47` monta
  `` `${safeFolder}/${crypto.randomUUID()}.webp` `` com `folder: user.id` (`perfil.tsx:288`).
- Nenhum `createSignedUrl` em todo o `src/`; só `getPublicUrl` (`storage.ts:61`).
- Nada apaga o arquivo em nenhum fluxo de encerramento de conta — porque não existe fluxo de
  encerramento de conta (ver B1).

**Cenário de dano concreto:** o nome do arquivo é aleatório, então **não dá para enumerar** —
isso é importante e reduz muito a gravidade. O risco real é de persistência: alguém que já
viu o perfil da pessoa (um ex, um colega) guardou a URL. A pessoa depois fecha o perfil,
troca a foto, ou pede exclusão. A foto antiga continua servida indefinidamente pelo CDN do
Supabase, com o UUID de autenticação dela no caminho.

**Correção proporcional:** para o piloto, não migre para URL assinada — isso quebra cache e
complica. Faça o barato: (a) inclua a remoção do arquivo no script de exclusão do B1;
(b) faça a troca de avatar apagar o arquivo anterior (`removePublicImage` já existe em
`storage.ts:65-76`, só não está sendo chamada nesse caminho). Migrar para bucket privado com
URL assinada é conversa de "antes de escalar".

---

#### A4 — A retenção é um documento, não um mecanismo. Mensagens de DM e da Resenha ficam para sempre

**Artigos:** Art. 15 e 16 (término do tratamento; eliminação após a finalidade), Art. 9
(informar a duração do tratamento — e o aviso informa prazos que não são executados).

**Onde:** `docs/PLANO_RETENCAO_E_DIREITOS_V2041.md` descreve um processo trimestral manual e
o script de relatório `docs/VERIFICAR_RETENCAO_V2041.sql`. Não existe `pg_cron`, nem
`cron.schedule`, nem qualquer função de expurgo nas migrations — **exceto**
`admin_prune_security_events(_days integer DEFAULT 180)`
(`20260721120000_infrastructure_continuity_v18.sql:390-413`), que cobre só os eventos de
segurança e precisa ser disparada à mão. `private_chat_messages` e `event_chat_messages` só
têm exclusão lógica (`deleted_at`), nunca física. Enquanto isso, `privacidade.tsx` afirma
24 meses para contas inativas e 180 dias para mensagens.

**Cenário de dano concreto:** menos um dano imediato ao titular e mais uma **exposição do
controlador**. Daqui a dois anos alguém pergunta "e as mensagens de 2026?", e a resposta é
que estão todas lá, em texto claro, contrariando o que a política publicada diz. Um aviso que
promete um prazo e não o cumpre é pior do que um aviso que não promete prazo nenhum.

**Correção proporcional:** o plano manual é uma escolha **defensável** para um piloto e o
documento até explica por quê ("limpezas em lote exigem migration ou função administrativa
específica"). O que falta é **evidência de execução**. Duas coisas baratas: (a) coloque no
calendário a primeira execução trimestral e registre o resultado em `audit_logs`, mesmo que
seja "0 registros elegíveis"; (b) escreva a função de expurgo de mensagens agora, enquanto o
volume é zero e é fácil testar, ainda que ela só seja chamada à mão.

---

#### A5 — O painel admin baixa o cadastro inteiro de todo mundo para o navegador, e o CRM mostra telefones na tela

**Artigos:** Art. 6, III (necessidade), Art. 46 (medidas de segurança), Art. 47
(responsabilidade dos agentes).

**Onde:**
- `src/components/admin/admin-panel.tsx:222` → `supabase.from("profiles").select("*").is("deleted_at", null)`,
  **sem `LIMIT`**. A tabela na tela mostra só nome/cidade/bairro/contadores
  (`admin-panel.tsx:3055-3105`), mas o `select("*")` traz `whatsapp`, `phone_e164`,
  `birth_date`, `gender_identity`, `gender_custom`, `how_found_us` e
  `lifetime_net_spend_cents` de **todos os membros** para dentro do navegador, onde ficam em
  memória, no cache do React Query e potencialmente no devtools.
- `src/components/admin/commercial-dashboard.tsx:135-142` lista até 500 clientes por gasto
  acumulado e **renderiza o telefone na tela** (`:377`), com filtro de busca por telefone
  (`:344`).

**Cenário de dano concreto:** o painel é `admin`-only e protegido por MFA (bom — ver mais
abaixo). O risco não é invasão, é **exposição acidental**: alguém abre o painel num
notebook do bar, num monitor visível, ou compartilha tela. Um `select("*")` também significa
que qualquer XSS futuro no painel captura a base inteira em vez de uma linha.

**Correção proporcional:** troque `select("*")` pela lista explícita de colunas que a tabela
realmente renderiza — é uma edição de uma linha e resolve a maior parte. No CRM comercial,
mascare o telefone por padrão (`(84) 9****-**12`) com um botão "revelar" por linha. Nenhuma
das duas quebra a operação.

---

### 🟡 MÉDIO — antes de escalar

---

#### M1 — O consentimento gravado é uma constante do cliente, sem contexto de requisição

**Artigos:** Art. 8, §2º (cabe ao controlador o ônus da prova de que o consentimento foi
obtido), Art. 8, §1º (consentimento por escrito ou outro meio que demonstre a manifestação).

**Onde:** `src/routes/auth.tsx:319-325` (fluxo por telefone) e `:511-517` (fluxo por e-mail)
enviam **literais fixos**, não o estado das caixas:

```ts
is_over_18: true,
accept_terms: true,
accept_privacy: true,
accept_community: true,
marketing_opt_in: formData.marketing,
consent_version: "2.1",
```

Só `marketing_opt_in` carrega a escolha real. O bloqueio é 100% no cliente (`auth.tsx:290-295`
e o Zod das linhas 48-55). Além disso, as colunas `user_consents.ip_address` e
`user_consents.user_agent` (`20260713150823_...sql:154-155`) **nunca são preenchidas** por
nenhum caminho de código — todo `INSERT` lista só `(user_id, kind, accepted, version)`.

**Cenário de dano:** um titular contesta ter aceitado. O que existe é uma linha que o próprio
servidor escreveu, com a string `"2.1"`, sem IP, sem user-agent, sem hash do texto exibido.
É fraco, mas não é nada — o texto da versão 2.1 está versionado no git com data de vigência.

**Correção proporcional:** duas melhorias baratas. (a) Envie o estado real das caixas em vez
de `true` — se o gate do cliente falhar, o servidor grava a verdade. (b) Preencha
`ip_address` e `user_agent`, que já existem, com o contexto da requisição. Não vale a pena
construir hash de documento neste porte.

---

#### M2 — "Aceito a política de privacidade" não é a base legal do serviço, e essa moldura confunde

**Artigos:** Art. 7 (bases legais), Art. 8, §5º (consentimento revogável a qualquer momento),
Art. 9, §1º.

**Situação:** o cadastro grava consentimentos dos tipos `'termos'`, `'privacidade'`,
`'comunidade'`, `'maioridade'` e `'marketing'`. Depois disso, `authenticated` teve
`INSERT/UPDATE/DELETE` revogado em `user_consents`
(`20260719120000_auth_privileged_v16.sql:186-187`) — bom endurecimento —, o que significa que
os quatro primeiros **não têm como ser revogados no aplicativo**. Só o de marketing é, via
`set_my_preferences` (`v16.sql:298-301`), que grava uma nova linha a cada mudança.

**O ponto não é técnico, é conceitual.** Aceitar termos e política **não é consentimento no
sentido do Art. 7, I** — é adesão contratual. A base legal correta para conta, perfil,
autenticação, check-in e programa de fidelidade é o **Art. 7, V (execução de contrato)**;
para segurança, antifraude e moderação, o **Art. 7, IX (legítimo interesse)**; para registros
fiscais de venda, o **Art. 7, II (obrigação legal)**. O consentimento do Art. 7, I é a base
**apenas** de duas coisas neste app — e as duas estão implementadas certinho: comunicações de
marketing e exposição do perfil público. Registrar as outras como "consentimento" cria a
expectativa de revogabilidade que a lei não exige ali e que o produto não entrega.

**Base legal por categoria — como eu descreveria:**

| Categoria de tratamento | Onde vive | Base legal adequada |
| --- | --- | --- |
| Conta, autenticação, perfil, check-in, mimos | `profiles`, `checkins`, `user_rewards` | Art. 7, V — execução de contrato |
| Coordenadas no check-in (uso transitório) | `checkin_with_geolocation` | Art. 7, V — execução de contrato |
| Consumo, vendas, funil, segmentação CRM | `sales`, `customer_event_sessions`, `crm_segment_memberships` | Art. 7, V para o programa; Art. 7, IX para a análise; Art. 7, II para o registro fiscal |
| Resenha e conversas privadas | `event_chat_messages`, `private_chat_messages` | Art. 7, V + Art. 7, IX (moderação e segurança) |
| Denúncias, bloqueios, moderação | `*_reports`, `event_chat_blocks` | Art. 7, IX — legítimo interesse (proteção da comunidade) |
| Eventos de segurança, auditoria, antifraude | `security_events`, `audit_logs`, `otp_attempts` | Art. 7, IX + Art. 16, I |
| **Perfil público** (cidade, gênero, check-ins) | flags `is_public`, `show_*` | **Art. 7, I — consentimento** ✔ implementado corretamente |
| **Marketing** (WhatsApp/e-mail) | `user_preferences.marketing_opt_in` | **Art. 7, I — consentimento** ✔ implementado corretamente, revogável e com trilha |

**Correção proporcional:** ajuste o texto do aviso para dizer qual base sustenta o quê
(**não fiz essa edição — é moldura jurídica, não fato**), e considere renomear os tipos
`'termos'`/`'privacidade'`/`'comunidade'` para algo como `'aceite_termos'`, deixando `kind`
`'marketing'` e a exposição de perfil como os únicos rotulados "consentimento".

---

#### M3 — O perfil público entrega o UUID de autenticação para qualquer anônimo

**Artigo:** Art. 6, III (necessidade).

**Onde:** `public.get_public_profile` retorna `'id', v_profile.id`
(`20260722120000_navigation_feed_geolocation_v19.sql:722`) e é concedida a `anon`
(linha 740). A rota `/u/$username` não tem `ssr: false`, então o UUID também vai no HTML
renderizado no servidor.

**Dano:** baixo isoladamente, mas o `auth.uid()` é um identificador estável entre sistemas e
aparece também no caminho da URL do avatar (A3). Correlacionar duas exposições fica trivial.

**Correção:** remova o campo `id` do JSON — confirmei que `src/routes/u/$username.tsx:84-204`
não o usa para nada na renderização.

---

#### M4 — Segmentação automática de clientes sem menção ao Art. 20

**Artigo:** Art. 20 (direito à revisão de decisões tomadas unicamente com base em tratamento
automatizado que afetem os interesses do titular).

**Onde:** `crm_segment_memberships` com rótulos `bafafa_novo`, `bafafa_recorrente`,
`sumido_da_resenha`, `presenca_garantida`, `cacador_de_fofoquinha`, `fofoqueiro_oficial`
(`20260726120000_crm_funil_comercial_v20.sql:30-46`), alimentados por `refresh_profile_crm` e
`refresh_customer_funnel`, e `profiles.current_segment` usado para liberar mimos e recompensas.

**Dano:** modesto — o pior desfecho é alguém não receber um brinde. Mas é literalmente
"definição de perfil" (Art. 12, §2º) e nenhum documento do projeto menciona.

**Correção:** uma frase no aviso dizendo que o app organiza clientes em grupos automáticos
para oferecer benefícios, e que a pessoa pode pedir revisão pelo canal de privacidade.

---

#### M5 — O papel `moderador` tem leitura no banco sem nenhuma tela correspondente

**Artigos:** Art. 46, Art. 47 (privilégio mínimo).

**Onde:** `/admin` exige `admin` estrito (`src/routes/_authenticated/admin.tsx:18`), mas o
banco concede a `moderador` leitura de `event_chat_messages` inclusive de mensagens ocultas
(`20260715110000_...sql:303-319`), de `event_chat_reports` e de
`admin_private_chat_report_queue` (`v204.sql:692-696`). O privilégio de banco excede
qualquer superfície de aplicação.

**Correção:** ou construa a tela de moderação, ou não atribua o papel a ninguém durante o
piloto. Não é grave enquanto ninguém tiver o papel — só confira isso.

---

#### M6 — Encarregado (DPO) e canal de atendimento

**Artigos:** Art. 41 (indicação e divulgação do encarregado). **Calibragem importante:** a
Resolução CD/ANPD nº 2/2022 **dispensa** agentes de tratamento de pequeno porte de indicar
encarregado, exigindo em contrapartida a disponibilização de um canal de comunicação com o
titular. O Bafafa Gastrobar LTDA muito provavelmente se enquadra.

**Situação:** o aviso publica controlador, CNPJ, endereço completo e o e-mail
`bafafa.bar@gmail.com` em dois lugares (`privacidade.tsx:83-91` e `:179-187`). **Isso já
satisfaz o requisito do canal.** Não é bloqueante e não exige contratar ninguém.

**Correção proporcional (baixo custo, alto retorno):** acrescente ao aviso uma linha dizendo
que o Bafafá é agente de tratamento de pequeno porte, que aquele endereço é o canal oficial
para assuntos de proteção de dados, e o prazo de resposta (o plano de retenção já promete 15
dias — o Art. 18, §3º fala em resposta imediata para a forma simplificada e o §6º em 15 dias
para a declaração completa). Considere também trocar o Gmail por um endereço no domínio do
bar, por credibilidade e continuidade.

---

#### M7 — Transferência internacional

**Artigo:** Art. 33. Supabase, Vercel, Cloudflare e Google mantêm a infraestrutura fora do
Brasil. Acrescentei a menção factual ao aviso (edição E3); a base jurídica da transferência
(cláusulas contratuais-padrão, adequação) é assunto para o advogado, e eu não a inventei no
texto.

---

### 🟢 BAIXO — quando sobrar tempo

- **B-1. `checkins.notes` guarda uma frase em português com distância e precisão** —
  `format('Distância aproximada: %s m; precisão: %s m; raio efetivo: %s m', ...)`
  (`20260728120000_simplificacao_experiencia_v202.sql:429-440`). É um sinal derivado de
  localização em campo de texto livre, arredondado, dentro de um raio já conhecido. Inofensivo,
  mas se um dia virar coluna numérica fica mais fácil de expurgar.
- **B-2. Gancho morto de telemetria da Lovable.** `src/lib/lovable-error-reporting.ts:21-34`
  enviaria a exceção e `window.location.pathname` para `window.__lovableEvents` se esse global
  fosse injetado. Confirmei que **nada no `src/` chama `reportLovableError`** — é código morto.
  Apague o arquivo antes que alguém o use por engano. Elogio adjacente:
  `src/lib/client-error-reporting.ts` é explícito em não mandar erro para terceiros.
- **B-3. Google Fonts servida pela Google** (`src/routes/__root.tsx:120-124`) entrega o IP de
  todo visitante à Google em toda página, inclusive na página de privacidade, antes de
  qualquer consentimento. Auto-hospedar as três famílias resolve e ainda deixa o site mais
  rápido.
- **B-4. `/fofocometro/$eventId` é anônimo e sem limite de taxa.** Verifiquei o RPC
  (`20260727120000_feed_resiliente_fofocometro_v201.sql:152-177`): ele devolve **apenas
  contadores agregados** de `collective_goals` — sem nome, sem foto, sem check-in individual.
  A tela do telão está correta do ponto de vista de privacidade e o comentário no código
  (`$eventId.tsx:32-35`) mostra que isso foi pensado. Resta que qualquer UUID de evento é
  consultável de fora do bar, expondo nomes de evento e de metas, e que `/fofocometro` ficou
  de fora da regra `no-store` de `vercel.json:22`.
- **B-5. `profiles.show_birth_month` é uma preferência morta** — não tem alternador em
  `perfil.tsx` nem `GRANT UPDATE` em `security_base_v15.sql:30-46`. Remova a coluna ou ligue-a.
- **B-6. Colunas `user_consents.ip_address` e `user_agent` nunca preenchidas** (ver M1).

---

## O que já está bem feito

Não é elogio de cortesia. Cada item abaixo eu verifiquei no código, e vários deles são coisas
que aplicativos muito maiores erram.

**Minimização de geolocalização — exemplar.** Este é o melhor achado do projeto.
`checkin_with_geolocation` (`20260728120000_simplificacao_experiencia_v202.sql:348-452`)
recebe latitude e longitude, calcula a distância de Haversine até o local do evento, compara
com o raio efetivo, e **descarta as coordenadas**. Não há coluna de lat/long em `checkins`,
não há PostGIS, não há log. Persiste só `method = 'geolocation'` e uma distância arredondada.
Padrões de localização precisa são um dos dados mais perigosos que um app de vida noturna
pode acumular, e este app simplesmente **não os acumula**. O aviso de privacidade dizia a
verdade sobre isso, e eu conferi linha a linha.

**Privacidade por padrão, com correção retroativa honesta.** A V20.4 mudou os defaults de
`is_public`, `show_birth_month`, `show_city`, `show_checkin_count` e `show_event_preferences`
para `false` (`v204.sql:34-39`). E a V20.4.1 foi além do fácil: fechou os perfis legados que
tinham herdado visibilidade pública **antes** de existir escolha explícita
(`20260730120000_privacy_defaults_v2041.sql`), gravando antes um snapshot em `audit_logs`,
com comentário no topo declarando o risco assumido e um rollback orientado. Assumir a perda de
dez perfis públicos para não manter exposição sem prova de escolha é exatamente a decisão
certa, e documentá-la assim é melhor do que a maioria das empresas faz.

**RLS de `profiles` fechado de verdade.** `20260718120000_security_base_v15.sql:23, 57-63`:
`REVOKE SELECT ON public.profiles FROM anon`, e as únicas políticas de `SELECT` são
`auth.uid() = id` e `has_role(auth.uid(), 'admin')`. **Nenhum cliente lê o cadastro de outro
cliente, ponto.** Toda visibilidade entre pares passa por duas funções `SECURITY DEFINER`
(`get_public_profile` e `get_event_chat_feed`), o que dá um ponto único de auditoria. É a
arquitetura certa.

**Consentimento granular no cadastro, e revogável onde precisa ser.** Não é "aceito os
termos". São quatro caixas separadas, todas desmarcadas por padrão, cada uma linkando para a
seção certa do aviso (`auth.tsx:412-446` e `:573-604`), mais um opt-in de marketing
explicitamente rotulado "(Opcional)". E o de marketing é **revogável de dentro do app**:
`set_my_preferences` grava uma **nova linha** em `user_consents` toda vez que o valor muda
(`20260719120000_auth_privileged_v16.sql:298-301`), preservando o histórico em vez de
sobrescrever. Isso é o Art. 8, §5º e §6º implementados como manda o figurino.

**Maioridade derivada no servidor e aplicada com consistência.** Já detalhei em A1. O ponto
que merece destaque: `is_over_18` **nunca** vem do metadado editável do cliente, e
`is_verified_adult` é checado nos dois lados de cada interação social — inclusive validando o
destinatário de um salve e da mensagem privada (`v204.sql:382`, `:583`). É raro ver esse
cuidado.

**Moderação de conversas privadas genuinamente minimizada.** `admin_private_chat_report_queue`
(`v204.sql:671-719`) faz `JOIN` estrito em `r.message_id`: o moderador vê **a mensagem
denunciada e mais nada** da conversa. E o RLS de `private_chat_messages`
(`20260726120000_...sql:785-792`) **não tem bypass de admin nem de moderador** — o painel não
consegue ler DMs que não foram denunciadas. Melhor ainda: o aviso de privacidade descreve
isso corretamente ao usuário. Prática e texto batendo é o que a ANPD procura.

**Metadados de imagem removidos, sem que fosse pedido.** `prepareImageForUpload`
(`src/lib/storage.ts:78-123`) re-renderiza tudo em canvas e reescreve como WEBP — o que
elimina EXIF, incluindo **GPS embutido em foto tirada pelo celular**. Há ainda validação por
magic bytes (`:125-145`), limite de 8 MB / 24 MP e bucket restrito a `image/webp`. Foto de
perfil com coordenada de casa embutida é um vazamento clássico, e aqui ele não acontece.

**Exportações são admin-only, com MFA e registradas em auditoria.** Ao contrário do que se
poderia supor, `admin_export_data` **grava sim** em `audit_logs` com ator, tipo e contagem de
linhas (`20260716123000_management_metrics_pilot.sql:225-238`), e a tela ainda exibe um
`window.confirm` avisando que o arquivo contém dados pessoais
(`management-dashboard.tsx:322-326`). O problema do B2 é de granularidade, não de controle.

**MFA obrigatório para todo papel privilegiado.** `PRIVILEGED_ROLES = ["admin","moderador","equipe"]`
(`src/lib/auth-security.ts:5`) com bloqueio AAL2 no `beforeLoad` da rota autenticada
(`_authenticated/route.tsx:22-24`) e reforço no banco
(`20260802120000_privileged_aal2_enforcement_v206.sql`). Para um piloto operado por uma pessoa
só, isso é bastante acima do esperado.

**Cabeçalhos e CSP sólidos.** `src/lib/security-headers.ts` monta uma CSP com `default-src 'self'`,
`object-src 'none'`, `frame-ancestors 'none'`, allowlist explícita de conexões; `vercel.json`
acrescenta `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` e `no-store` nas telas
sensíveis; e há `noindex,nofollow,noarchive,nosnippet` global (meta e header). Perfis
públicos não vão parar no Google.

**Nada de dado sensível formal, nem de SDK de anúncio.** Não há CPF, RG, endereço residencial,
biometria, dado de saúde ou geolocalização histórica. Não há Facebook Pixel, Google
Analytics, nem qualquer SDK de publicidade. Para um app de bar, isso é uma escolha deliberada
e correta.

**Moderação preventiva com o texto bloqueado descartado.** Validação no cliente e repetida
por gatilho no banco (`20260731120000_content_moderation_v2042.sql:215-257`), lista de termos
em schema privado, e o conteúdo barrado nunca é inserido. O `docs/MODERACAO_CONTEUDO_V2042.md`
até reconhece explicitamente a limitação (não há métrica de tentativas) e diz que, se um dia
houver, deve registrar categoria e horário, **nunca o texto**. Esse tipo de honestidade em
documentação interna é raro.

**Sobre o `.env` no histórico do git — verifiquei, e não é problema.** O arquivo aparece em
dois commits (`d61a952`, `280ffc1`). Recuperei o conteúdo: são o `SUPABASE_PROJECT_ID`, a
`SUPABASE_URL` e a `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`). **Não há `service_role`,
nem JWT secret, nem senha de banco.** A chave publicável é, por design, embarcada no bundle
que todo visitante baixa — publicá-la não vaza nada. O `.gitignore` atual já cobre
`.env` e `.env.*`. **Não reescreva o histórico por causa disso** — o AGENTS.md tem razão, e
o custo de quebrar o histórico de um repositório conectado à Lovable seria muito maior que o
risco. A única coisa que essa exposição realmente significa é que **o RLS é a única coisa
entre o mundo e o banco** — e é justamente por isso que os achados A5, B3 e M5 importam.

---

## Checklist prático de ações

### Antes de deixar o primeiro usuário real entrar

- [ ] **B1** · Escrever e testar (em transação, uma vez) um script de exclusão de titular.
      Resolver as duas FKs `ON DELETE RESTRICT` em `sales` e `collective_goal_contributions`,
      incluir a remoção do avatar no Storage e o registro em `audit_logs`.
      Guardar em `docs/EXCLUIR_TITULAR.sql` + roteiro `VERIFICAR_`.
- [ ] **B2** · Criar o caminho de acesso individual — parâmetro `_user_id` em
      `admin_export_data`, ou `docs/EXPORTAR_TITULAR.sql` com a consulta pronta.
- [ ] **B3** · Remover `equipe` do bypass em `can_access_event_chat` e `can_read_event_chat`
      (deixar só `admin` e `moderador`). Se optar por manter, estreitar de volta a frase que
      acrescentei ao aviso.
- [ ] **B4** · Preencher os cinco responsáveis em `docs/RESPOSTA_A_INCIDENTES_V18.md` e
      acrescentar o bloco de comunicação à ANPD com o prazo de 3 dias úteis.
- [ ] **B5** · Ler e aprovar (ou ajustar) as quatro edições que fiz em `privacidade.tsx`.

### Antes de escalar para além do piloto

- [ ] **A1** · `RAISE EXCEPTION` no `handle_new_user` quando a data não for de maior de 18;
      validar (ou remover) a edição de data de nascimento em `perfil.tsx`; escrever o
      procedimento de "conta de menor identificada → apagar imediatamente".
- [ ] **A2** · Repetir na tela da Resenha o aviso de que nome, `@` e foto ficam visíveis
      mesmo com o perfil fechado.
- [ ] **A3** · Apagar o avatar anterior na troca de foto (`removePublicImage` já existe) e
      incluir a remoção no script do B1.
- [ ] **A4** · Executar a primeira revisão trimestral de retenção e **registrar o resultado**
      em `audit_logs`, mesmo que seja zero. Escrever a função de expurgo de mensagens agora,
      enquanto o volume é zero.
- [ ] **A5** · Trocar `profiles.select("*")` por colunas explícitas em `admin-panel.tsx:222`;
      mascarar telefone por padrão em `commercial-dashboard.tsx:377`.
- [ ] **M6** · Declarar no aviso a condição de agente de pequeno porte, o canal oficial e o
      prazo de resposta. Migrar o e-mail para o domínio do bar.

### Quando houver tempo

- [ ] **M1** · Enviar o estado real das caixas de consentimento; preencher `ip_address` e
      `user_agent` em `user_consents`.
- [ ] **M2** · Ajustar o aviso para declarar a base legal de cada finalidade (isso passa por
      revisão jurídica — eu não editei).
- [ ] **M3** · Remover `'id'` do retorno de `get_public_profile`.
- [ ] **M4** · Uma frase sobre segmentação automática e direito a revisão (Art. 20).
- [ ] **M5** · Não atribuir o papel `moderador` enquanto não houver tela de moderação.
- [ ] **M7** · Tratar a transferência internacional com o advogado.
- [ ] **B-2** · Apagar `src/lib/lovable-error-reporting.ts` (código morto).
- [ ] **B-3** · Auto-hospedar as fontes.
- [ ] **B-4** · Incluir `/fofocometro` na regra `no-store` do `vercel.json`.
- [ ] **B-5** · Remover ou ligar `profiles.show_birth_month`.

---

## Edições feitas em `src/routes/privacidade.tsx`

Conforme combinado, alterei **apenas afirmações factuais** sobre o que o aplicativo coleta e
com quem compartilha. Não toquei em nenhuma moldura jurídica, em nenhum prazo, em nenhuma
promessa de direito e em nenhum dado do controlador. Nenhuma lógica de aplicação e nenhuma
migration foram modificadas. Todas as quatro edições estão sujeitas à sua revisão.

**E1 — card "Dados essenciais"**
Antes: `"Cadastro, consentimentos, preferências, presença, interações e segurança."`
Depois: `"Cadastro e contato, nascimento, cidade, foto, preferências, presença, consumo no bar, interações e segurança."`
*Motivo:* o texto anterior omitia contato, nascimento, cidade, foto e — principalmente — o
consumo. Todos verificáveis no schema.

**E2 — card "Localização pontual"**
Antes: `"Conferida no momento do check-in; suas coordenadas não ficam gravadas."`
Depois: `"Enviada só para conferir o check-in; suas coordenadas não ficam gravadas."`
*Motivo:* a segunda metade estava correta e eu a mantive. A primeira dava a entender que nada
sai do aparelho; na verdade as coordenadas **trafegam** até o Supabase, são comparadas e
descartadas (`v202.sql:404-440`). A nova redação é exata.

**E3 — parágrafos da seção "Política de Privacidade"**
Acrescentei um parágrafo novo, antes de "Usamos os dados...", enumerando as categorias
realmente armazenadas: nome e sobrenome, `@`, telefone/WhatsApp, e-mail, nascimento, cidade e
bairro, como conheceu o Bafafá, foto, bio, preferências de evento/bebida/comida,
consentimentos, check-ins, mensagens da Resenha e conversas privadas, denúncias e bloqueios,
registros de segurança e auditoria. Deixei explícito que identidade de gênero e pronomes são
**opcionais** e só aparecem no perfil público se a pessoa ligar a opção (que é o
comportamento real de `get_public_profile`). E descrevi o histórico de consumo e o resumo
comercial — visitas, valor acumulado, última compra, marcador de perfil — em linguagem
inteligível.
No parágrafo de fornecedores, acrescentei **Cloudflare** (Turnstile, nas telas de cadastro e
login) e **Google** (fontes do site; Maps/Places no painel), dizendo que o IP e dados básicos
do navegador chegam a eles, e que esses fornecedores **mantêm servidores fora do Brasil**.
Mantive intactas as frases sobre Supabase, Vercel, Twilio e "Não vendemos seus dados pessoais".

**E4 — seção "Regras da comunidade"**
Acrescentei duas frases ao primeiro parágrafo: que a Resenha é espaço coletivo e **a equipe
do Bafafá e a moderação podem lê-la** (achado B3), e que nome, `@`, foto e selos aparecem
para as outras pessoas presentes **mesmo com o perfil público fechado** (achado A2). Ambas
descrevem o comportamento atual do código. **Se você aplicar a correção do B3 e remover o
papel `equipe` do bypass, volte aqui e estreite a primeira frase para "a moderação pode
lê-la".**

---

*Documento técnico. Verificações executadas em `main` @ `9d7c9d5`. Os 31 testes,
`tsc --noEmit` e `eslint` continuam passando após as edições. Novamente: não sou advogado.*
