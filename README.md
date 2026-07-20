# BAFAFÁ CONNECT

MVP mobile-first para aquisição e relacionamento de clientes do Bafafá Bar — Natal/RN.

## Versão atual: V20.4.2 — privacidade e moderação preventiva para o piloto

O produto foi reduzido para um ciclo simples:

**cadastro e consentimento → BAFAFEED → Fofoquinhas → check-in contextual → Resenha → carteirinha → retorno**

A navegação principal agora contém:

- **Início / BAFAFEED** — conteúdo, novidades e check-in contextual;
- **Fofoquinhas** — promoções, vantagens e missões;
- **Resenha** — conversa da noite para clientes com presença válida;
- **Perfil** — carteirinha, privacidade e perfil público seguro.

Agenda/Eventos permanece no código e no painel, mas está oculta da navegação do cliente. A estrutura
de eventos também sustenta a operação interna da Sessão da Casa, sem expor esse termo no aplicativo.

## Autenticação

O aplicativo aceita telefone + OTP e e-mail + senha. Todo cadastro exige consentimentos explícitos;
marketing começa desligado. Maioridade é derivada da data de nascimento e verificada novamente no
banco antes de check-in e Resenha.

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha somente as chaves públicas do Supabase.
3. Execute `bun install`.
4. Aplique somente migrations ainda não registradas no projeto Supabase correto.
5. Execute `bun run lint`, `bun run typecheck` e `bun run build`.
6. Inicie com `bun run dev`.

Nunca coloque uma chave `service_role` no frontend ou em arquivos versionados.

## Migrations da prontidão para o piloto

`supabase/migrations/20260729120000_pilot_readiness_v204.sql`

`supabase/migrations/20260730120000_privacy_defaults_v2041.sql`

`supabase/migrations/20260731120000_content_moderation_v2042.sql`

A migration V20.4.2 ainda precisa ser aplicada no Supabase correto. Não faça merge ou deploy de
produção antes de executar o script de verificação e confirmar `verificacao_ok = true`.

Ela adiciona e consolida:

- perfil fechado por padrão para novos cadastros;
- perfis legados fechados com snapshot auditável das preferências anteriores;
- consentimentos explícitos conciliados com os campos de CRM;
- maioridade obrigatória em check-in e Resenha;
- salves sem consulta direta à tabela de perfis;
- bloqueio, limite de envio, denúncia e moderação da conversa privada;
- remoção da listagem ampla dos buckets públicos;
- revogação de execução direta das funções de gatilho.
- bloqueio preventivo de nomes, `@`, Resenha, salves e mensagens privadas ofensivas;
- lista de moderação mantida em schema privado e validação final por gatilhos no banco.

## Papéis

- `gratuito`: cliente comum;
- `equipe`: valida check-ins e mimos;
- `moderador`: reservado para a fase social;
- `admin`: administração completa.

A rota operacional é `/staff/checkin`. Somente `equipe` e `admin` podem validar códigos.

## O que ainda falta

- autenticação real por telefone/OTP e provedor de SMS;
- leitura de QR pela câmera — esta versão usa código numérico seguro como alternativa funcional;
- CRUD visual de eventos e campanhas no painel administrativo;
- upload de foto de perfil;
- testes automatizados e pipeline de CI;
- automação da rotina de retenção após validar o relatório trimestral no piloto;
- promoção real definida pelo Bafafá.

## Teste rápido

O arquivo `docs/TESTE_MVP.sql` contém comandos opcionais para:

- promover a primeira conta a administrador;
- promover uma conta a equipe;
- criar um evento e uma campanha de demonstração.

Revise os e-mails e o produto antes de executar. O script não deve ser usado sem adaptação em produção.

## Painel administrativo v2

Esta versão adiciona um painel funcional em `/admin` para:

- visão geral do MVP;
- criar, editar e excluir eventos;
- criar, editar e excluir campanhas/mimos;
- consultar clientes e completude do perfil;
- consultar check-ins;
- conceder ou remover acesso de equipe e administrador;
- consultar auditoria.

Antes de usar o painel, execute uma única vez no SQL Editor do Supabase:

`docs/ADMIN_V2_SETUP.sql`

O script concede as permissões de banco necessárias, mantém o RLS, protege o último administrador e cria auditoria automática das alterações principais.

## Atualização: imagens e validade flexível

A versão inclui upload direto de imagens para eventos e fotos de perfil via Supabase Storage. Campanhas aceitam validade em minutos ou horas. Antes de testar, execute `docs/UPLOADS_AND_MINUTES_SETUP.sql` no SQL Editor do Supabase.

## Identidade visual Bafafá v4

Esta entrega aproxima o aplicativo da identidade real do Bafafá, preservando os fluxos existentes.

Principais mudanças:

- logo oficial aplicada no app, autenticação e ícones da PWA;
- paleta vibrante inspirada nas artes do Instagram;
- referências sutis a cartazes, adesivos, tijolinhos e à praça;
- nova apresentação para Início, Eventos, Check-in, Mimos e Perfil;
- cards de evento com linguagem de flyer;
- mimos em formato de cupom/ticket;
- perfil com aparência social, selos ao lado do nome e título ativo;
- selo manual **Sócio Fundador**, concedido e removido somente por administrador;
- perfil público seguro em `/u/<username>`;
- painel administrativo refinado sem perder clareza operacional.

Antes de testar esta versão, execute uma única vez no SQL Editor do Supabase:

`docs/BRAND_V4_SETUP.sql`

Depois reinicie o servidor local. O roteiro completo está em `docs/TESTE_IDENTIDADE_V4.md`.

## V6 — Perfil 100% e Resenha do Evento

A versão v6 centraliza o cálculo de completude do perfil no Supabase e adiciona uma sala pública por evento, acessível a clientes com check-in válido. A sala inclui mensagens em tempo real, respostas, denúncia, bloqueio, exclusão pelo autor e moderação no painel administrativo.

Configuração: `docs/PERFIL_E_RESENHA_V6_SETUP.sql`  
Roteiro de teste: `docs/TESTE_PERFIL_E_RESENHA_V6.md`

## Atualização v7 — Resenha enxuta e perfis organizados

- Resenha com foco nas mensagens, perfis compactos e ações por ícone.
- Perfil pessoal com cabeçalho e coleção de selos mais minimalistas.
- Consultas do app do cliente filtradas explicitamente por `user_id`, inclusive para contas administrativas.
- Deduplicação defensiva de selos por slug.
- Migration da correção `short_code` incorporada ao repositório.

## V9 — Bloco 1: correções e experiência

Atualização de frontend focada em Home, Check-in, Perfil e Resenha:

- correção definitiva do selo recente e de vazamentos horizontais na Home;
- hero com melhor separação da chamada “Chegue mais, Bafafã”;
- carregamento, erro e tentativa novamente nas telas principais;
- Check-in com estados distintos, janela completa, contagem regressiva e atualização manual;
- atalhos para Mimos e Resenha após a validação;
- Perfil com botão que leva diretamente ao próximo campo pendente;
- Resenha com mais espaço para mensagens, campo de envio persistente, mensagens próprias diferenciadas e aviso de novas mensagens sem rolagem forçada;
- estado de Resenha encerrada e contador compacto de participantes que já conversaram.

Antes de testar, execute uma vez `docs/EXPERIENCIA_V9_BLOCO1_SETUP.sql`. A sala encerrada permanece disponível em modo somente leitura por 48 horas. Roteiro: `docs/TESTE_EXPERIENCIA_V9_BLOCO1.md`.

## V10 — Bloco 2: operação

Esta versão acrescenta leitura de QR pela câmera, QR local no cliente, validador com retorno visual/sonoro, eventos em rascunho/publicados, prévia, duplicação, fechamento imediato do check-in, campanhas pausáveis, métricas de mimos e histórico de resgates. Consulte `docs/TESTE_OPERACAO_V10_BLOCO2.md`.

## V15 — Segurança Base

Antes do piloto com clientes reais, aplique a migration:

```text
supabase/migrations/20260718120000_security_base_v15.sql
```

Ela consolida o menor privilégio no banco:

- tabela bruta de perfis visível somente ao próprio usuário e administradores;
- perfil público entregue pela RPC segura `get_public_profile`;
- clientes editam apenas colunas autorizadas do próprio perfil;
- auditoria sem escrita direta pelo navegador;
- equipe valida check-ins e mimos por RPC, sem acesso bruto às tabelas completas;
- funções auxiliares do chat não consultam presença ou bloqueios de terceiros;
- criação de objetos no schema `public` removida dos papéis de cliente.

Após a instalação, execute `docs/VERIFICAR_SEGURANCA_V15.sql` e siga
`docs/TESTE_SEGURANCA_V15.md`.

## Segurança de autenticação — V16

Contas `admin`, `moderador` e `equipe` exigem MFA por aplicativo autenticador. A configuração fica em **Perfil → Segurança da conta**. O cadastro suporta confirmação de e-mail e CAPTCHA Turnstile sem depender de uma sessão imediata. Consulte `docs/CONFIGURAR_AUTENTICACAO_V16.md` e `docs/TESTE_AUTENTICACAO_V16.md`.

## V17 — Segurança da aplicação, navegador e uploads

Esta versão adiciona uma camada de defesa no frontend e na hospedagem:

- cabeçalhos HTTP de segurança e CSP na Vercel e no servidor;
- bloqueio de iframe/clickjacking, `nosniff`, HSTS, Referrer-Policy e Permissions-Policy;
- páginas e respostas autenticadas com `Cache-Control: no-store`;
- aplicativo do piloto bloqueado para indexação por buscadores;
- source maps de produção desativados;
- erros técnicos convertidos em mensagens públicas genéricas;
- telemetria da Lovable desativada no build de produção;
- GIF e SVG removidos dos uploads;
- verificação de assinatura real do arquivo, limite de dimensões e conversão para WEBP;
- redimensionamento e remoção de metadados EXIF pelo reprocessamento da imagem;
- buckets com limite de 1,5 MB para avatar e 3 MB para evento;
- banco impedindo URLs externas em fotos novas de perfil e evento.

Execute `docs/BAFAFA_APLICACAO_NAVEGADOR_V17_SETUP.sql`, depois
`docs/VERIFICAR_APLICACAO_NAVEGADOR_V17.sql` e siga
`docs/TESTE_APLICACAO_NAVEGADOR_V17.md`.

Enquanto o aplicativo estiver em piloto, `robots.txt` e `X-Robots-Tag` mantêm o conteúdo fora dos buscadores. Essa configuração deve ser revisada antes de um lançamento público.

A V17 também adiciona `.github/workflows/security.yml`: cada Pull Request compila o projeto e executa `bun audit --prod --audit-level=high`. Não faça merge com esse workflow vermelho.

## Segurança e continuidade (V18)

A aba **Administração → Segurança** reúne eventos de acesso, exportações, contas privilegiadas e um checklist das configurações externas. Os procedimentos de backup, restauração e resposta a incidentes estão em `docs/INFRAESTRUTURA_CONTINUIDADE_V18.md` e `docs/RESPOSTA_A_INCIDENTES_V18.md`.

## V19 — Feed, nova navegação e check-in por localização

A navegação do cliente foi reorganizada para `Eventos · Fofoquinhas · Início · Resenha · Perfil`. O Início agora é o feed oficial do Bafafá, com prioridade para promoções vigentes, evento atual, próximos eventos e publicações administrativas.

O check-in deixou de ser uma aba e passou a ser uma ação do evento. A geolocalização é a forma principal de confirmar presença, com QR temporário como alternativa. Recompensas com valor financeiro continuam exigindo validação operacional.

A área Mimos passou a se apresentar como Fofoquinhas e ganhou suporte a missões e campanhas que não dependem de um único evento. O Perfil recebeu campos opcionais e inclusivos de identidade de gênero e pronomes, sem interferir no percentual de conclusão.

Consulte `docs/TESTE_NAVEGACAO_FEED_GEOLOCALIZACAO_V19.md` antes do merge.

## Locais reutilizáveis e Google Maps

A partir da V19.1, o administrador cadastra um local uma única vez e o reutiliza nos eventos.
A busca automática por estabelecimento/endereço é opcional e usa:

```env
VITE_GOOGLE_MAPS_API_KEY=
```

Sem a chave, o cadastro continua disponível por localização atual ou coordenadas manuais.
