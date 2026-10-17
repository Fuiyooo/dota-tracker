import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSyncStatus, searchPlayers, trackPlayer, type SearchResult } from '../api';
import { ErrorBox, Loading } from '../components/Feedback';

export default function SearchPage() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const trackedQuery = useQuery({ queryKey: ['sync-status'], queryFn: getSyncStatus });

  const searchQuery = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchPlayers(query),
    enabled: query.trim().length >= 2,
  });

  const track = useMutation({
    mutationFn: (result: SearchResult) => trackPlayer(String(result.account_id), 20),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      const accountId = data.player?.account_id;
      if (accountId !== undefined) navigate(`/players/${accountId}`);
    },
  });

  const tracked = trackedQuery.data?.tracked_players ?? [];
  const firstResult = searchQuery.data?.[0];

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(term.trim());
        }}
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, account_id, SteamID64, or Steam URL"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium hover:bg-sky-500"
        >
          Search
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-500">
        Accepts a player name, account_id (e.g. 1061259054), SteamID64, or a
        steamcommunity.com profile URL.
      </p>

      {tracked.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tracked players
          </h2>
          <ul className="mt-2 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
            {tracked.map((player) => (
              <li key={player.account_id}>
                <Link
                  to={`/players/${player.account_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-900"
                >
                  {player.avatar && (
                    <img src={player.avatar} alt="" className="h-8 w-8 rounded-full" />
                  )}
                  <span className="flex-1">
                    <span className="block font-medium">{player.personaname ?? '(no name)'}</span>
                    <span className="block text-xs text-slate-400">
                      account_id {player.account_id}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">view →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {searchQuery.isFetching && <Loading label="Searching…" />}
      {searchQuery.isError && <ErrorBox error={searchQuery.error} />}
      {track.isError && <ErrorBox error={track.error} />}
      {searchQuery.data?.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">No results for &quot;{query}&quot;.</p>
      )}

      {searchQuery.data && searchQuery.data.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Results
            {firstResult?.resolved_from !== undefined &&
              firstResult.resolved_from !== 'name' &&
              ` (resolved from ${firstResult.resolved_from})`}
          </h2>

          <ul className="mt-2 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
            {searchQuery.data.map((result) => (
              <li key={result.account_id} className="flex items-center gap-3 px-4 py-3">
                {result.avatarfull && (
                  <img src={result.avatarfull} alt="" className="h-9 w-9 rounded-full" />
                )}
                <Link to={`/players/${result.account_id}`} className="flex-1 hover:text-sky-400">
                  <span className="block font-medium">{result.personaname ?? '(no name)'}</span>
                  <span className="block text-xs text-slate-400">
                    account_id {result.account_id}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={track.isPending}
                  onClick={() => track.mutate(result)}
                  className="rounded-lg border border-sky-700 px-3 py-1.5 text-sm text-sky-300 hover:bg-sky-950 disabled:opacity-50"
                >
                  {track.isPending && track.variables?.account_id === result.account_id
                    ? 'Tracking…'
                    : 'Track'}
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-slate-500">
            Tracking fetches the profile plus the latest 20 matches; it can take ~15 seconds.
          </p>
        </section>
      )}
    </div>
  );
}
