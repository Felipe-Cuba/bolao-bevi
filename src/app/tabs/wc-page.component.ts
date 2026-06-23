import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { storageSignal } from 'ngx-oneforall/signals/storage-signal';
import { breakpointMatcher } from 'ngx-oneforall/signals/breakpoint-matcher';
import { BREAKPOINT } from 'ngx-oneforall/constants';

import { GrupoService } from '@core/grupo.service';

import { MatchesApi } from '@core/matches.api';
import { Match, MatchPart, MatchStatus, Scorer } from '@shared/models/match.model';
import {
  buildHighlights,
  buildStandings,
  distinctGroups,
  groupMatches,
} from '@shared/utils/match-derivations.util';
import { buildBracketTree } from '@shared/utils/bracket-tree.util';
import {
  LucideTrophy,
  LucideLayoutDashboard,
  LucideListOrdered,
  LucideTable,
  LucideRefreshCw,
  LucideUsers,
  LucideCopy,
  LucideCheck,
  LucideLogOut,
  LucideTarget,
  LucideGitFork,
} from '@lucide/angular';

import { HighlightsComponent } from './highlights/highlights.component';
import { MatchList } from '@shared/components/match-list/match-list.component';
import { StandingsTable } from './standings/standings.component';
import { BracketView } from './bracket/bracket.component';
import { ScorersTable } from './scorers/scorers.component';
import { BolaoModal } from './bolao/components/entry-modal/entry-modal.component';
import { BolaoPanel } from './bolao/panel.component';
import { GrupoModal } from './bolao/components/grupo-modal/grupo-modal.component';

type Tab = 'highlights' | 'matches' | 'standings' | 'scorers' | 'bracket' | 'bolao';

interface Filters {
  tab: Tab;
  status: MatchStatus | 'ALL';
  group: string | 'ALL';
}

const DEFAULT_FILTERS: Filters = { tab: 'highlights', status: 'ALL', group: 'ALL' };

@Component({
  selector: 'app-wc-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HighlightsComponent,
    MatchList,
    StandingsTable,
    BracketView,
    ScorersTable,
    BolaoModal,
    BolaoPanel,
    GrupoModal,
    LucideTrophy,
    LucideLayoutDashboard,
    LucideListOrdered,
    LucideTable,
    LucideRefreshCw,
    LucideUsers,
    LucideCopy,
    LucideCheck,
    LucideLogOut,
    LucideTarget,
    LucideGitFork,
  ],
  templateUrl: './wc-page.component.html',
  styleUrl: './wc-page.component.css',
})
export class WcPage {
  private readonly route = inject(ActivatedRoute);
  private readonly matchesApi = inject(MatchesApi);
  readonly grupo = inject(GrupoService);

  // Uma única query compartilhada; cache + gate de 30s (Firestore) controlam os requests.
  readonly query = injectQuery(() => this.matchesApi.matchesQueryOptions());

  // Artilharia: query lazy, só dispara quando os dados são necessários (aba Artilheiros
  // ou card Top 5 em Destaques). Mesmo gate de 30s das partidas.
  readonly scorersQuery = injectQuery(() => ({
    ...this.matchesApi.scorersQueryOptions(),
    enabled: this.filters().tab === 'scorers' || this.filters().tab === 'highlights',
  }));

  readonly scorers = computed<Scorer[]>(() => this.scorersQuery.data()?.data.scorers ?? []);

  // Classificação: lê SÓ as partes da fase de grupos (group-1/2/3), não o torneio inteiro.
  // Lazy — só dispara na aba Classificação. Partes já encerradas vêm do cache (imutáveis).
  readonly standingsQuery = injectQuery(() => ({
    ...this.matchesApi.partsQueryOptions(['group-1', 'group-2', 'group-3']),
    enabled: this.filters().tab === 'standings' || this.filters().tab === 'bracket',
  }));

  // Mata-mata: lê as partes do KO (oitavas→final) p/ preencher a árvore do chaveamento.
  // Lazy — só dispara na aba Chaveamento. Partes ainda vazias (placeholders) viram "A definir".
  readonly knockoutQuery = injectQuery(() => ({
    ...this.matchesApi.partsQueryOptions(['last-32', 'last-16', 'quarters', 'semis', 'final']),
    enabled: this.filters().tab === 'bracket',
  }));

  private readonly knockoutParts = computed<MatchPart[]>(
    () => this.knockoutQuery.data()?.parts ?? [],
  );

  /** Jogos da fase de grupos vindos das partições (para a classificação). */
  private readonly groupMatches = computed<Match[]>(() =>
    (this.standingsQuery.data()?.parts ?? []).flatMap((p) => p.matches),
  );

  // Tick de 1s para recalcular o cooldown do botão Atualizar. Usa signal + setInterval
  // (não o intervalSignal do ngx-oneforall, que roda fora da zona e, num app zoneless,
  // não agenda change detection — a barra ficaria "congelada" e só atualizaria aos saltos).
  private readonly now = signal(Date.now());

  /** Quando a última atualização real aconteceu (epoch ms), vindo do banco/Function. */
  readonly updatedAtMs = computed(() => this.query.data()?.updatedAtMs ?? null);

  /** Segundos restantes do cooldown de 30s (0 = liberado). Reage ao tick a cada 1s. */
  readonly cooldownSeconds = computed(() => {
    const ts = this.updatedAtMs();
    if (ts == null) return 0;
    const remaining = this.matchesApi.refreshCooldownMs - (this.now() - ts);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  });

  /** Fração restante do cooldown (1 → 0) para a barra de progresso no botão. */
  readonly cooldownFraction = computed(() => {
    const ts = this.updatedAtMs();
    if (ts == null) return 0;
    const cooldown = this.matchesApi.refreshCooldownMs;
    const remaining = cooldown - (this.now() - ts);
    return remaining > 0 ? remaining / cooldown : 0;
  });

  readonly refreshBlocked = computed(() => this.cooldownSeconds() > 0);

  constructor() {
    // Tick de 1s: atualiza `now` (signal → agenda CD no zoneless) p/ a barra do cooldown.
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Liga/desliga o modo grupo conforme o :codigo da rota (entra/sai do grupo).
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      void this.grupo.sync(params.get('codigo'));
    });
  }

  // Controla a modal do Bolão Bevi.
  readonly bolaoOpen = signal(false);

  // Controla a modal de criação de grupo + feedback do "copiar link".
  readonly grupoModalOpen = signal(false);
  readonly linkCopied = signal(false);

  async copyGroupLink(): Promise<void> {
    if (await this.grupo.copyLink()) {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    }
  }

  // Filtros + aba ativa persistidos em localStorage (signals, sem request).
  readonly filters = storageSignal<Filters>('wc.filters', DEFAULT_FILTERS);

  // Responsividade reativa.
  readonly isDesktop = breakpointMatcher(BREAKPOINT.MD);

  readonly matches = computed<Match[]>(() => this.query.data()?.data.matches ?? []);
  readonly source = computed(() => this.query.data()?.source ?? null);
  readonly competition = computed(() => this.query.data()?.data.competition ?? null);

  readonly lastUpdated = computed(() => {
    const ts = this.query.dataUpdatedAt();
    return ts ? new Date(ts).toLocaleTimeString('pt-BR') : '—';
  });

  // Derivações (não disparam request).
  readonly highlights = computed(() => buildHighlights(this.matches()));
  readonly standings = computed(() => buildStandings(this.groupMatches()));
  readonly bracketTree = computed(() =>
    buildBracketTree(this.standings(), this.knockoutParts()),
  );
  readonly groups = computed(() => distinctGroups(this.matches()));

  readonly statusOptions: (MatchStatus | 'ALL')[] = [
    'ALL',
    MatchStatus.TIMED,
    MatchStatus.IN_PLAY,
    MatchStatus.FINISHED,
  ];

  // Lista filtrada e agrupada conforme os filtros selecionados.
  readonly filteredGroups = computed(() => {
    const { status, group } = this.filters();
    const filtered = this.matches().filter((m) => {
      const okStatus = status === 'ALL' || m.status === status;
      const okGroup = group === 'ALL' || m.group === group;
      return okStatus && okGroup;
    });
    return groupMatches(filtered);
  });

  setTab(tab: Tab): void {
    this.filters.update((f: Filters) => ({ ...f, tab }));
  }

  setStatus(value: string): void {
    this.filters.update((f: Filters) => ({ ...f, status: value as Filters['status'] }));
  }

  setGroup(value: string): void {
    this.filters.update((f: Filters) => ({ ...f, group: value as Filters['group'] }));
  }

  // Atualização manual: bloqueada durante o cooldown de 30s (gate do banco).
  // Atualiza partidas E artilheiros no mesmo clique; o gate de 30s server-side de cada
  // endpoint evita chamadas reais redundantes à API (rate limit 10/min).
  refresh(): void {
    if (this.refreshBlocked() || this.query.isFetching()) return;
    this.query.refetch();
    this.scorersQuery.refetch();
  }

  openBolao(): void {
    this.bolaoOpen.set(true);
  }

  closeBolao(): void {
    this.bolaoOpen.set(false);
  }

  groupShortLabel(group: string): string {
    return group.replace('GROUP_', 'Grupo ');
  }

  statusLabel(status: MatchStatus | 'ALL'): string {
    const labels: Record<string, string> = {
      ALL: 'Todos',
      [MatchStatus.TIMED]: 'Agendado',
      [MatchStatus.IN_PLAY]: 'Ao vivo',
      [MatchStatus.FINISHED]: 'Encerrado',
    };
    return labels[status] ?? status;
  }
}
