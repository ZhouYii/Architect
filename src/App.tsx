import './styles/globals.css';
import { Canvas } from './modules/canvas/index.js';
import { Toolbar, SidePanel } from './modules/ui/index.js';

export function App() {
  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-body">
        <div className="app-canvas">
          <Canvas />
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
