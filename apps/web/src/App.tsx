import { Link, Route, Routes } from 'react-router-dom';
import StatusBar from './components/StatusBar';
import HeroPoolPage from './pages/HeroPoolPage';
import PlayerPage from './pages/PlayerPage';
import SearchPage from './pages/SearchPage';

export default function App() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <Link to="/" className="text-2xl font-bold text-sky-400">
          Dota 2 Tracker
        </Link>
        <StatusBar />
      </header>

      <main className="mt-6">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/players/:accountId" element={<PlayerPage />} />
          <Route path="/players/:accountId/heroes" element={<HeroPoolPage />} />
          <Route
            path="*"
            element={
              <p className="text-slate-400">
                Page not found.{' '}
                <Link to="/" className="text-sky-400">
                  Back to search
                </Link>
                .
              </p>
            }
          />
        </Routes>
      </main>

      <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-500">
        Data: OpenDota &amp; STRATZ · personal use only
      </footer>
    </div>
  );
}
