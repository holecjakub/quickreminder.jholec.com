import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/fragment-mono/400.css';
import './tokens.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { gsap } from './app/gsap';
import { applyGsapTimeScale } from './app/motionDebug';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

applyGsapTimeScale(gsap);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
