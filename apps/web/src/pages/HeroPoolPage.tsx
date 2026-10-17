import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HERO_IMG_CDN, getPlayerHeroes } from '../api';
import { ErrorBox, Loading } from '../components/Feedback';
import { formatPercent } from '../format';

type SortKey = 'name' | 'games' | 'wins' | 'winrate';

export default function HeroPoolPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = Number(params.accountId);
  const validId = Number.isFinite(accountId) && accountId > 0;

  const [sortKey, setSortKey] = useState<SortKey>('games');
  const [descending, setDescending] = useState(true);

  const heroesQuery = useQuery({
    queryKey: ['player-heroes', accountId],
    queryFn: () => getPlayerHeroes(accountId),
    enabled: validId,
  });

  const sorted = useMemo(() => {
    const rows = [...(heroesQuery.data?.heroes ?? [])];
    rows.sort((a, b) => {
      let diff: number;
      if (sortKey === 'name') {
        diff = (a.localized_name ?? '').localeCompare(b.localized_name ?? '');
      } else {
        diff = a[sortKey] - b[sortKey];
      }
      return descending ? -diff : diff;
    });
    return rows;
  }, [heroesQuery.data, sortKey, descending]);

  function changeSort(key: SortKey) {
    if (key === sortKey) {
      setDescending((current) => !current);
    } else {
      setSortKey(key);
      setDescending(key !== 'name');
    }
  }

  function header(label: string, key: SortKey) {
    const active = key === sortKey;
    return (
      <th className="px-4 py-2 font-medium">
        <button
          type="button"
          onClick={() => changeSort(key)}
          className={active ? 'text-sky-400' : 'hover:text-slate-200'}
        >
          {label}
          {active && (descending ? ' ↓' : ' ↑')}
        </button>
      </th>
    );
  }

  function winrateBar(winrate: number) {
    return (
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800 sm:w-24">
          <span
            className={`block h-full ${winrate >= 0.5 ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ width: `${Math.round(winrate * 100)}%` }}
          />
        </span>
        <span className="shrink-0 tabular-nums">{formatPercent(winrate)}</span>
      </span>
    );
  }

  if (!validId) return <p className="text-rose-400">Invalid account id.</p>;

  const games = heroesQuery.data?.synced_matches ?? 0;

  return (
    <div>
      <Link to={`/players/${accountId}`} className="text-sm text-slate-400 hover:text-slate-200">
        ← Back to profile
      </Link>

      <h1 className="mt-4 text-xl font-semibold">Hero pool</h1>
      <p className="text-sm text-slate-400">{games} synced matches</p>

      {heroesQuery.isLoading && <Loading label="Loading hero stats…" />}
      {heroesQuery.isError && <ErrorBox error={heroesQuery.error} />}

      {heroesQuery.data !== undefined && sorted.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No hero data yet. Sync some matches first.</p>
      )}

      {sorted.length > 0 && (
        <>
          {/* Layar kecil: pilih urutan lewat dropdown, data sebagai kartu. */}
          <div className="mt-3 flex items-center gap-2 text-sm md:hidden">
            <label className="flex flex-1 items-center gap-2 text-slate-400">
              <span className="shrink-0">Sort</span>
              <select
                value={sortKey}
                onChange={(event) => {
                  const key = event.target.value as SortKey;
                  setSortKey(key);
                  setDescending(key !== 'name');
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
              >
                <option value="games">Games</option>
                <option value="wins">Wins</option>
                <option value="winrate">Winrate</option>
                <option value="name">Name</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setDescending((current) => !current)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300"
              aria-label={descending ? 'Descending' : 'Ascending'}
            >
              {descending ? '↓' : '↑'}
            </button>
          </div>

          <ul className="mt-2 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 md:hidden">
            {sorted.map((hero) => (
              <li key={hero.hero_id} className="flex items-center gap-3 px-3 py-2">
                {hero.img ? (
                  <img
                    src={`${HERO_IMG_CDN}${hero.img}`}
                    alt=""
                    className="h-8 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="h-8 w-14 shrink-0 rounded bg-slate-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {hero.localized_name ?? `Hero ${hero.hero_id}`}
                  </div>
                  <div className="text-xs text-slate-400">
                    {hero.games}g · {hero.wins}W
                  </div>
                </div>
                <div className="w-28 shrink-0 text-xs">{winrateBar(hero.winrate)}</div>
              </li>
            ))}
          </ul>

          {/* Layar lebar: tabel sortable. */}
          <section className="mt-3 hidden overflow-hidden rounded-xl border border-slate-800 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-slate-400">
                <tr>
                  {header('Hero', 'name')}
                  {header('Games', 'games')}
                  {header('Wins', 'wins')}
                  {header('Winrate', 'winrate')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sorted.map((hero) => (
                  <tr key={hero.hero_id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        {hero.img && (
                          <img
                            src={`${HERO_IMG_CDN}${hero.img}`}
                            alt=""
                            className="h-6 w-10 rounded object-cover"
                          />
                        )}
                        <span>{hero.localized_name ?? `Hero ${hero.hero_id}`}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2">{hero.games}</td>
                    <td className="px-4 py-2">{hero.wins}</td>
                    <td className="px-4 py-2">{winrateBar(hero.winrate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
