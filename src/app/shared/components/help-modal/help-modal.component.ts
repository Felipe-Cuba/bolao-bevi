import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  LucideCrosshair,
  LucideGoal,
  LucideCircleQuestionMark,
  LucideThumbsUp,
  LucideX,
} from '@lucide/angular';

/** Escala de acerto (mesmas cores/ícones do Bolão). */
export type HelpTone = 'cravou' | 'trave' | 'acertou' | 'errou';

/** Um bloco de conteúdo da modal de ajuda. */
export type HelpBlock =
  /** Parágrafo simples (texto introdutório/explicativo). */
  | { kind: 'paragraph'; text: string }
  /** Subtítulo de uma seção. */
  | { kind: 'heading'; text: string }
  /** Item com título em negrito + texto (ex.: "Palpite nos 16-avos: ..."). */
  | { kind: 'topic'; title: string; text: string }
  /** Linha da escala de pontuação: ícone/cor pelo `tone` + rótulo + texto. */
  | { kind: 'score'; tone: HelpTone; label: string; text: string };

/**
 * Modal de ajuda genérica (conteúdo fixo passado por quem abre). Reusa o shell visual dos
 * demais modais do app. Os blocos suportam texto e linhas de pontuação (ícone Lucide por tom).
 */
@Component({
  selector: 'app-help-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCircleQuestionMark, LucideX, LucideCrosshair, LucideGoal, LucideThumbsUp],
  templateUrl: './help-modal.component.html',
  styleUrl: './help-modal.component.css',
})
export class HelpModal {
  readonly title = input.required<string>();
  readonly blocks = input.required<HelpBlock[]>();

  readonly close = output<void>();

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }
}
