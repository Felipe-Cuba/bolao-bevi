# Regras de Chaveamento — Copa do Mundo (Fase de 16-avos de final)

Este documento define a estrutura oficial de confrontos da FIFA para a fase
de mata-mata (16-avos de final), a ser usada como contexto para simulações
de chaveamento. O torneio tem 12 grupos (A a L), e os classificados são:
1º, 2º colocado de cada grupo, mais os 8 melhores terceiros colocados
entre os 12 grupos.

## 1. Confrontos de Campeões contra Vice-Campeões (4 jogos)

Cruzamentos fixos entre 1º e 2º colocados de grupos específicos:

| Confronto |
|---|
| 1º Grupo C x 2º Grupo F |
| 1º Grupo F x 2º Grupo C |
| 1º Grupo H x 2º Grupo J |
| 1º Grupo J x 2º Grupo H |

## 2. Confrontos entre Vice-Campeões (4 jogos)

Cruzamentos fixos entre 2º colocados de grupos específicos:

| Confronto |
|---|
| 2º Grupo A x 2º Grupo B |
| 2º Grupo D x 2º Grupo G |
| 2º Grupo E x 2º Grupo I |
| 2º Grupo K x 2º Grupo L |

## 3. Confrontos de Campeões contra Terceiros Colocados (8 jogos)

Os 1ºs colocados dos 8 grupos restantes (A, B, D, E, G, I, K, L) enfrentam
seleções classificadas entre os "8 melhores terceiros colocados" do torneio.
As possibilidades de cruzamento são restritas a blocos específicos, para
garantir que nenhum time enfrente um adversário do seu próprio grupo na
primeira fase.

| 1º colocado | Pode enfrentar o 3º colocado de |
|---|---|
| Grupo A | C, E, F, H ou I |
| Grupo B | E, F, G, I ou J |
| Grupo D | B, E, F, I ou J |
| Grupo E | A, B, C, D ou F |
| Grupo G | A, E, H, I ou J |
| Grupo I | C, D, F, G ou H |
| Grupo L | E, H, I, J ou K |
| Grupo K | um dos terceiros remanescentes da combinação |

### Regra principal de aplicação

Para definir os confrontos do Bloco 3 em uma simulação:

1. Liste quais foram os **8 melhores terceiros colocados** entre os 12
   grupos (com base em critérios como pontos, saldo de gols, gols
   marcados, etc.).
2. Cruze cada um dos 8 primeiros colocados (A, B, D, E, G, I, K, L) com um
   terceiro colocado classificado, respeitando a tabela de possibilidades
   acima.
3. **Regra inviolável**: nenhum time pode enfrentar, no mata-mata, um
   adversário que estava no seu próprio grupo na fase de grupos.
4. O cruzamento do Grupo K com o terceiro colocado é definido por
   eliminação — ele recebe o terceiro colocado que restar após os outros
   7 cruzamentos serem fechados, respeitando sempre a regra de não
   repetição de grupo.

## Resumo do fluxo de simulação

1. Simular a fase de grupos (A–L) e definir 1º, 2º e 3º de cada grupo.
2. Selecionar os 8 melhores terceiros colocados entre os 12.
3. Aplicar o Bloco 1 (Campeões x Vice-Campeões).
4. Aplicar o Bloco 2 (Vice-Campeões x Vice-Campeões).
5. Aplicar o Bloco 3 (Campeões x Terceiros), respeitando as tabelas de
   possibilidades e a regra de não repetição de grupo.
6. Gerar o chaveamento completo dos 16-avos de final (16 confrontos).
