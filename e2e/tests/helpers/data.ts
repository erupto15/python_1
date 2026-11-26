import fs from 'node:fs';
import path from 'node:path';

export const STATE_FILE = path.join(__dirname, '..', '..', '.e2e-state.json');

/** Names are unique enough to be searched for and to never collide with the demo seed. */
export const SEED = {
  areaAlpha: { name: 'E2E Скалы Альфа', description: 'Тестовый район с трассами и боулдерами', latitude: 44.6, longitude: 34.1 },
  areaBeta: { name: 'E2E Район Бета', description: 'Второй тестовый район', latitude: 45.2, longitude: 35.4 },
  sectorMixed: { name: 'E2E Сектор Смешанный', latitude: 44.6012, longitude: 34.1015 },
  sectorBoulder: { name: 'E2E Сектор Камни', latitude: 44.6031, longitude: 34.1042 },
  sectorBeta: { name: 'E2E Сектор Бета-1', latitude: 45.2008, longitude: 35.4011 },
  routeBlue: { name: 'E2E Синяя Птица', grade: '6a', length_m: 18, bolts: 7, description: 'Тестовая трасса по плите' },
  routeRed: { name: 'E2E Красный Карниз', grade: '7a+', length_m: 22, bolts: 9 },
  boulderWind: { name: 'E2E Камень Ветра', grade: '6A', height_m: 3.5 },
  boulderStone: { name: 'E2E Старый Валун', grade: '7B' },
  routeBeta: { name: 'E2E Бета Классика', grade: '5c' },
} as const;

export interface SeedState {
  areaAlphaId: number;
  areaBetaId: number;
  demoAreaId: number | null;
  sectorMixedId: number;
  sectorBoulderId: number;
  sectorBetaId: number;
  routeBlueId: number;
  routeRedId: number;
  boulderWindId: number;
  boulderStoneId: number;
  routeBetaId: number;
}

export function readSeedState(): SeedState {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as SeedState;
}
