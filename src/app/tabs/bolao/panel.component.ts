import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideCalendarDays,
  LucideChevronDown,
  LucideCrosshair,
  LucideGrid3x3,
  LucideGoal,
  LucideCircleQuestionMark,
  LucideLayers,
  LucideMedal,
  LucidePencil,
  LucideThumbsUp,
  LucideTrophy,
  LucideX,
} from '@lucide/angular';

import { Match, MatchStatus, isLive } from '@shared/models/match.model';
import { teamCrest } from '@shared/utils/teams.util';
import { BolaoStore } from '@core/bolao.store';
import {
  ETAPAS,
  EtapaId,
  ScoredGuess,
  entryBreakdown,
  etapaLabel,
  isScorable,
  matchesOfEtapa,
  pointsValue,
  rankEntries,
  scoreGuess,
  tallyEntry,
} from '@shared/utils/bolao-scoring.util';
import { Palpite } from '@shared/models/bolao.model';
import { BolaoDetalheModal } from './components/detail-modal/detail-modal.component';
import { HelpModal, HelpBlock } from '@shared/components/help-modal/help-modal.component';
import { BOLAO_HELP } from './bolao-help.content';
import { ShortNamePtPipe } from '@shared/pipes/match-labels.pipes';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function isLiveOrStarted(match: Match): boolean {
  if (isLive(match)) return true;
  if (match.status === MatchStatus.TIMED || match.status === MatchStatus.SCHEDULED) {
    const startMs = Date.parse(match.utcDate);
    const now = Date.now();
    return startMs <= now && now < startMs + TWO_HOURS_MS;
  }
  return false;
}

/** Célula do heatmap de pontos por grupo. */
interface GroupCell {
  label: string;
  value: number;
  /** Intensidade 0–1 relativa ao melhor grupo (para a cor da célula). */
  heat: number;
  /** True quando o grupo já tem jogos pontuados (mesmo que com 0 pontos). */
  played: boolean;
}

/** Coluna do mini-gráfico de pontos por dia. */
interface DayColumn {
  /** Chave do dia (AAAA-MM-DD), p/ filtrar os jogos desse dia. */
  date: string;
  /** Rótulo curto (dd/mm) para o eixo. */
  label: string;
  points: number;
  jogos: number;
  /** Altura 0–1 relativa ao melhor dia. */
  height: number;
  /** Dia de maior/menor pontuação (para realce). */
  isBest: boolean;
  isWorst: boolean;
}

/** Célula de pontos por fase/rodada. */
interface PhaseCell {
  /** Chave da fase ('GROUP_1'.. ou stage do mata-mata), p/ filtrar os jogos. */
  key: string;
  label: string;
  value: number;
  jogos: number;
  /** Intensidade 0–1 relativa à melhor fase (para a cor). */
  heat: number;
}

/** Linha compacta de um jogo ao vivo no painel do bolão. */
interface LiveRow {
  id: number;
  homeTla: string;
  awayTla: string;
  homeCrest: string;
  awayCrest: string;
  /** Placar real (null enquanto o jogo não tem placar definido). */
  realHome: number | null;
  realAway: number | null;
  palpite: Palpite | null;
  /** Pontos do palpite (0/1/2/3) ou null se ainda não pontuável. */
  pts: 0 | 1 | 2 | 3 | null;
  ptsLabel: string;
}

/** Próximo jogo agendado (sem placar ainda), com o horário formatado. */
interface NextRow {
  id: number;
  homeTla: string;
  awayTla: string;
  homeCrest: string;
  awayCrest: string;
  palpite: Palpite | null;
  when: string;
}

@Component({
  selector: 'app-bolao-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideTrophy,
    LucideCrosshair,
    LucideThumbsUp,
    LucideX,
    LucidePencil,
    LucideMedal,
    LucideChevronDown,
    LucideGrid3x3,
    LucideGoal,
    LucideCalendarDays,
    LucideLayers,
    LucideCircleQuestionMark,
    BolaoDetalheModal,
    HelpModal,
    ShortNamePtPipe
],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.css',
})
export class BolaoPanel {
  private readonly store = inject(BolaoStore);

  readonly matches = input.required<Match[]>();
  /**
   * Pede para a página abrir a modal de palpites. Emite o id a pré-selecionar (o palpite
   * em foco no painel) ou null no estado vazio, para a modal abrir no item certo.
   */
  readonly openModal = output<string | null>();

  readonly entries = this.store.entries;
  /** Seleção compartilhada com o chaveamento (vive no store; auto-seleção feita lá). */
  readonly selectedId = this.store.selectedEntryId;

  /** Modal "Como funciona?" (sistema de pontuação). */
  readonly helpOpen = signal(false);
  readonly helpBlocks: HelpBlock[] = BOLAO_HELP;
  readonly selected = this.store.selectedEntry;

  /** Etapa selecionada (Grupos × Mata-mata). Pontuações das etapas NÃO se somam. */
  readonly etapas = ETAPAS;
  readonly etapa = signal<EtapaId>('GROUPS');
  readonly etapaLabel = computed(() => etapaLabel(this.etapa()));

  /** Jogos da etapa ativa — base de todas as contas/agregações do painel. */
  private readonly matchesEtapa = computed(() => matchesOfEtapa(this.matches(), this.etapa()));

  readonly tally = computed(() => {
    const entry = this.selected();
    return entry ? tallyEntry(entry, this.matchesEtapa()) : null;
  });

  /** Aproveitamento: % dos jogos pontuados em que marcou algum ponto (cravou + quase + acertou). */
  readonly hitRate = computed(() => {
    const t = this.tally();
    if (!t || t.jogosPontuados === 0) return 0;
    return Math.round(((t.cravou + t.quaseCravou + t.acertou) / t.jogosPontuados) * 100);
  });

  /** Heatmap A→L (+ KO se houver): valor por grupo e intensidade relativa ao melhor. */
  readonly groupCells = computed<GroupCell[]>(() => {
    const por = this.tally()?.porGrupo ?? {};
    // Grupos que já têm jogos pontuados (mesmo com 0 pontos) → célula clicável.
    const played = new Set(this.breakdown().map((g) => g.group));
    const letters = 'ABCDEFGHIJKL'.split('');
    const cells: GroupCell[] = letters.map((l) => ({
      label: l,
      value: por[`GROUP_${l}`] ?? 0,
      heat: 0,
      played: played.has(`GROUP_${l}`),
    }));

    const max = Math.max(0, ...cells.map((c) => c.value));
    if (max > 0) for (const c of cells) c.heat = c.value / max;
    return cells;
  });

  /** Colunas do mini-gráfico de pontos por dia (cronológico), com realce best/worst. */
  readonly dayColumns = computed<DayColumn[]>(() => {
    const t = this.tally();
    const dias = t?.porDia ?? [];
    const max = Math.max(0, ...dias.map((d) => d.points));
    const min = dias.length ? Math.min(...dias.map((d) => d.points)) : 0;
    // Só realça quando há variação real entre os dias (mais de um dia pontuado).
    // Realce por VALOR (não por data): dias empatados no máx/mín recebem a mesma cor.
    const distinguish = dias.length > 1 && max !== min;
    return dias.map((d) => ({
      date: d.date,
      label: this.shortDay(d.date),
      points: d.points,
      jogos: d.jogos,
      height: max > 0 ? d.points / max : 0,
      isBest: distinguish && d.points === max,
      isWorst: distinguish && d.points === min,
    }));
  });

  /** Células do card "pontos por fase" (rodadas de grupo + fases de mata-mata). */
  readonly phaseCells = computed<PhaseCell[]>(() => {
    const fases = this.tally()?.porFase ?? [];
    const max = Math.max(0, ...fases.map((f) => f.points));
    return fases.map((f) => ({
      key: f.key,
      label: f.label,
      value: f.points,
      jogos: f.jogos,
      heat: max > 0 ? f.points / max : 0,
    }));
  });

  /** Potencial ainda obtível (+3 por palpite em jogo não pontuável). */
  readonly potencial = computed(() => this.tally()?.potencialRestante ?? 0);

  /** Resumo "dd/mm · N pts" do melhor e do pior dia (null quando não há). */
  readonly bestDayLabel = computed(() => this.dayResumo(this.tally()?.melhorDia ?? null));
  readonly worstDayLabel = computed(() => this.dayResumo(this.tally()?.piorDia ?? null));

  private dayResumo(d: { date: string; points: number } | null): string | null {
    return d ? `${this.shortDay(d.date)} · ${d.points} pts` : null;
  }

  /** Ranking da etapa ativa (dois rankings separados: alternar a aba troca a contagem). */
  readonly ranking = computed(() => rankEntries(this.entries(), this.matchesEtapa()));

  /** Palpites do entry selecionado já resolvidos (placar real × pts) na etapa ativa, p/ as modais. */
  readonly breakdown = computed<ScoredGuess[]>(() => {
    const entry = this.selected();
    return entry ? entryBreakdown(entry, this.matchesEtapa()) : [];
  });

  /** Modal de detalhe aberta (título + itens filtrados), ou null. */
  readonly detalhe = signal<{ title: string; items: ScoredGuess[] } | null>(null);

  /** Abre a modal de uma categoria (Cravou/Na trave/Acertou/Errou). Não abre se vazia. */
  openCategoria(kind: 'cravou' | 'quase' | 'acertou' | 'errou'): void {
    const wanted = kind === 'cravou' ? 3 : kind === 'quase' ? 2 : kind === 'acertou' ? 1 : 0;
    const items = this.breakdown().filter((g) => g.pts === wanted);
    if (!items.length) return;
    const title =
      kind === 'cravou'
        ? 'Cravou'
        : kind === 'quase'
          ? 'Na trave (placar exato, errou quem passou)'
          : kind === 'acertou'
            ? 'Acertou'
            : 'Errou';
    this.detalhe.set({ title, items });
  }

  /** Abre a modal de um grupo: todos os palpites de jogos já pontuados (acertos e erros).
   *  Não abre se o grupo ainda não tem jogos pontuados. */
  openGrupo(label: string): void {
    const items = this.breakdown().filter((g) => g.group === `GROUP_${label}`);
    if (!items.length) return;
    this.detalhe.set({ title: `Grupo ${label}`, items });
  }

  /** Abre a modal de uma fase/rodada: todos os palpites de jogos já pontuados dela. */
  openFase(key: string, label: string): void {
    const items = this.breakdown().filter((g) => g.phase === key);
    if (!items.length) return;
    this.detalhe.set({ title: label, items });
  }

  /** Abre a modal de um dia: todos os palpites de jogos já pontuados naquele dia. */
  openDia(date: string, label: string): void {
    const items = this.breakdown().filter((g) => g.day === date);
    if (!items.length) return;
    this.detalhe.set({ title: `Dia ${label}`, items });
  }

  closeDetalhe(): void {
    this.detalhe.set(null);
  }

  /** Linhas compactas dos jogos ao vivo, já com placar real e palpite resolvidos. */
  readonly liveRows = computed<LiveRow[]>(() => {
    const entry = this.selected();
    const byMatch = new Map<number, Palpite>(
      entry ? entry.palpites.map((p) => [p.matchId, p]) : [],
    );

    return this.matches()
      .filter(isLiveOrStarted)
      .map((m) => {
        const palpite = byMatch.get(m.id) ?? null;
        const hasReal = m.score.fullTime.home != null && m.score.fullTime.away != null;
        const pts = palpite && isScorable(m) ? scoreGuess(palpite, m) : null;
        return {
          id: m.id,
          homeTla: this.teamTla(m.homeTeam),
          awayTla: this.teamTla(m.awayTeam),
          homeCrest: teamCrest(m.homeTeam),
          awayCrest: teamCrest(m.awayTeam),
          realHome: hasReal ? (m.score.fullTime.home as number) : null,
          realAway: hasReal ? (m.score.fullTime.away as number) : null,
          palpite,
          pts,
          ptsLabel: pointsValue(pts),
        };
      });
  });

  /** Próximo(s) jogo(s) a acontecer: todos os agendados no mesmo horário, com palpite. */
  readonly nextRows = computed<NextRow[]>(() => {
    const now = Date.now();
    const upcoming = this.matches()
      .filter(
        (m) =>
          !isLiveOrStarted(m) &&
          (m.status === MatchStatus.TIMED || m.status === MatchStatus.SCHEDULED) &&
          Date.parse(m.utcDate) > now,
      )
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

    if (!upcoming.length) return [];

    // Todos os jogos que começam no mesmo horário do primeiro da fila.
    const firstUtc = upcoming[0].utcDate;
    const entry = this.selected();

    return upcoming
      .filter((m) => m.utcDate === firstUtc)
      .map((m) => {
        const palpite = entry?.palpites.find((p) => p.matchId === m.id) ?? null;
        return {
          id: m.id,
          homeTla: this.teamTla(m.homeTeam),
          awayTla: this.teamTla(m.awayTeam),
          homeCrest: teamCrest(m.homeTeam),
          awayCrest: teamCrest(m.awayTeam),
          palpite,
          when: new Date(m.utcDate).toLocaleString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      });
  });

  private teamTla(team: Match['homeTeam']): string {
    return team.tla || team.shortName || '—';
  }

  /** "AAAA-MM-DD" → "dd/mm". */
  private shortDay(date: string): string {
    const [, m, d] = date.split('-');
    return `${d}/${m}`;
  }

  select(id: string): void {
    this.store.selectEntry(id);
  }

}
