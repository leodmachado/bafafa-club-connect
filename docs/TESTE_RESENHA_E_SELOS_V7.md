# BAFAFÁ — Teste v7: Resenha enxuta e selos sem repetição

## O que foi corrigido

- A Resenha agora prioriza as mensagens e usa perfis compactos.
- A tela de Perfil ficou mais limpa e organizada.
- Consultas do app do cliente agora filtram explicitamente pelo usuário autenticado.
- Isso evita que um administrador veja, no próprio perfil, selos, títulos, check-ins ou mimos de outros clientes.
- Selos também são deduplicados defensivamente por `slug` antes de aparecerem na interface.
- A correção de `short_code` foi incluída nas migrations para futuras instalações.

## Teste recomendado

1. Entre com uma conta administradora.
2. Abra Perfil e confirme que aparecem somente os selos dessa conta.
3. Conceda Sócio Fundador a outro cliente no painel.
4. Volte ao seu próprio Perfil: o selo do outro cliente não deve aparecer.
5. Entre na conta do cliente: deve existir somente um selo Sócio Fundador.
6. Abra a Resenha com duas contas e confirme que:
   - mensagens têm mais espaço;
   - avatar, nome, até dois selos e título aparecem de forma compacta;
   - responder, apagar, denunciar e bloquear continuam funcionando.
7. Na home e em Mimos, confirme que um administrador vê somente seus próprios números e benefícios.

Nenhuma atualização adicional no Supabase é necessária para esta versão visual/corretiva, desde que a correção de `short_code` já tenha sido executada. A migration foi adicionada apenas para manter o repositório completo.
