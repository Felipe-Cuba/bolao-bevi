// Nomes das 48 seleções da Copa 2026 em português, mapeados pelo código TLA
// (3 letras) que a API retorna — estável e legível. Derivado de wc-response-complete.json.

import { Team } from '@shared/models/match.model';

/** Código TLA (3 letras) das seleções participantes. */
export enum TeamCode {
  ALG = 'ALG',
  ARG = 'ARG',
  AUS = 'AUS',
  AUT = 'AUT',
  BEL = 'BEL',
  BIH = 'BIH',
  BRA = 'BRA',
  CAN = 'CAN',
  CPV = 'CPV',
  COL = 'COL',
  COD = 'COD',
  CRO = 'CRO',
  CUW = 'CUW',
  CZE = 'CZE',
  ECU = 'ECU',
  EGY = 'EGY',
  ENG = 'ENG',
  FRA = 'FRA',
  GER = 'GER',
  GHA = 'GHA',
  HAI = 'HAI',
  IRN = 'IRN',
  IRQ = 'IRQ',
  CIV = 'CIV',
  JPN = 'JPN',
  JOR = 'JOR',
  MEX = 'MEX',
  MAR = 'MAR',
  NED = 'NED',
  NZL = 'NZL',
  NOR = 'NOR',
  PAN = 'PAN',
  PAR = 'PAR',
  POR = 'POR',
  QAT = 'QAT',
  KSA = 'KSA',
  SCO = 'SCO',
  SEN = 'SEN',
  RSA = 'RSA',
  KOR = 'KOR',
  ESP = 'ESP',
  SWE = 'SWE',
  SUI = 'SUI',
  TUN = 'TUN',
  TUR = 'TUR',
  USA = 'USA',
  URY = 'URY',
  UZB = 'UZB',
}

/** Nome oficial em português por código TLA. */
export const TEAM_NAME_PT: Record<TeamCode, string> = {
  [TeamCode.ALG]: 'Argélia',
  [TeamCode.ARG]: 'Argentina',
  [TeamCode.AUS]: 'Austrália',
  [TeamCode.AUT]: 'Áustria',
  [TeamCode.BEL]: 'Bélgica',
  [TeamCode.BIH]: 'Bósnia e Herzegovina',
  [TeamCode.BRA]: 'Brasil',
  [TeamCode.CAN]: 'Canadá',
  [TeamCode.CPV]: 'Cabo Verde',
  [TeamCode.COL]: 'Colômbia',
  [TeamCode.COD]: 'RD Congo',
  [TeamCode.CRO]: 'Croácia',
  [TeamCode.CUW]: 'Curaçao',
  [TeamCode.CZE]: 'Tchéquia',
  [TeamCode.ECU]: 'Equador',
  [TeamCode.EGY]: 'Egito',
  [TeamCode.ENG]: 'Inglaterra',
  [TeamCode.FRA]: 'França',
  [TeamCode.GER]: 'Alemanha',
  [TeamCode.GHA]: 'Gana',
  [TeamCode.HAI]: 'Haiti',
  [TeamCode.IRN]: 'Irã',
  [TeamCode.IRQ]: 'Iraque',
  [TeamCode.CIV]: 'Costa do Marfim',
  [TeamCode.JPN]: 'Japão',
  [TeamCode.JOR]: 'Jordânia',
  [TeamCode.MEX]: 'México',
  [TeamCode.MAR]: 'Marrocos',
  [TeamCode.NED]: 'Holanda',
  [TeamCode.NZL]: 'Nova Zelândia',
  [TeamCode.NOR]: 'Noruega',
  [TeamCode.PAN]: 'Panamá',
  [TeamCode.PAR]: 'Paraguai',
  [TeamCode.POR]: 'Portugal',
  [TeamCode.QAT]: 'Catar',
  [TeamCode.KSA]: 'Arábia Saudita',
  [TeamCode.SCO]: 'Escócia',
  [TeamCode.SEN]: 'Senegal',
  [TeamCode.RSA]: 'África do Sul',
  [TeamCode.KOR]: 'Coreia do Sul',
  [TeamCode.ESP]: 'Espanha',
  [TeamCode.SWE]: 'Suécia',
  [TeamCode.SUI]: 'Suíça',
  [TeamCode.TUN]: 'Tunísia',
  [TeamCode.TUR]: 'Turquia',
  [TeamCode.USA]: 'Estados Unidos',
  [TeamCode.URY]: 'Uruguai',
  [TeamCode.UZB]: 'Uzbequistão',
};

export const TEAM_CODE_PT: Record<TeamCode, string> = {
  [TeamCode.ALG]: 'ALG', // Argélia
  [TeamCode.ARG]: 'ARG', // Argentina
  [TeamCode.AUS]: 'AUS', // Austrália
  [TeamCode.AUT]: 'AUT', // Áustria
  [TeamCode.BEL]: 'BEL', // Bélgica
  [TeamCode.BIH]: 'BOS', // Bósnia e Herzegovina
  [TeamCode.BRA]: 'BRA', // Brasil
  [TeamCode.CAN]: 'CAN', // Canadá
  [TeamCode.CPV]: 'CBV', // Cabo Verde
  [TeamCode.COL]: 'COL', // Colômbia
  [TeamCode.COD]: 'RDC', // RD Congo
  [TeamCode.CRO]: 'CRO', // Croácia
  [TeamCode.CUW]: 'CUR', // Curaçao
  [TeamCode.CZE]: 'TCH', // Tchéquia
  [TeamCode.ECU]: 'EQU', // Equador
  [TeamCode.EGY]: 'EGI', // Egito
  [TeamCode.ENG]: 'ING', // Inglaterra
  [TeamCode.FRA]: 'FRA', // França
  [TeamCode.GER]: 'ALE', // Alemanha
  [TeamCode.GHA]: 'GAN', // Gana
  [TeamCode.HAI]: 'HAI', // Haiti
  [TeamCode.IRN]: 'IRA', // Irã
  [TeamCode.IRQ]: 'IRQ', // Iraque
  [TeamCode.CIV]: 'CMF', // Costa do Marfim
  [TeamCode.JPN]: 'JAP', // Japão
  [TeamCode.JOR]: 'JOR', // Jordânia
  [TeamCode.MEX]: 'MEX', // México
  [TeamCode.MAR]: 'MAR', // Marrocos
  [TeamCode.NED]: 'HOL', // Holanda
  [TeamCode.NZL]: 'NZE', // Nova Zelândia
  [TeamCode.NOR]: 'NOR', // Noruega
  [TeamCode.PAN]: 'PAN', // Panamá
  [TeamCode.PAR]: 'PAR', // Paraguai
  [TeamCode.POR]: 'POR', // Portugal
  [TeamCode.QAT]: 'CAT', // Catar
  [TeamCode.KSA]: 'ARS', // Arábia Saudita
  [TeamCode.SCO]: 'ESC', // Escócia
  [TeamCode.SEN]: 'SEN', // Senegal
  [TeamCode.RSA]: 'AFS', // África do Sul
  [TeamCode.KOR]: 'COR', // Coreia do Sul
  [TeamCode.ESP]: 'ESP', // Espanha
  [TeamCode.SWE]: 'SUE', // Suécia
  [TeamCode.SUI]: 'SUI', // Suíça
  [TeamCode.TUN]: 'TUN', // Tunísia
  [TeamCode.TUR]: 'TUR', // Turquia
  [TeamCode.USA]: 'EUA', // Estados Unidos
  [TeamCode.URY]: 'URU', // Uruguai
  [TeamCode.UZB]: 'UZB', // Uzbequistão
};

/**
 * Nome em português de uma seleção; cai no nome original da API se o código
 * não estiver mapeado, ou em "A definir" quando o time ainda não foi definido
 * (placeholders de mata-mata vêm com campos nulos).
 */
export function teamNamePt(team: Pick<Team, 'tla' | 'name'> | null | undefined): string {
  if (!team) return 'A definir';
  const code = team.tla as TeamCode;
  return TEAM_NAME_PT[code] ?? team.name ?? 'A definir';
}

export function teamShortNamePt(team: Pick<Team, 'tla' | 'shortName'> | string | null | undefined): string {
  if (!team) return 'A definir';
  const code = typeof team === 'string' ? team as TeamCode : team.tla as TeamCode;
  return TEAM_CODE_PT[code] ?? (typeof team === 'string' ? team : team.shortName) ?? 'A definir';
}

/** True quando o time ainda não foi definido (placeholder de mata-mata). */
export function isPlaceholderTeam(team: Pick<Team, 'tla' | 'crest'> | null | undefined): boolean {
  return !team || !team.crest;
}

/** Escudo genérico (SVG data-URI) usado quando o time ainda não tem escudo. */
export const PLACEHOLDER_CREST =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9aa4b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5l-8-3Z"/><path d="M9 12h6M12 9v6"/></svg>`,
  );

/** Crest da seleção, ou o escudo genérico quando indefinido. */
export function teamCrest(team: Pick<Team, 'crest'> | null | undefined): string {
  return team?.crest || PLACEHOLDER_CREST;
}
