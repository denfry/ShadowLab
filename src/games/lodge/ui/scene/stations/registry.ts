import type { ComponentType } from 'react';
import type { StationProps } from './types';
import { DialStation } from './DialStation';
import { ConstellationStation } from './ConstellationStation';
import { CandelabraStation } from './CandelabraStation';

const BY_KIND: Record<string, ComponentType<StationProps>> = {
  dial: DialStation,
  constellation: ConstellationStation,
  candelabra: CandelabraStation,
};

export function stationFor(viewKind: string): ComponentType<StationProps> | null {
  return BY_KIND[viewKind] ?? null;
}
