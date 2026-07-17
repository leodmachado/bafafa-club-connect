# BAFAFÁ — Clube dos Bafafãs: estado do MVP

O projeto foi reduzido para validar um ciclo simples com clientes reais:

**cadastro → perfil progressivo → evento → check-in → mimo → selo/título**

## Decisões atuais

- O design system original foi preservado.
- A navegação principal é: Início, Eventos, Check-in, Mimos e Perfil.
- Fofoquinhas, Reservas, Assinaturas e recursos sociais estão ocultos, sem remoção destrutiva das estruturas existentes.
- Durante o desenvolvimento, o login público continua por e-mail e senha para evitar custo de SMS.
- Telefone + OTP entra somente antes do piloto real, após escolha e configuração do provedor.
- Check-in e resgate usam tokens temporários criados no backend. A primeira versão funcional usa código numérico de seis dígitos; câmera/QR visual pode ser adicionada depois.
- Usuários não registram o próprio check-in nem resgatam o próprio mimo: a validação é feita por `equipe` ou `admin`.

## Implementado nesta entrega

- telas funcionais de Início, Eventos, Check-in, Mimos e Perfil;
- rota operacional `/staff/checkin`;
- painel administrativo reduzido com indicadores;
- perfil progressivo, preferências, selos e títulos;
- migration segura para geração/validação de códigos, concessão de mimos e auditoria;
- compatibilidade do trigger de novos usuários com autenticação por telefone futura;
- PWA, ícones e metadados atualizados;
- `.env` removido do versionamento e substituído por `.env.example`.

## Próximas entregas

1. Aplicar e validar as migrations em um projeto Supabase de teste.
2. Criar o CRUD visual de eventos e campanhas.
3. Testar o fluxo completo com contas `admin`, `equipe` e cliente.
4. Adicionar leitura por câmera, caso seja necessária no piloto.
5. Configurar telefone + OTP somente antes do lançamento para clientes reais.

Consulte `README.md` e `docs/TESTE_MVP.sql` para configuração e testes.
