// src/games/shadow-trace/archive/media-types.ts
// Self-contained procedural photo media (no Condition/Grant coupling). Photo-only for A0;
// video frames are deferred to Этап A2.
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
  /** Inspecting this hotspot in the UI grants these keys (A1 wires this to grantKey). */
  grantsKeys?: string[];
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
}

export interface MediaSpec {
  kind: 'photo';
  aspect: '4:3' | '16:9' | '1:1';
  style: 'cctv' | 'phone' | 'polaroid' | 'doc-scan' | 'thermal';
  layers: SceneLayer[];
  hotspots: Hotspot[];
  overlay?: { timestamp?: string; channel?: string; battery?: number; geostamp?: string };
  artifacts?: Artifact[];
}
