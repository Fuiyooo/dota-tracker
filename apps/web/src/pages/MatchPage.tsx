import { rankTierLabel } from '@dota/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { HERO_IMG_CDN, getHeroes, getMatchDetail, type Hero, type MatchDetailPlayer } from '../api';
import { ErrorBox, Loading } from '../components/Feedback';
import { formatDate, formatDuration } from '../format';

function Roster({
  title,
  won,
  players,
  heroById,
  highlightId,
}: {
  title: string;
  won: boolean;
  players: MatchDetailPlayer[];
  heroById: Map<number, Hero>;
  highlightId: number | null;
}) {
  return (
    <section className="mt-4">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide">
        <span className={won ? 'text-emerald-400' : 'text-rose-400'}>{title}</span>
        <span className="text-xs font-normal normal-case text-slate-500">
          {won ? 'Victory' : 'Defeat'}
        </span>
      </h2>

      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Hero</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">K / D / A</th>
              <th className="px-3 py-2 font-medium">GPM</th>
              <th className="px-3 py-2 font-medium">XPM</th>
              <th className="px-3 py-2 font-medium">LH / DN</th>
              <th className="px-3 py-2 font-medium">Net worth</th>
              <th className="px-3 py-2 font-medium">Lvl</th>
              <th className="px-3 py-2 font-medium">Hero dmg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {players.map((player) => {
              const hero = heroById.get(player.hero_id);
              const highlighted = highlightId !== null && player.account_id === highlightId;
              return (
                <tr
                  key={player.player_slot}
                  className={highlighted ? 'bg-sky-950/40' : 'hover:bg-slate-900/60'}
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {hero && (
                        <img
                          src={`${HERO_IMG_CDN}${hero.img}`}
                          alt=""
                          className="h-6 w-10 rounded object-cover"
                        />
                      )}
                      <span>{hero?.localized_name ?? `Hero ${player.hero_id}`}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {player.account_id !== null ? (
                      <Link
                        to={`/players/${player.account_id}`}
                        className="hover:text-sky-400"
                        title={`account_id ${player.account_id}`}
                      >
                        {player.personaname ?? `account ${player.account_id}`}
                      </Link>
                    ) : (
                      <span className="text-slate-500" title="Profil privat">
                        Private player
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {player.kills} / {player.deaths} / {player.assists}
                  </td>
                  <td className="px-3 py-2">{player.gold_per_min}</td>
                  <td className="px-3 py-2">{player.xp_per_min}</td>
                  <td className="px-3 py-2">
                    {player.last_hits} / {player.denies ?? '–'}
                  </td>
                  <td className="px-3 py-2">{player.net_worth ?? '–'}</td>
                  <td className="px-3 py-2">{player.level ?? '–'}</td>
                  <td className="px-3 py-2">{player.hero_damage}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MatchPage() {
  const params = useParams<{ matchId: string }>();
  const [searchParams] = useSearchParams();

  const matchId = Number(params.matchId);
  const validId = Number.isFinite(matchId) && matchId > 0;

  const rawHighlight = Number(searchParams.get('accountId'));
  const highlightId = Number.isFinite(rawHighlight) && rawHighlight > 0 ? rawHighlight : null;

  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchDetail(matchId),
    enabled: validId,
  });

  const heroesQuery = useQuery({
    queryKey: ['heroes'],
    queryFn: getHeroes,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!validId) return <p className="text-rose-400">Invalid match id.</p>;

  const match = matchQuery.data;
  const heroById = new Map<number, Hero>(
    (heroesQuery.data ?? []).map((hero) => [hero.hero_id, hero]),
  );

  return (
    <div>
      <Link
        to={highlightId !== null ? `/players/${highlightId}` : '/'}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Back
      </Link>

      {matchQuery.isLoading && <Loading label="Loading match…" />}
      {matchQuery.isError && <ErrorBox error={matchQuery.error} />}

      {match !== undefined && (
        <>
          <section className="mt-4 rounded-xl border border-slate-800 p-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {match.mode}
              </span>
              <h1 className="text-xl font-semibold">
                <span className="text-emerald-400">{match.radiant_score ?? '–'}</span>
                <span className="mx-2 text-slate-500">–</span>
                <span className="text-rose-400">{match.dire_score ?? '–'}</span>
              </h1>
              <span className="text-sm text-slate-400">{formatDuration(match.duration)}</span>
              <span className="text-sm text-slate-400">{formatDate(match.start_time)}</span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              match_id {match.match_id}
              {` · winner: ${match.radiant_win ? 'Radiant' : 'Dire'}`}
              {match.average_rank !== null && ` · avg rank ${rankTierLabel(match.average_rank)}`}
            </p>
          </section>

          <Roster
            title="Radiant"
            won={match.radiant_win}
            players={match.players.filter((player) => player.is_radiant)}
            heroById={heroById}
            highlightId={highlightId}
          />
          <Roster
            title="Dire"
            won={!match.radiant_win}
            players={match.players.filter((player) => !player.is_radiant)}
            heroById={heroById}
            highlightId={highlightId}
          />
        </>
      )}
    </div>
  );
}
