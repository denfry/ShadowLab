import type { BuildingType } from '../domain/types';
import { BUILDING_JOB, BUILDING_WORK_SLOTS } from './balance';

export const BUILDABLE: BuildingType[] = ['farm', 'bedroom', 'storage', 'lab', 'wall', 'door', 'heater', 'tailor'];

export const BUILDING_LABEL: Record<BuildingType, string> = {
  farm: 'Ферма', bedroom: 'Спальня', storage: 'Склад', lab: 'Лаборатория',
  wall: 'Стена', door: 'Дверь', heater: 'Обогреватель', tailor: 'Верстак',
};

export const buildingJob = (t: BuildingType) => BUILDING_JOB[t];
export const buildingSlots = (t: BuildingType) => BUILDING_WORK_SLOTS[t];
