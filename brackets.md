# Mata-mata da Copa do Mundo 2026 — Confrontos e Chaveamento

Documento de referência sobre a fase eliminatória (segunda fase em diante) da
Copa do Mundo de 2026, com horários, jogos e a estrutura completa do chaveamento
até a final. Horários no fuso de Brasília (BRT).

## Segunda fase (32 → 16)

16 jogos, numerados de 1 a 16 — essa numeração é usada nas seções de oitavas
abaixo para indicar de onde vem cada vencedor.

| # | Confronto | Data | Horário |
|---|---|---|---|
| 1 | Alemanha x Paraguai | seg, 29/06 | 17h30 |
| 2 | França x Suécia | ter, 30/06 | 18h |
| 3 | África do Sul x Canadá | dom, 28/06 | 16h |
| 4 | Holanda x Marrocos | seg, 29/06 | 22h |
| 5 | Portugal x Croácia | qui, 02/07 | 20h |
| 6 | Espanha x Áustria | qui, 02/07 | 16h |
| 7 | Estados Unidos x Bósnia | qua, 01/07 | 21h |
| 8 | Bélgica x Senegal | qua, 01/07 | 17h |
| 9 | Brasil x Japão | seg, 29/06 | 14h |
| 10 | Costa do Marfim x Noruega | ter, 30/06 | 14h |
| 11 | México x Equador | ter, 30/06 | 22h |
| 12 | Inglaterra x RD Congo | qua, 01/07 | 13h |
| 13 | Argentina x Cabo Verde | sex, 03/07 | 19h |
| 14 | Austrália x Egito | sex, 03/07 | 15h |
| 15 | Suíça x Argélia | sex, 03/07 | 00h |
| 16 | Colômbia x Gana | sex, 03/07 | 22h30 |

## Estrutura do chaveamento

A chave é dividida em dois lados (metades) que só se encontram na final.

### Lado A (jogos 1–4 da segunda fase)

- **Oitavas 1** — 04/07 às 18h — Vencedor(1) Alemanha/Paraguai x Vencedor(2) França/Suécia
- **Oitavas 2** — 04/07 às 14h — Vencedor(3) África do Sul/Canadá x Vencedor(4) Holanda/Marrocos
- **Oitavas 3** — 06/07 às 16h — Vencedor(5) Portugal/Croácia x Vencedor(6) Espanha/Áustria
- **Oitavas 4** — 06/07 às 21h — Vencedor(7) Estados Unidos/Bósnia x Vencedor(8) Bélgica/Senegal
- **Quartas 1** — 09/07 às 17h — Oitavas 1 x Oitavas 2
- **Quartas 2** — 10/07 às 16h — Oitavas 3 x Oitavas 4
- **Semifinal 1** — 14/07 às 16h — Quartas 1 x Quartas 2

### Lado B (jogos 9–16 da segunda fase)

- **Oitavas 5** — 05/07 às 17h — Vencedor(9) Brasil/Japão x Vencedor(10) Costa do Marfim/Noruega
- **Oitavas 6** — 05/07 às 21h — Vencedor(11) México/Equador x Vencedor(12) Inglaterra/RD Congo
- **Oitavas 7** — 07/07 às 13h — Vencedor(13) Argentina/Cabo Verde x Vencedor(14) Austrália/Egito
- **Oitavas 8** — 07/07 às 17h — Vencedor(15) Suíça/Argélia x Vencedor(16) Colômbia/Gana
- **Quartas 3** — 11/07 às 18h — Oitavas 5 x Oitavas 6
- **Quartas 4** — 11/07 às 22h — Oitavas 7 x Oitavas 8
- **Semifinal 2** — 15/07 às 16h — Quartas 3 x Quartas 4

### Fases finais

- **Disputa de 3º lugar** — 18/07 às 18h — Perdedor da Semifinal 1 x Perdedor da Semifinal 2
- **Final** — 19/07 às 16h — Semifinal 1 x Semifinal 2

## Notas para implementação

- Cada jogo de mata-mata depende do **resultado** do(s) jogo(s) anterior(es) na
  mesma posição da chave — não há "group/seed" fixo como na fase de grupos.
- Útil modelar como uma árvore/lista de rodadas onde cada partida tem
  `homeSource` e `awaySource` apontando para o jogo (ou par de jogos) anterior,
  em vez de times fixos, já que os confrontos da segunda fase em diante só são
  conhecidos depois do resultado anterior.
- A numeração 1–16 da "Segunda fase" é apenas posicional/de referência neste
  documento (não é um `id` oficial da API) — serve para rastrear qual vencedor
  alimenta qual jogo das oitavas.