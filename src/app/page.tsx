import { Suspense } from 'react';
import GameLoader from '@/components/GameLoader';

export default function Home() {
  return (
    <main style={{ margin: 0, padding: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Suspense fallback={null}>
        <GameLoader />
      </Suspense>
    </main>
  );
}
