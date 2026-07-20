# Plano de retenção e direitos — V20.4.1

## Controlador e canal oficial

- Controlador: Bafafa Gastrobar LTDA.
- CNPJ: 39.715.843/0001-00.
- Endereço: Praça Doutor Amaro de Souza Marinho, 7, Lagoa Nova, Natal/RN, CEP 59056-580.
- Canal de privacidade: `bafafa.bar@gmail.com`.
- Prazo operacional para resposta ao titular: até 15 dias, após confirmação de identidade.

## Critérios de retenção

| Categoria | Critério operacional | Destino ao final |
| --- | --- | --- |
| Conta, perfil, preferências e histórico de relacionamento | Enquanto a conta estiver ativa; revisão após 24 meses sem atividade | Exclusão ou anonimização, salvo obrigação ou defesa de direitos |
| Coordenadas recebidas no check-in | Uso transitório durante a validação | Não são persistidas; permanece somente a confirmação e informação aproximada da validação |
| Mensagens da Resenha e conversas privadas | Revisão após 180 dias do encerramento | Exclusão lógica ou anonimização, exceto conteúdo denunciado |
| Eventos de segurança sem investigação ativa | Revisão aos 180 dias | Exclusão controlada após verificação operacional |
| Consentimentos, auditoria e registros de moderação | Até 5 anos quando necessários | Exclusão ou anonimização após o prazo aplicável |
| Registros comerciais sujeitos a obrigação legal | Prazo exigido pela obrigação correspondente, limitado ao necessário | Exclusão ou anonimização quando permitido |

## Processo trimestral

1. O administrador do Bafafá Connect executa o relatório `VERIFICAR_RETENCAO_V2041.sql`.
2. Confere contas inativas, mensagens antigas, eventos de segurança e registros em exceção.
3. Não apaga conteúdo denunciado, registros sob investigação ou informações exigidas por obrigação legal.
4. Registra a decisão, a quantidade de registros e a data em auditoria antes de qualquer limpeza.
5. Limpezas em lote exigem migration ou função administrativa específica, teste em transação e script de verificação.

## Solicitações de titulares

- Aceitar confirmação, acesso, correção, informação sobre compartilhamento, revogação e exclusão.
- Confirmar a identidade usando a conta e o telefone ou e-mail já registrados; nunca solicitar senha.
- Responder pelo canal oficial e registrar a conclusão sem copiar dados pessoais desnecessários para a auditoria.
- Quando a exclusão não puder ser integral, explicar qual categoria foi preservada, por qual motivo e por quanto tempo.

## Decisão de autenticação

- Clientes usarão telefone e OTP pela Twilio depois da validação operacional.
- E-mail e senha são contingência temporária de teste e não serão o acesso público principal.
- A proteção de senhas vazadas do plano Pro não é requisito do piloto porque o fluxo canônico do cliente será sem senha.
- Enquanto a contingência existir, manter senha forte, CAPTCHA, limites de tentativa e acesso administrativo com MFA.

## Referências normativas

- Lei nº 13.709/2018 (LGPD), especialmente os artigos 9º, 15, 16, 18, 19 e 41.
- Orientações da Autoridade Nacional de Proteção de Dados sobre aviso de privacidade e exercício de direitos.

Este plano organiza a operação técnica do aplicativo e deve ser reavaliado se mudarem os dados coletados,
as integrações, a finalidade do produto ou as obrigações legais do Bafafá.
