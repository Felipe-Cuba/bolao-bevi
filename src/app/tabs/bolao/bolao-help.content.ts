import { HelpBlock } from '@shared/components/help-modal/help-modal.component';

/** Conteúdo fixo da modal "Como funciona?" do Bolão (sistema de pontuação). */
export const BOLAO_HELP: HelpBlock[] = [
  {
    kind: 'paragraph',
    text:
      'A regra de ouro é simples: quanto mais perto da realidade for o seu palpite, mais pontos ' +
      'você ganha! Veja como a sua pontuação é calculada:',
  },

  { kind: 'heading', text: 'Fase de Grupos' },
  {
    kind: 'score',
    tone: 'cravou',
    label: 'Cravou (+3 pontos)',
    text: 'Você acertou o placar exato da partida. Na mosca!',
  },
  {
    kind: 'score',
    tone: 'acertou',
    label: 'Acertou (+1 ponto)',
    text:
      'Você errou o placar, mas acertou o resultado (quem venceu ou se foi empate).',
  },
  {
    kind: 'score',
    tone: 'errou',
    label: 'Errou (0 pontos)',
    text: 'Acontece... O palpite não bateu com o resultado final.',
  },

  { kind: 'heading', text: 'Mata-mata (a partir dos 16-avos)' },
  {
    kind: 'paragraph',
    text:
      'A partir daqui, o empate não encerra a história: alguém precisa se classificar! Por isso, ' +
      'além do placar, conta muito quem avança:',
  },
  {
    kind: 'score',
    tone: 'cravou',
    label: 'Cravou (+3 pontos)',
    text:
      'Perfeito! Você acertou o placar exato e também a seleção que se classificou.',
  },
  {
    kind: 'score',
    tone: 'trave',
    label: 'Na trave (+2 pontos)',
    text:
      'Quase! Você acertou o placar do jogo, mas a partida foi para os pênaltis e você errou ' +
      'quem passava.',
  },
  {
    kind: 'score',
    tone: 'acertou',
    label: 'Acertou (+1 ponto)',
    text:
      'O placar passou longe, mas você acertou a seleção que se classificou. O que importa é ' +
      'passar de fase!',
  },
  {
    kind: 'score',
    tone: 'errou',
    label: 'Errou (0 pontos)',
    text: 'O palpite não bateu com o placar e nem com quem avançou.',
  },

  { kind: 'heading', text: 'Quando os pontos entram na conta?' },
  {
    kind: 'paragraph',
    text:
      'Sua pontuação é atualizada assim que o jogo real tem um resultado (seja no apito final ou ' +
      'durante a partida, dependendo do sistema). Jogos que ainda não começaram não rendem pontos!',
  },
];
