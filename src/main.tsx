import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { handleChunkPreloadError, scheduleChunkReloadReset } from './lib/auth/chunkReload'
import './index.css'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  handleChunkPreloadError(sessionStorage, () => window.location.reload(), () => {
    const root = document.getElementById('root');
    if (!root) return;
    root.replaceChildren();
    const box = document.createElement('div');
    box.dir = 'rtl';
    box.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;font-family:sans-serif';
    const title = document.createElement('h1');
    title.textContent = 'הגרסה החדשה לא נטענה';
    const text = document.createElement('p');
    text.textContent = 'רעננו את האפליקציה כדי לטעון את הקבצים המעודכנים.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'רענון';
    button.onclick = () => window.location.reload();
    box.append(title, text, button);
    root.append(box);
  });
});

scheduleChunkReloadReset(sessionStorage);

createRoot(document.getElementById("root")!).render(<App />);
