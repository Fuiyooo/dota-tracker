import { rankTierLabel } from '@dota/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  HERO_IMG_CDN,
  getHeroes,
  getMatchDetail,
  type Hero,
  type ItemRef,
  type MatchDetailPlayer,
} from '../api';
import { ErrorBox, Loading } from '../components/Feedback';
import { formatDate, formatDuration } from '../format';

/** Ikon item memakai CDN Steam yang sama dengan hero. */
function ItemIcon({ item }: { item: ItemRef }) {
  if (item.img === null) return null;
  const label = item.dname ?? item.name;
  return (
    <img
      src={`${HERO_IMG_CDN}${item.img}`}
      alt={label}
      title={item.cost !== null && item.cost > 0 ? `${label} · ${item.cost}g` : label}
      className="h-5 w-7 rounded-sm bg-slate-800 object-cover"
    />
  );
}

function ItemRow({ player }: { player: MatchDetailPlayer }) {
  const all = player.neutral === null ? player.items : [...player.items, player.neutral];
  if (all.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {all.map((item) => (
        <ItemIcon key={`${item.id}-${item.name}`} item={item} />
      ))}
    </span>
  );
}

function PlayerName({ player }: { player: MatchDetailPlayer }) {
  if (player.account_id === null) {
    return (
      <span className="text-slate-500" title="Profil privat">
        Private player
      </span>
    );
  }

  return (
    <Link
      to={`/players/${player.account_id}`}
      className="hover:text-sky-400"
      title={`account_id ${player.account_id}`}
    >
      {player.personaname ?? `account ${player.account_id}`}
    </Link>
  );
}

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

      {/* Layar kecil: kartu per pemain. */}
      <ul className="mt-2 divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 md:hidden">
        {players.map((player) => {
          const hero = heroById.get(player.hero_id);
          const highlighted = highlightId !== null && player.account_id === highlightId;
          return (
            <li
              key={player.player_slot}
              className={`px-3 py-2 ${highlighted ? 'bg-sky-950/40' : ''}`}
            >
              <div className="flex items-center gap-3">
                {hero ? (
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
                    {hero?.localized_name ?? `Hero ${player.hero_id}`}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    <PlayerName player={player} />
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="text-slate-300">
                    {player.kills}/{player.deaths}/{player.assists}
                  </div>
                  <div className="text-slate-500">
                    {player.gold_per_min} GPM · {player.net_worth ?? '–'} NW
                  </div>
                </div>
              </div>
              {player.items.length > 0 && (
                <div className="mt-1.5">
                  <ItemRow player={player} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Layar lebar: tabel. */}
      <div className="mt-2 hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
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
              <th className="px-3 py-2 font-medium">Items</th>
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
                    <PlayerName player={player} />
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
                  <td className="px-3 py-2">
                    <ItemRow player={player} />
                  </td>
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
          <section className="mt-4 rounded-xl border border-slate-800 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {match.mode}
              </span>
              <h1 className="text-2xl font-semibold">
                <span className="text-emerald-400">{match.radiant_score ?? '–'}</span>
                <span className="mx-2 text-slate-500">–</span>
                <span className="text-rose-400">{match.dire_score ?? '–'}</span>
              </h1>
              <span className="text-sm text-slate-400">{formatDuration(match.duration)}</span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {formatDate(match.start_time)}
              {` · winner: ${match.radiant_win ? 'Radiant' : 'Dire'}`}
              {match.average_rank !== null && ` · avg rank ${rankTierLabel(match.average_rank)}`}
              {` · match_id ${match.match_id}`}
            </p>
          </section>

          {match.picks.length > 0 && (
            <section className="mt-4 rounded-xl border border-slate-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Draft order
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pick order as recorded by Valve (bans are not shown).
              </p>
              <ol className="mt-2 flex flex-wrap gap-2">
                {match.picks.map((pick, index) => {
                  const hero = heroById.get(pick.hero_id);
                  return (
                    <li
                      key={`${pick.order}-${pick.hero_id}`}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                        pick.team === 0 ? 'border-emerald-900' : 'border-rose-900'
                      }`}
                    >
                      <span className="text-[10px] tabular-nums text-slate-500">{index + 1}</span>
                      {hero && (
                        <img
                          src={`${HERO_IMG_CDN}${hero.img}`}
                          alt=""
                          className="h-6 w-10 rounded object-cover"
                        />
                      )}
                      <span className="text-xs">
                        {hero?.localized_name ?? `Hero ${pick.hero_id}`}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          pick.team === 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pick.team === 0 ? 'R' : 'D'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

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
