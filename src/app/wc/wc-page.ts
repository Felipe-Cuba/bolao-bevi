import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { Firestore } from '@angular/fire/firestore';
import { storageSignal } from 'ngx-oneforall/signals/storage-signal';
import { breakpointMatcher } from 'ngx-oneforall/signals/breakpoint-matcher';
import { BREAKPOINT } from 'ngx-oneforall/constants';

import { GrupoService } from '../bolao/grupo.service';

import { wcMatchesQueryOptions, REFRESH_COOLDOWN_MS } from './wc-api';
import { Match, MatchStatus } from './wc.types';
import {
  buildHighlights,
  buildStandings,
  distinctGroups,
  groupMatches,
} from './wc-derivations';
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
} from '@lucide/angular';

import { HighlightsComponent } from './highlights';
import { MatchList } from './match-list';
import { StandingsTable } from './standings-table';
import { BolaoModal } from '../bolao/bolao-modal';
import { BolaoPanel } from '../bolao/bolao-panel';
import { GrupoModal } from '../bolao/grupo-modal';

type Tab = 'highlights' | 'matches' | 'standings' | 'bolao';

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
  ],
  templateUrl: './wc-page.html',
  styleUrl: './wc-page.css',
})
export class WcPage {
  private readonly firestore = inject(Firestore);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  readonly grupo = inject(GrupoService);

  // Uma única query compartilhada; cache + gate de 30s (Firestore) controlam os requests.
  readonly query = injectQuery(() => wcMatchesQueryOptions(this.injector, this.firestore));

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
    const remaining = REFRESH_COOLDOWN_MS - (this.now() - ts);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  });

  /** Fração restante do cooldown (1 → 0) para a barra de progresso no botão. */
  readonly cooldownFraction = computed(() => {
    const ts = this.updatedAtMs();
    if (ts == null) return 0;
    const remaining = REFRESH_COOLDOWN_MS - (this.now() - ts);
    return remaining > 0 ? remaining / REFRESH_COOLDOWN_MS : 0;
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
  readonly standings = computed(() => buildStandings(this.matches()));
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
  refresh(): void {
    if (this.refreshBlocked() || this.query.isFetching()) return;
    this.query.refetch();
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
