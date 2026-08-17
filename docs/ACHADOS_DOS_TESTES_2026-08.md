# Achados da cobertura de testes unitários — agosto/2026

Este documento reúne bugs, comportamentos surpreendentes e arestas frágeis
encontrados enquanto os testes de `test/unit/` eram escritos.

**Nenhum código de `src/` foi alterado.** O objetivo da tarefa era cobrir o que
existe, não mudá-lo. Cada item abaixo está registrado por um teste que passa
hoje, documentando o comportamento **atual**. Esses testes têm o nome começando
com `COMPORTAMENTO ATUAL:` e um comentário apontando para cá — se um item for
corrigido, o teste correspondente vai falhar, e é aí que ele deve ser reescrito
para descrever a regra nova.

Ordem: por gravidade estimada para o piloto.

---

## 🔴 Alta — vale decidir antes do piloto

### 1. `normalizePhoneE164BR` transforma número estrangeiro em brasileiro

`src/lib/commercial.ts:17-22`

```js
normalizePhoneE164BR("+1 202 555 0100"); // -> "+5512025550100"
```

A função tira toda a pontuação, sobra `12025550100` (11 dígitos), e a regra
"11 dígitos = celular brasileiro sem DDI" acrescenta `+55`. O número de um
turista ou de um fornecedor de fora vira um celular brasileiro **que existe** e
pertence a outra pessoa. Como esse valor alimenta contato de CRM e WhatsApp, a
mensagem é entregue ao destinatário errado.

O `+` original é descartado logo no começo (`value.replace(/\D/g, "")`), então a
informação "já tem DDI" está disponível e simplesmente não é usada.

Teste: `test/unit/commercial.test.ts` → "número estrangeiro é transformado em
brasileiro".

### 2. Moderação de conteúdo falha aberta (fail-open)

`src/lib/content-moderation.ts:23` e todos os pontos de uso

```js
if (error) return "unavailable";
```

Quando a RPC `check_content_allowed` falha (rede, timeout, permissão, função
ausente), a função devolve `"unavailable"`. Só que **todos** os chamadores
comparam com `"blocked"`:

- `src/routes/auth.tsx:303` e `src/routes/auth.tsx:497`
- `src/routes/_authenticated/perfil.tsx:280`
- `src/routes/_authenticated/resenha.tsx:380`, `:459` e `:511`

Ou seja: com a moderação fora do ar, todo nome de exibição, @usuario e mensagem
da Resenha passa direto. O tipo `CommunityContentStatus` prevê os três estados,
mas nenhuma tela trata o terceiro.

Isso pode ser a decisão certa (é melhor deixar a casa conversar do que travar o
app inteiro), mas hoje é uma decisão **implícita**. Vale escolher
conscientemente, e no mínimo avisar o usuário ou registrar o evento quando cair
nesse caminho. Note também que `display_name` e `username` ficam gravados no
perfil — nesses dois casos o custo de um falso "liberado" é permanente, enquanto
o de uma mensagem de chat é passageiro.

Teste: `test/unit/content-moderation.test.ts` → "'unavailable' é permissivo — os
callers só barram 'blocked'".

### 3. `formatPhoneBR` come o DDD 55

`src/lib/commercial.ts:11`

```js
const digits = value.replace(/\D/g, "").replace(/^55/, "").slice(0, 11);
```

O `^55` é removido **antes** de olhar o tamanho do número, então quem é do DDD 55
(região de Santa Maria/RS) perde o próprio DDD:

```js
formatPhoneBR("5511111111"); // -> "(11) 11111-1"
```

Curiosamente `normalizePhoneE164BR` acerta esse mesmo caso (`"5512345678"` →
`"+555512345678"`), porque lá a checagem de `55` exige 12 dígitos ou mais. As
duas funções ficam com regras diferentes para o mesmo dado.

Teste: `test/unit/commercial.test.ts` → "come o DDD 55 achando que é código do
país".

---

## 🟡 Média — corrigir quando mexer no arquivo

### 4. Leitura do marcador de recuperação de senha é destrutiva

`src/lib/auth-security.ts:106-124`

`readValidPasswordRecovery(userId)` apaga o marcador quando o `userId` não bate:

```js
const sameUser = !userId || marker.userId === userId;
if (!validShape || !fresh || !sameUser) {
  clearPasswordRecovery(); // <- efeito colateral numa função de leitura
  return null;
}
```

Se qualquer tela consultar com o id errado — por exemplo antes de a sessão
terminar de carregar, ou durante uma troca de conta —, o fluxo de recuperação do
usuário legítimo é perdido silenciosamente e ele precisa pedir um novo e-mail.
Uma função chamada `read...` não deveria destruir o que leu; a limpeza por
expiração faz sentido, a limpeza por "não é o usuário que perguntei" não.

Teste: `test/unit/auth-security.test.ts` → "consultar com o usuário errado apaga
um marcador legítimo".

### 5. Formatadores de data lançam exceção em data inválida

`src/lib/bafafa.ts:1-26`

`formatEventDate`, `formatEventTime` e `formatDateTime` fazem
`new Intl.DateTimeFormat(...).format(new Date(value))` sem validar. Com uma data
inválida, `Intl` lança `RangeError: Invalid time value`:

```js
formatEventDate(""); // RangeError
formatEventDate("data quebrada"); // RangeError
```

Como são chamados direto no JSX das telas de evento e carteirinha, um
`starts_at` nulo/corrompido não vira "—": derruba a árvore de componentes
inteira. Repare que `effectiveEventStatus` (`src/lib/event-status.ts:13`) trata
o mesmo caso com elegância, devolvendo o status gravado — os dois módulos
tratam data inválida de formas opostas.

Teste: `test/unit/bafafa.test.ts` → "lança RangeError em data inválida".

### 6. `NaN` atravessa os clamps de porcentagem e de raio

- `src/lib/profile-completion.ts:39-42` — `Math.max(0, Math.min(100, NaN))` é
  `NaN`. Um `percentage` que chegue como `"muito"` (ou qualquer string não
  numérica) sai como `NaN` e vai parar na barra de progresso do perfil.
- `src/lib/profile-completion.ts:32` — mesma coisa com `weight`.
- `src/lib/house-session.ts:43-44` — `Number(row.geofence_radius_m ?? 180)` é
  `NaN` para valor não numérico. O `??` só cobre `null`/`undefined`. E `NaN` é
  pior que um padrão errado: **toda** comparação de distância com `NaN` é falsa,
  então o check-in por geolocalização passaria a recusar todo mundo sem nenhuma
  mensagem de erro.

O padrão `Number.isFinite(x) ? x : padrão` resolveria os três.

Testes: `test/unit/profile-completion.test.ts` → "percentual não numérico vira
NaN em vez de 0"; `test/unit/house-session.test.ts` → "raio não numérico vira
NaN em vez do padrão".

### 7. `friendlyAuthError` traduz "password" cedo demais

`src/lib/auth-security.ts:166`

```js
if (normalized.includes("weak_password") || normalized.includes("password")) {
  return "A senha não atende aos requisitos de segurança.";
}
```

O segundo `includes` é largo demais. Qualquer mensagem do Supabase que contenha
a palavra "password" — inclusive as que não têm nada a ver com força de senha —
recebe o texto de requisitos:

| Mensagem do Supabase                                     | O membro lê                            |
| -------------------------------------------------------- | -------------------------------------- |
| `New password should be different from the old password` | "A senha não atende aos requisitos..." |
| `Password recovery requires an email`                    | "A senha não atende aos requisitos..." |
| `Auth session missing for password update`               | "A senha não atende aos requisitos..." |

Nos três casos o membro fica tentando inventar uma senha mais forte enquanto o
problema é outro. A ordem dos `if` está correta (credenciais, captcha e limite de
tentativas vêm antes e ganham); o problema é só a largura desse ramo.

Teste: `test/unit/auth-security.test.ts` → "qualquer mensagem com 'password'
vira erro de requisitos".

---

## 🟢 Baixa — arestas conhecidas, registradas para não surpreender depois

### 8. `formatPhoneBR` agrupa telefone fixo errado

`src/lib/commercial.ts:14` — o corte é sempre no 7º dígito, então um fixo de 10
dígitos sai como `"(11) 32654-321"` em vez de `"(11) 3265-4321"`. Só cosmético,
mas aparece na ficha do cliente.

### 9. `normalizePhoneE164BR` não tem caminho de rejeição

`src/lib/commercial.ts:21` — a última linha devolve `` `+${digits}` `` aconteça o
que acontecer:

```js
normalizePhoneE164BR(""); // -> "+"
normalizePhoneE164BR("abc"); // -> "+"
normalizePhoneE164BR("987654321"); // -> "+987654321"  (celular sem DDD)
```

Nenhum chamador distingue esses retornos de um número válido.

### 10. Regras de senha usam dois conjuntos de acentos diferentes

`src/lib/auth-security.ts:135` (lista explícita `[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]`) versus
`src/lib/auth-security.ts:151` (faixa `[A-ZÁ-Ú]`). As duas discordam:

- **`À`** (U+00C0) está na lista mas fica fora da faixa (que começa em `Á`,
  U+00C1). `"Àgua!gelada12"` é aceita como válida mas perde um ponto de força —
  a barra mostra a senha como mais fraca do que a mesma senha com `Á`.
- **`Ü`** (U+00DC) não está em nenhum dos dois. `"Übermeister1!"` é recusada com
  "Inclua pelo menos uma letra maiúscula", o que confunde quem digitou uma
  maiúscula.

### 11. A lista de palavras fracas não cobre "Bafafã"

`src/lib/auth-security.ts:144` — o padrão tem `bafafa` sem til, então
`"Bafafã#Club2026"` (o nome da casa escrito corretamente) passa como senha
válida. É justamente a variante que um membro escreveria.

### 12. A regra de caractere repetido é redundante

`src/lib/auth-security.ts:143` — `/^(.)\1+$/` só casa quando a senha inteira é o
mesmo caractere. Nesse caso ela já falha em maiúscula, minúscula, número ou
símbolo, porque um único caractere não pode ser as quatro coisas. A regra nunca
é o único problema apontado.

Na mesma função, `Math.min(score, 5)` (`:155`) é inalcançável: os cinco `if` de
pontuação somam no máximo 5.

### 13. `clearAuthSecurityCache` não cancela a requisição em voo

`src/lib/auth-security.ts:56-59`

A guarda de geração funciona e é bem pensada: uma resposta que saiu antes da
limpeza não repovoa o cache (`:43`). Mas `roleRequests` só é esvaziado no
`.finally()` (`:49`), então uma chamada feita **logo depois** da limpeza, com a
consulta anterior ainda pendente, pega carona nela e recebe os papéis de antes.
A janela é curta (uma requisição) e o cache não é contaminado — por isso está na
categoria baixa —, mas o retorno imediato pode estar desatualizado.

Teste: `test/unit/auth-security.test.ts` → "a limpeza não cancela a requisição em
voo".

### 14. `effectiveEventStatus` não valida a ordem das datas

`src/lib/event-status.ts:16-20` — com `ends_at` anterior a `starts_at`, o evento
nunca fica `"ongoing"`: no instante do início já vale `referenceTime > endsAt`,
então ele pula de `"scheduled"` direto para `"ended"`. Um erro de digitação no
cadastro faz o evento nascer encerrado, sem aviso.

### 15. `fofocometroPercent` só limita o teto

`src/lib/fofocometro.ts:17` — `Math.min(100, ...)` protege contra passar de 100%,
e `Math.max(target_count, 1)` protege contra divisão por zero, mas um
`current_count` negativo sai como porcentagem negativa (`-10`). Só aconteceria
por erro de contagem no banco, mas a barra do Fofocômetro receberia o valor.

### 16. Truthiness engole benefícios zerados

`src/lib/bafafa.ts:35` e `:38` — as condições são
`benefit_type === "percent_off" && campaign.discount_percent`. Uma campanha com
`discount_percent: 0` (ou `fixed_off_cents: 0`) cai no fallback e vira
`"Mimo exclusivo"` / `"Benefício em X"`, escondendo que o benefício está mal
cadastrado em vez de deixar o erro visível.

### 17. `rewardStatusLabel` erra para o lado generoso

`src/lib/bafafa.ts:52` — `new Date("qualquer").getTime()` é `NaN`, e
`NaN < Date.now()` é `false`, então um `expires_at` corrompido deixa o mimo
`"Disponível"` para sempre. É o lado seguro para o membro e o inseguro para a
casa.

### 18. `parseProfileCompletion` e `parseHouseSession` aceitam quase-objetos

- `src/lib/profile-completion.ts:21` — `typeof [] === "object"`, então um array
  atravessa a guarda. O resultado acaba sendo o objeto vazio (porque
  `array.items` é `undefined`), mas por acidente, não por checagem.
  `parseHouseSession` (`src/lib/house-session.ts:23`) rejeita array
  explicitamente — os dois parsers do mesmo tipo de dado não seguem a mesma
  regra.
- `src/lib/house-session.ts:25` — a guarda de `id` é de tipo, não de conteúdo:
  `{ id: "" }` é aceito como sessão válida.
- `src/lib/house-session.ts:45-46` — `venue_address` usa `.trim()` para decidir
  se guarda, mas guarda o valor **original**, com os espaços das pontas.

### 19. `nextProfileTask` ignora o `next_key` do banco

`src/lib/profile-completion.ts:48-50` — a função recalcula a próxima tarefa pela
ordem dos itens em vez de usar o `next_key` que o próprio RPC devolveu. Se os
dois discordarem, partes diferentes da tela de perfil apontam tarefas
diferentes.

### 20. O ramo `GEOLOCATION_FAILED` é inalcançável

`src/lib/geolocation.ts:82-88`

```js
const code =
  lastError?.code === lastError?.TIMEOUT
    ? "GEOLOCATION_TIMEOUT"
    : ...
```

Quando o navegador nunca chama o callback de erro, `lastError` continua `null` e
a comparação vira `undefined === undefined`, que é **verdadeira**. Ou seja: o
silêncio total do GPS é classificado como `GEOLOCATION_TIMEOUT` e o ramo
`GEOLOCATION_FAILED` nunca é alcançado a partir daqui.

Por sorte a mensagem resultante ("A localização demorou demais...") é a correta
para esse caso, então o membro não é prejudicado — mas o acerto é acidental.

Teste: `test/unit/geolocation.test.ts` → "silêncio total do GPS também vira
GEOLOCATION_TIMEOUT".

### 21. A precisão alvo tem piso silencioso de 20 m

`src/lib/geolocation.ts:59` — `accuracyM <= Math.max(20, targetAccuracyM)`. Quem
chamar com `targetAccuracyM: 10` recebe, na prática, 20 m. O piso é razoável
(esperar por 10 m em celular é esperar até o timeout), mas o parâmetro sugere um
controle que não existe abaixo desse valor.

---

## O que foi verificado e está correto

Nem todo achado é problema — vale registrar o que passou no escrutínio, para não
ser reinvestigado:

- **A guarda de geração do cache de papéis** (`src/lib/auth-security.ts:37,43`)
  funciona. Foi confirmada por mutação: trocando a condição por `true`, dois
  testes ficam vermelhos. Sem ela, um logout durante a consulta teria os papéis
  antigos restaurados pela resposta atrasada.
- **Os limites de `effectiveEventStatus`** são inclusivos nas duas pontas: no
  instante exato de `starts_at` o evento já está `"ongoing"` e no instante exato
  de `ends_at` ainda está. A duração padrão de 8h vale tanto para `ends_at: null`
  quanto para `ends_at` inválido.
- **A janela de 20 minutos da recuperação de senha** é inclusiva: exatamente 20
  minutos ainda vale, 20 minutos e 1 ms não.
- **A precedência de `selectFofocometroGoal`** (ativa → agendada → concluída de
  maior estágio) está correta e o filtro por evento é aplicado antes da
  precedência. A ordenação usa cópia (`[...matching]`), então a lista recebida
  não é reordenada.
- **`formatMoneyFromCents`** trata `null`, `undefined`, `bigint` e negativos
  corretamente e arredonda em vez de truncar.
- **`getBestGeolocationPosition`** cancela o `watch` e o `setTimeout` em todos os
  caminhos de saída, rejeita na hora em `PERMISSION_DENIED`, não desiste em
  `POSITION_UNAVAILABLE`, descarta leituras com precisão `0`, negativa, `NaN` ou
  infinita, e mantém a melhor leitura quando as seguintes pioram.
