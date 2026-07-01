import type { BuildingType } from '../domain/types';
import { BUILDING_JOB, BUILDING_WORK_SLOTS } from './balance';

export const BUILDABLE: BuildingType[] = ['bedroom', 'storage', 'lab', 'wall', 'door', 'heater', 'tailor', 'bridge', 'tunnel'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
  wall: 'Стена', door: 'Дверь', heater: 'Обогреватель', tailor: 'Верстак',
  bridge: 'Мост', tunnel: 'Туннель',
};

export const buildingJob = (t: BuildingType) => BUILDING_JOB[t];
export const buildingSlots = (t: BuildingType) => BUILDING_WORK_SLOTS[t];
