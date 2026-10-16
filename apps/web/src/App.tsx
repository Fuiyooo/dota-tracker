import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  HERO_IMG_CDN,
  getHeroes,
  getPlayer,
  getPlayerMatches,
  searchPlayers,
  type Hero,
  type PlayerMatch,
} from './api';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function MatchTable({
  matches,
  heroById,
}: {
  matches: PlayerMatch[];
  heroById: Map<number, Hero>;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Hero</th>
            <th className="px-4 py-2 font-medium">Result</th>
            <th className="px-4 py-2 font-medium">K / D / A</th>
            <th className="px-4 py-2 font-medium">GPM</th>
            <th className="px-4 py-2 font-medium">XPM</th>
            <th className="px-4 py-2 font-medium">Duration</th>
            <th className="px-4 py-2 font-medium">Played</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {matches.map((match) => {
            const hero = heroById.get(match.hero_id);
            return (
              <tr key={match.match_id} className="hover:bg-slate-900/60">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    {hero && (
                      <img
                        src={`${HERO_IMG_CDN}${hero.img}`}
                        alt=""
                        className="h-6 w-10 rounded object-cover"
                      />
                    )}
                    <span>{hero?.localized_name ?? `Hero ${match.hero_id}`}</span>
                  </span>
                </td>
                <td
                  className={`px-4 py-2 font-medium ${match.won ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {match.won ? 'Win' : 'Loss'}
                </td>
                <td className="px-4 py-2">
                  {match.kills} / {match.deaths} / {match.assists}
                </td>
                <td className="px-4 py-2">{match.gold_per_min}</td>
                <td className="px-4 py-2">{match.xp_per_min}</td>
                <td className="px-4 py-2">{formatDuration(match.duration)}</td>
                <td className="px-4 py-2 text-slate-400">{formatDate(match.start_time)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function App() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const heroesQuery = useQuery({
    queryKey: ['heroes'],
    queryFn: getHeroes,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const searchQuery = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchPlayers(query),
    enabled: query.trim().length >= 2,
  });

  const profileQuery = useQuery({
    queryKey: ['player', selected],
    queryFn: () => getPlayer(selected as number),
    enabled: selected !== null,
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', selected],
    queryFn: () => getPlayerMatches(selected as number),
    enabled: selected !== null,
  });

  const heroById = new Map((heroesQuery.data ?? []).map((hero) => [hero.hero_id, hero]));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-sky-400">Dota 2 Tracker</h1>
      <p className="mt-1 text-sm text-slate-400">
        Preview — data fetched live from OpenDota through our own client (not from the database
        yet).
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(term);
          setSelected(null);
        }}
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search a player name, e.g. nyen"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500"
        >
          Search
        </button>
      </form>

      {searchQuery.isFetching && <p className="mt-3 text-sm text-slate-400">Searching…</p>}
      {searchQuery.isError && (
        <p className="mt-3 text-sm text-rose-400">
          Search failed: {(searchQuery.error as Error).message}
        </p>
      )}
      {searchQuery.data?.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No results for &quot;{query}&quot;.</p>
      )}

      {searchQuery.data && searchQuery.data.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          {searchQuery.data.map((item) => (
            <li key={item.account_id}>
              <button
                type="button"
                onClick={() => setSelected(item.account_id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-900 ${
                  selected === item.account_id ? 'bg-slate-900' : ''
                }`}
              >
                {item.avatarfull && (
                  <img src={item.avatarfull} alt="" className="h-9 w-9 rounded-full" />
                )}
                <span className="flex-1">
                  <span className="block font-medium">{item.personaname ?? '(no name)'}</span>
                  <span className="block text-xs text-slate-400">
                    account_id {item.account_id}
                  </span>
                </span>
                <span className="text-xs text-slate-500">view →</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {profileQuery.isLoading && <p className="mt-6 text-slate-400">Loading profile…</p>}
      {profileQuery.isError && (
        <p className="mt-6 text-rose-400">{(profileQuery.error as Error).message}</p>
      )}

      {profileQuery.data && (
        <section className="mt-6 flex items-center gap-4 rounded-xl border border-slate-800 p-5">
          {profileQuery.data.avatar && (
            <img src={profileQuery.data.avatar} alt="" className="h-16 w-16 rounded-full" />
          )}
          <div>
            <h2 className="text-xl font-semibold">
              {profileQuery.data.personaname ?? '(no name)'}
            </h2>
            <p className="text-sm text-slate-400">
              <span className="text-amber-300">{profileQuery.data.rank_label}</span>
              {profileQuery.data.computed_mmr !== null &&
                ` · MMR ${Math.round(profileQuery.data.computed_mmr)}`}
              {` · account_id ${profileQuery.data.account_id}`}
            </p>
          </div>
        </section>
      )}

      {matchesQuery.isError && (
        <p className="mt-4 text-rose-400">{(matchesQuery.error as Error).message}</p>
      )}

      {matchesQuery.data && matchesQuery.data.length > 0 && (
        <>
          <h3 className="mt-6 text-lg font-semibold">Recent matches</h3>
          <MatchTable matches={matchesQuery.data} heroById={heroById} />
        </>
      )}
    </div>
  );
}
