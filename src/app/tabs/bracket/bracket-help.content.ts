import { HelpBlock } from '@shared/components/help-modal/help-modal.component';

/** Conteúdo fixo da modal "Como funciona?" do Chaveamento. */
export const BRACKET_HELP: HelpBlock[] = [
  {
    kind: 'paragraph',
    text:
      'Bem-vindo à fase mais emocionante da Copa: o mata-mata! Aqui você faz os seus ' +
      'palpites reais e ainda pode brincar de simular o caminho das seleções até a grande final.',
  },
  {
    kind: 'topic',
    title: 'Palpite nos 16-avos:',
    text:
      'Nos jogos que já estão definidos, é só digitar o seu palpite de placar ao lado de cada ' +
      'seleção. Acha que vai dar empate? Sem problemas! É só digitar os gols e clicar na ' +
      'seleção que você acha que avança (nos pênaltis). Quando terminar, não se esqueça de ' +
      'clicar em Salvar palpites.',
  },
  {
    kind: 'topic',
    title: 'Simule o resto da chave:',
    text:
      'Quer prever o futuro? Clique em uma seleção para fazê-la avançar de fase. Ela sobe para ' +
      'o próximo confronto e você pode ir montando todo o caminho até descobrir o seu campeão! ' +
      'Clicou na seleção errada? É só clicar nela de novo para desfazer ou usar o botão ' +
      'Limpar simulação.',
  },
  {
    kind: 'topic',
    title: 'Conforme os jogos acontecem:',
    text:
      'Quando uma partida real termina, ela é "travada" e não dá mais para mudar o palpite. ' +
      'A seleção vencedora já aparece automaticamente na fase seguinte. Mas fique tranquilo: ' +
      'você continua livre para simular os confrontos futuros.',
  },
  {
    kind: 'topic',
    title: 'As cores do seu sucesso:',
    text:
      'Depois que um jogo real acaba, a seleção classificada ganha uma cor baseada no seu ' +
      'desempenho, seguindo o padrão do seu Bolão (exemplo: verde se você cravou na mosca!).',
  },
  {
    kind: 'topic',
    title: 'De quem é esse palpite?',
    text:
      'Quer dar uma espiada nas apostas dos seus amigos? Use o menu no topo da tela para ' +
      'escolher qual participante você quer ver. Essa mesma opção também funciona lá na ' +
      'tela do Bolão!',
  },
];
