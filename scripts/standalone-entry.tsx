import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ArcadeHub from '@/components/ArcadeHub';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ArcadeHub />
    </StrictMode>
  );
}
