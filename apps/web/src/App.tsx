import { Link, Route, Routes } from 'react-router-dom';
import StatusBar from './components/StatusBar';
import HeroPoolPage from './pages/HeroPoolPage';
import MatchPage from './pages/MatchPage';
import PlayerPage from './pages/PlayerPage';
import SearchPage from './pages/SearchPage';

export default function App() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <Link to="/" className="text-xl font-bold text-sky-400 sm:text-2xl">
          Dota 2 Tracker
        </Link>
        <StatusBar />
      </header>

      <main className="mt-5 sm:mt-6">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/players/:accountId" element={<PlayerPage />} />
          <Route path="/players/:accountId/heroes" element={<HeroPoolPage />} />
          <Route path="/matches/:matchId" element={<MatchPage />} />
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

      <footer className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:mt-10">
        Data: OpenDota &amp; STRATZ · personal use only
      </footer>
    </div>
  );
}
