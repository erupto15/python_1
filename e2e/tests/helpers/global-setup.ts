import fs from 'node:fs';
import { adminToken, api } from './api';
import { SEED, STATE_FILE, type SeedState } from './data';

type Named = { id: number; name: string };

async function ensure<T extends Named>(list: T[], name: string, create: () => Promise<T>): Promise<T> {
  return list.find((item) => item.name === name) ?? (await create());
}

/** Idempotent: with reuseExistingServer the same DB may already contain the data. */
export default async function globalSetup(): Promise<void> {
  const token = await adminToken();
  const post = <T>(p: string, body: unknown) => api<T>(p, { method: 'POST', body, token });

  const areas = await api<Named[]>('/api/areas');
  const alpha = await ensure(areas, SEED.areaAlpha.name, () => post('/api/areas', SEED.areaAlpha));
  const beta = await ensure(areas, SEED.areaBeta.name, () => post('/api/areas', SEED.areaBeta));
  const demo = areas.find((a) => a.name === 'Общий район') ?? null;

  const alphaSectors = await api<Named[]>(`/api/areas/${alpha.id}/sectors`);
  const mixed = await ensure(alphaSectors, SEED.sectorMixed.name, () => post(`/api/areas/${alpha.id}/sectors`, SEED.sectorMixed));
  const boulderSector = await ensure(alphaSectors, SEED.sectorBoulder.name, () => post(`/api/areas/${alpha.id}/sectors`, SEED.sectorBoulder));
  const betaSectors = await api<Named[]>(`/api/areas/${beta.id}/sectors`);
  const betaSector = await ensure(betaSectors, SEED.sectorBeta.name, () => post(`/api/areas/${beta.id}/sectors`, SEED.sectorBeta));

  const routes = await api<Named[]>('/api/routes');
  const boulders = await api<Named[]>('/api/boulders');
  const route = (sector: Named, areaId: number, data: object, lat: number, lng: number) =>
    post<Named>('/api/routes', { ...data, sector_id: sector.id, area_id: areaId, latitude: lat, longitude: lng });
  const boulder = (sector: Named, areaId: number, data: object, lat: number, lng: number) =>
    post<Named>('/api/boulders', { ...data, sector_id: sector.id, area_id: areaId, latitude: lat, longitude: lng });

  const routeBlue = await ensure(routes, SEED.routeBlue.name, () => route(mixed, alpha.id, SEED.routeBlue, 44.6013, 34.1016));
  const routeRed = await ensure(routes, SEED.routeRed.name, () => route(mixed, alpha.id, SEED.routeRed, 44.6014, 34.1018));
  const boulderWind = await ensure(boulders, SEED.boulderWind.name, () => boulder(mixed, alpha.id, SEED.boulderWind, 44.6011, 34.1012));
  const boulderStone = await ensure(boulders, SEED.boulderStone.name, () => boulder(boulderSector, alpha.id, SEED.boulderStone, 44.6032, 34.1043));
  const routeBeta = await ensure(routes, SEED.routeBeta.name, () => route(betaSector, beta.id, SEED.routeBeta, 45.2009, 35.4012));

  const state: SeedState = {
    areaAlphaId: alpha.id,
    areaBetaId: beta.id,
    demoAreaId: demo?.id ?? null,
    sectorMixedId: mixed.id,
    sectorBoulderId: boulderSector.id,
    sectorBetaId: betaSector.id,
    routeBlueId: routeBlue.id,
    routeRedId: routeRed.id,
    boulderWindId: boulderWind.id,
    boulderStoneId: boulderStone.id,
    routeBetaId: routeBeta.id,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
