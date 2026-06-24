import { LodgeScene } from '@/games/lodge/ui/scene/LodgeScene';
import { LodgeHud } from '@/games/lodge/ui/hud/LodgeHud';
import { DevPanel } from './DevPanel';

export default function LodgeDevHarness() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0712' }}>
      <LodgeScene />
      <LodgeHud />
      <DevPanel />
    </div>
  );
}
