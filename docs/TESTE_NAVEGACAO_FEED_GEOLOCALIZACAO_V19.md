# V19 — roteiro de teste da nova navegação, feed e geolocalização

## Antes de começar

1. Use um banco de testes ou dados fictícios.
2. Execute a migration `20260722120000_navigation_feed_geolocation_v19.sql` no Supabase.
3. Use `localhost` ou um deployment HTTPS da Vercel. Geolocalização pode ser bloqueada em HTTP comum.
4. No evento de teste, informe as coordenadas reais do local no painel administrativo. Não use coordenadas aproximadas sem conferir.

## 1. Navegação inferior

Confirme a ordem:

1. Eventos
2. Fofoquinhas
3. Início, central e destacado
4. Resenha
5. Perfil

Verifique:

- Check-in não aparece como menu.
- O item ativo muda de cor.
- Nenhum conteúdo fica escondido pela barra.
- A rota antiga `/fofoquinhas` redireciona para `/mimos`.

## 2. Feed da tela Início

Crie no painel:

- uma promoção ativa e fixada;
- uma promoção ativa sem destaque;
- um evento em andamento;
- dois eventos futuros;
- uma publicação do feed.

Confirme a ordem:

1. promoções vigentes;
2. evento rolando agora;
3. próximo evento;
4. demais eventos;
5. publicações do Bafafá.

Teste também:

- promoção expirada não aparece;
- publicação agendada para o futuro não aparece;
- conteúdo fixado tem prioridade;
- informações completas de perfil, histórico e selos não poluem a Home;
- o lembrete de completar a carteirinha aparece apenas quando existe uma pendência.

## 3. Eventos

Confirme as seções:

- Rolando agora;
- Próximos eventos;
- Eventos que já deram o que falar.

Teste:

- eventos encerrados ficam recolhidos e em preto e branco;
- evento atual mostra o botão de check-in;
- usuário já presente vê a confirmação e, se permitido, acesso à Resenha;
- detalhes do evento abrem sem sair da tela;
- promoção vinculada aparece no evento.

## 4. Check-in por geolocalização

No painel, configure no evento:

- check-in habilitado;
- geolocalização habilitada;
- latitude e longitude do local;
- raio inicial, por exemplo 80 metros;
- precisão máxima, por exemplo 60 metros;
- janela de check-in aberta.

No celular:

1. Abra o evento.
2. Toque em `Já tô no Bafafá`.
3. Autorize a localização.
4. Confirme que o check-in é criado somente dentro do raio e com precisão aceitável.
5. Confirme que as coordenadas exatas não aparecem no perfil, feed ou Resenha.
6. Tente repetir o check-in e verifique que não surge duplicidade.
7. Confirme que a geolocalização não libera automaticamente desconto, cortesia ou outro benefício financeiro.
8. Gere o QR após o check-in e valide com uma conta de equipe; somente então a promoção do evento deve ser concedida.

Teste os erros:

- permissão negada;
- GPS impreciso;
- localização fora do raio;
- janela ainda fechada;
- janela encerrada;
- evento sem coordenadas configuradas.

Em todos os casos, confirme que o QR temporário continua disponível como alternativa.

## 5. Fofoquinhas e missões

Crie campanhas dos tipos:

- vinculada a evento;
- missão de quantidade total de check-ins;
- missão de eventos diferentes;
- missão por categoria de evento;
- promoção geral concedida ao público elegível.

Confirme as abas:

- Disponíveis;
- Missões;
- Histórico.

Teste:

- progresso `2 de 3`;
- recompensa concedida ao atingir a meta;
- recompensa não duplicada;
- expiração e resgate continuam funcionando;
- benefício financeiro ainda exige validação operacional por QR.

## 6. Perfil e perfil público

Preencha:

- identidade de gênero opcional;
- texto personalizado, quando aplicável;
- pronomes;
- controle para mostrar ou ocultar gênero no perfil público.

Confirme:

- esses campos não contam para 100% da carteirinha;
- não são obrigatórios;
- ficam privados por padrão;
- aparecem publicamente somente quando autorizado;
- telefone, nascimento, bairro e dados sensíveis continuam ocultos.

## 7. Feed administrativo

No painel, teste:

- criar publicação;
- salvar rascunho;
- publicar;
- fixar;
- definir prioridade;
- programar início e fim;
- enviar imagem pelo aparelho;
- encerrar ou arquivar a publicação.

## 8. Segurança e regressão

Teste com cliente, equipe e administrador:

- cliente não cria publicação;
- cliente não altera geofence;
- cliente não concede missão a si mesmo;
- equipe continua validando QR e mimos;
- administrador mantém MFA e acesso ao painel;
- RLS, auditoria e controles das V15–V18 continuam funcionando.

## Critério para aprovar a V19

A V19 está aprovada quando o cliente consegue cumprir a jornada:

`Início → evento → check-in por localização → Resenha → Fofoquinhas → Perfil`

sem usar um menu separado de Check-in e sem acessar dados ou ações de outros usuários.
