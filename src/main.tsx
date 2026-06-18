import { createRoot } from 'react-dom/client';
import { bootstrapApp } from './app/bootstrap';
import { AppProviders } from './app/providers';
import './styles/tokens.css';
import './styles/global.css';

// StrictMode is intentionally omitted: its double-invoke of effects would
// mount/unmount the Phaser canvas twice on every launch. GameCanvasWrapper still
// cleans up correctly; this just keeps the canvas stable in dev.
const root = createRoot(document.getElementById('root')!);

void bootstrapApp().then(() => {
  root.render(<AppProviders />);
});
