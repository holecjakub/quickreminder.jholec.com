import { HERO_COPY } from './app/choreography/copy';
import { Nav } from './app/Nav';
import { ScrollProgress } from './app/ScrollProgress';
import { Download } from './app/sections/Download';
import { Features } from './app/sections/Features';
import { Footer } from './app/sections/Footer';
import { Integrations } from './app/sections/Integrations';
import { Stage } from './app/Stage';

/** The landing page: progress bar, floating nav, the pinned stage with the features, then the static sections. */
export default function App(): JSX.Element {
  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>
        <Stage title={HERO_COPY.title} subtitle={HERO_COPY.subtitle}>
          <Features />
        </Stage>
        <Integrations />
        <Download />
      </main>
      <Footer />
    </>
  );
}
