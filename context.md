### API Football Data

**Base URL:** `https://api.football-data.org`

| Propriedade | Valor |
|---|---|
| Rate limit | 10 calls/min |
| Auth header | `X-Auth-Token: 1f8d5e27173e4d1bbd550db3334cd563` |

---

#### `GET /v4/competitions/WC/matches`

Retorna todas as partidas da Copa do Mundo, incluindo resultados, placar e árbitros.

> 📄 Response completa com todos os jogos da Copa 2026 disponível em [`./wc-response-complete.json`](./wc-response-complete.json).
> O mata-mata já está agendado, porém sem os times definidos (ainda na fase de grupos).

**Exemplo de response**

```json
{
  "filters": { "season": "2026" },
  "resultSet": {
    "count": 104,
    "first": "2026-06-11",
    "last": "2026-07-19",
    "played": 17
  },
  "competition": {
    "id": 2000,
    "name": "FIFA World Cup",
    "code": "WC",
    "type": "CUP",
    "emblem": "https://crests.football-data.org/wm26.png"
  },
  "matches": [
    {
      "id": 537327,
      "utcDate": "2026-06-11T19:00:00Z",
      "status": "FINISHED",
      "matchday": 1,
      "stage": "GROUP_STAGE",
      "group": "GROUP_A",
      "lastUpdated": "2026-06-16T15:20:15Z",
      "homeTeam": {
        "id": 769,
        "name": "Mexico",
        "shortName": "Mexico",
        "tla": "MEX",
        "crest": "https://crests.football-data.org/769.svg"
      },
      "awayTeam": {
        "id": 774,
        "name": "South Africa",
        "shortName": "South Africa",
        "tla": "RSA",
        "crest": "https://crests.football-data.org/9396.svg"
      },
      "score": {
        "winner": "HOME_TEAM",
        "duration": "REGULAR",
        "fullTime": { "home": 2, "away": 0 },
        "halfTime": { "home": 1, "away": 0 }
      },
      "referees": [
        {
          "id": 11412,
          "name": "Wilton Sampaio",
          "type": "REFEREE",
          "nationality": "Brazil"
        }
      ]
    }
  ]
}
```

---

#### Campos relevantes por objeto

**`match`**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `number` | ID único da partida |
| `utcDate` | `string` (ISO 8601) | Data e hora em UTC |
| `status` | `MatchStatus` | Status atual da partida |
| `matchday` | `number` | Rodada |
| `stage` | `MatchStage` | Fase (ex: `GROUP_STAGE`, `FINAL`) |
| `group` | `string \| null` | Grupo (ex: `GROUP_A`); `null` no mata-mata |
| `lastUpdated` | `string` (ISO 8601) | Última atualização |

**`score`**

| Campo | Tipo | Descrição |
|---|---|---|
| `winner` | `"HOME_TEAM" \| "AWAY_TEAM" \| "DRAW" \| null` | Vencedor da partida |
| `duration` | `"REGULAR" \| "EXTRA_TIME" \| "PENALTY_SHOOTOUT"` | Duração da partida |
| `fullTime` | `{ home: number \| null, away: number \| null }` | Placar final |
| `halfTime` | `{ home: number \| null, away: number \| null }` | Placar no intervalo |

---

#### `MatchStatus`

```typescript
enum MatchStatus {
  SCHEDULED = "SCHEDULED", // partida agendada, ainda não iniciada
  LIVE      = "LIVE",      // ao vivo (genérico)
  IN_PLAY   = "IN_PLAY",   // em andamento
  PAUSED    = "PAUSED",    // intervalo
  FINISHED  = "FINISHED",  // encerrada
  POSTPONED = "POSTPONED", // adiada
  SUSPENDED = "SUSPENDED", // suspensa
  CANCELLED = "CANCELLED", // cancelada
}
```

#### `MatchStage`

```typescript
enum MatchStage {
  FINAL                = "FINAL",
  THIRD_PLACE          = "THIRD_PLACE",
  SEMI_FINALS          = "SEMI_FINALS",
  QUARTER_FINALS       = "QUARTER_FINALS",
  LAST_16              = "LAST_16",
  LAST_32              = "LAST_32",
  LAST_64              = "LAST_64",
  ROUND_4              = "ROUND_4",
  ROUND_3              = "ROUND_3",
  ROUND_2              = "ROUND_2",
  ROUND_1              = "ROUND_1",
  GROUP_STAGE          = "GROUP_STAGE",
  PRELIMINARY_ROUND    = "PRELIMINARY_ROUND",
  QUALIFICATION        = "QUALIFICATION",
  QUALIFICATION_ROUND_1 = "QUALIFICATION_ROUND_1",
  QUALIFICATION_ROUND_2 = "QUALIFICATION_ROUND_2",
  QUALIFICATION_ROUND_3 = "QUALIFICATION_ROUND_3",
  PLAYOFF_ROUND_1      = "PLAYOFF_ROUND_1",
  PLAYOFF_ROUND_2      = "PLAYOFF_ROUND_2",
  PLAYOFFS             = "PLAYOFFS",
  REGULAR_SEASON       = "REGULAR_SEASON",
  CLAUSURA             = "CLAUSURA",
  APERTURA             = "APERTURA",
  CHAMPIONSHIP         = "CHAMPIONSHIP",
  RELEGATION           = "RELEGATION",
  RELEGATION_ROUND     = "RELEGATION_ROUND",
}
```
