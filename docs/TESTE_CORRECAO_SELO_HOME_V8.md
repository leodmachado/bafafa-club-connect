# Teste da correção do selo recente na Home — v8

1. Entre com um usuário que possua pelo menos um selo.
2. Abra a tela **Início**.
3. Role até o card **Selo novo na coleção**.
4. Confirme que:
   - o ícone circular fica à esquerda;
   - nome e descrição ficam dentro do card;
   - nenhum texto ultrapassa a borda direita;
   - o card funciona em tela estreita e larga;
   - o selo Sócio Fundador mantém a coroa e o destaque visual.

A correção troca o componente completo de coleção por uma marca compacta. O `scale` visual anterior reduzia o desenho, mas não a largura ocupada no layout, empurrando o texto para fora do card.
