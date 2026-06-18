import type { Condition, Grant } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneLayer {
  id: string;
  z: number;
  shape: 'rect' | 'figure' | 'object' | 'text' | 'shadow' | 'reflection' | 'sprite';
  at: Rect;
  sprite?: string;
  tint?: string;
  rotation?: number;
  opacity?: number;
  props?: Record<string, unknown>;
}

export interface Hotspot {
  id: string;
  at: Rect;
  label: string;
  revealRequires?: Condition;
  grants?: Grant[];
}

export interface VideoFrame {
  t: number;
  changes: Array<Partial<SceneLayer>>;
  hotspots?: Hotspot[];
}

export interface Artifact {
  id: string;
  type:
    | 'clone'
    | 'shadow_mismatch'
    | 'impossible_reflection'
    | 'clock_conflict'
    | 'timestamp_metadata_mismatch'
    | 'splice_seam'
    | 'lighting_inconsistency';
  at?: Rect;
  tell: string;
  detectRequires?: Condition;
  grants?: Grant[];
}

export interface MediaSpec {
  kind: 'photo' | 'video';
  aspect: '4:3' | '16:9' | '1:1';
  style: 'cctv' | 'phone' | 'polaroid' | 'doc-scan' | 'thermal';
  layers: SceneLayer[];
  hotspots: Hotspot[];
  frames?: VideoFrame[];
  overlay?: { timestamp?: string; channel?: string; battery?: number; geostamp?: string };
  artifacts?: Artifact[];
}
