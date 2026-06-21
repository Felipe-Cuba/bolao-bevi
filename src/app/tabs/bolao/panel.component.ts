import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideCalendarDays,
  LucideChevronDown,
  LucideCrosshair,
  LucideDownload,
  LucideGrid3x3,
  LucideLayers,
  LucideMedal,
  LucidePencil,
  LucideThumbsUp,
  LucideTrophy,
  LucideUpload,
  LucideX,
} from '@lucide/angular';

import { Match, MatchStatus, isLive } from '@shared/models/match.model';
import { teamCrest } from '@shared/utils/teams.util';
import { BolaoStore } from '@core/bolao.store';
import {
  ScoredGuess,
  entryBreakdown,
  isScorable,
  rankEntries,
  scoreGuess,
  tallyEntry,
} from '@shared/utils/bolao-scoring.util';
import {
  downloadJson,
  exportEntries,
  exportEntry,
  parseEntries,
  slugify,
} from '@shared/utils/bolao-io.util';
import { BolaoEntry, Palpite } from '@shared/models/bolao.model';
import { BolaoExportModal } from './components/export-modal/export-modal.component';
import { BolaoDetalheModal } from './components/detail-modal/detail-modal.component';

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
  /** Pontos do palpite (0/1/3) ou null se ainda não pontuável. */
  pts: 0 | 1 | 3 | null;
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
    LucideDownload,
    LucideUpload,
    LucidePencil,
    LucideMedal,
    LucideChevronDown,
    LucideGrid3x3,
    LucideCalendarDays,
    LucideLayers,
    BolaoDetalheModal,
  ],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.css',
})
export class BolaoPanel {
  private readonly store = inject(BolaoStore);

  readonly matches = input.required<Match[]>();
  /** Pede para a página abrir a modal de palpites (estado vazio / botão editar). */
  readonly openModal = output<void>();

  readonly entries = this.store.entries;
  readonly selectedId = signal<string | null>(null);

  /** Feedback do import (sucesso/erro), exibido inline. */
  readonly feedback = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);

  constructor() {
    effect(() => {
      const list = this.entries();
      const id = this.selectedId();
      if (!list.some((e) => e.id === id)) {
        this.selectedId.set(list[0]?.id ?? null);
      }
    });
  }

  readonly selected = computed(
    () => this.entries().find((e) => e.id === this.selectedId()) ?? null,
  );

  readonly tally = computed(() => {
    const entry = this.selected();
    return entry ? tallyEntry(entry, this.matches()) : null;
  });

  /** Aproveitamento: % dos jogos pontuados em que marcou algum ponto (cravou + acertou). */
  readonly hitRate = computed(() => {
    const t = this.tally();
    if (!t || t.jogosPontuados === 0) return 0;
    return Math.round(((t.cravou + t.acertou) / t.jogosPontuados) * 100);
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
    if (played.has('KO')) {
      cells.push({ label: 'KO', value: por['KO'] ?? 0, heat: 0, played: true });
    }

    const max = Math.max(0, ...cells.map((c) => c.value));
    if (max > 0) for (const c of cells) c.heat = c.value / max;
    return cells;
  });

  /** Colunas do mini-gráfico de pontos por dia (cronológico), com realce best/worst. */
  readonly dayColumns = computed<DayColumn[]>(() => {
    const t = this.tally();
    const dias = t?.porDia ?? [];
    const max = Math.max(0, ...dias.map((d) => d.points));
    // Só realça quando há variação real entre os dias (mais de um dia pontuado).
    const distinguish = dias.length > 1 && t?.melhorDia?.points !== t?.piorDia?.points;
    return dias.map((d) => ({
      label: this.shortDay(d.date),
      points: d.points,
      jogos: d.jogos,
      height: max > 0 ? d.points / max : 0,
      isBest: distinguish && d.date === t?.melhorDia?.date,
      isWorst: distinguish && d.date === t?.piorDia?.date,
    }));
  });

  /** Células do card "pontos por fase" (rodadas de grupo + fases de mata-mata). */
  readonly phaseCells = computed<PhaseCell[]>(() => {
    const fases = this.tally()?.porFase ?? [];
    const max = Math.max(0, ...fases.map((f) => f.points));
    return fases.map((f) => ({
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

  readonly ranking = computed(() => rankEntries(this.entries(), this.matches()));

  /** Palpites do entry selecionado já resolvidos (placar real × pts), para as modais. */
  readonly breakdown = computed<ScoredGuess[]>(() => {
    const entry = this.selected();
    return entry ? entryBreakdown(entry, this.matches()) : [];
  });

  /** Modal de detalhe aberta (título + itens filtrados), ou null. */
  readonly detalhe = signal<{ title: string; items: ScoredGuess[] } | null>(null);

  /** Abre a modal de uma categoria (Cravou/Acertou/Errou). Não abre se vazia. */
  openCategoria(kind: 'cravou' | 'acertou' | 'errou'): void {
    const wanted = kind === 'cravou' ? 3 : kind === 'acertou' ? 1 : 0;
    const items = this.breakdown().filter((g) => g.pts === wanted);
    if (!items.length) return;
    const title = kind === 'cravou' ? 'Cravou' : kind === 'acertou' ? 'Acertou' : 'Errou';
    this.detalhe.set({ title, items });
  }

  /** Abre a modal de um grupo: todos os palpites de jogos já pontuados (acertos e erros).
   *  Não abre se o grupo ainda não tem jogos pontuados. */
  openGrupo(label: string): void {
    const key = label === 'KO' ? 'KO' : `GROUP_${label}`;
    const items = this.breakdown().filter((g) => g.group === key);
    if (!items.length) return;
    const title = label === 'KO' ? 'Mata-mata' : `Grupo ${label}`;
    this.detalhe.set({ title, items });
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
          ptsLabel: pts === 3 ? 'Cravou' : pts === 1 ? 'Acertou' : pts === 0 ? 'Errou' : '',
        };
      });
  });

  /** Próximo jogo a acontecer (agendado, ainda não começou), com palpite resolvido. */
  readonly nextRow = computed<NextRow | null>(() => {
    const now = Date.now();
    const upcoming = this.matches()
      .filter(
        (m) =>
          !isLiveOrStarted(m) &&
          (m.status === MatchStatus.TIMED || m.status === MatchStatus.SCHEDULED) &&
          Date.parse(m.utcDate) > now,
      )
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

    const m = upcoming[0];
    if (!m) return null;

    const entry = this.selected();
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

  private teamTla(team: Match['homeTeam']): string {
    return team.tla || team.shortName || '—';
  }

  /** "AAAA-MM-DD" → "dd/mm". */
  private shortDay(date: string): string {
    const [, m, d] = date.split('-');
    return `${d}/${m}`;
  }

  select(id: string): void {
    this.selectedId.set(id);
  }

  /** Baixa o palpite selecionado como JSON. */
  exportSelected(): void {
    const entry = this.selected();
    if (!entry) return;
    downloadJson(`bolao-${slugify(entry.name)}.json`, exportEntry(entry));
  }

  /** Lê o arquivo escolhido, valida e importa para o store. */
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = parseEntries(String(reader.result ?? ''));
      if (!result.ok) {
        this.feedback.set({ kind: 'err', text: result.error });
        return;
      }
      try {
        const added = await this.store.importEntries(result.entries);
        if (added[0]) this.selectedId.set(added[0].id);
        const n = added.length;
        this.feedback.set({
          kind: 'ok',
          text: n === 1 ? 'Palpite importado.' : `${n} palpites importados.`,
        });
      } catch (err) {
        this.feedback.set({ kind: 'err', text: (err as Error).message });
      }
    };
    reader.onerror = () => this.feedback.set({ kind: 'err', text: 'Falha ao ler o arquivo.' });
    reader.readAsText(file);
    input.value = ''; // permite reimportar o mesmo arquivo
  }
}
