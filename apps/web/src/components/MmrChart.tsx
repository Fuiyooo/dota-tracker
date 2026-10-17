import { RANK_MEDALS, rankTierLabel } from '@dota/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MmrHistoryEntry } from '../api';

const RANK_TICKS = [10, 20, 30, 40, 50, 60, 70, 80];

function medalName(level: number): string {
  return (RANK_MEDALS as Record<number, string | undefined>)[level / 10] ?? '';
}

interface RankPoint {
  time: number;
  rank: number | null;
}

/**
 * Tooltip khusus supaya sumbu & label menampilkan NAMA rank, bukan angka
 * mentah `rank_tier`.
 */
function RankTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RankPoint }>;
}) {
  if (active !== true) return null;
  const point = payload?.[0]?.payload;
  if (point === undefined || point.rank === null) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-lg">
      <div className="text-slate-400">
        {new Date(point.time).toLocaleDateString('en-US', { dateStyle: 'medium' })}
      </div>
      <div className="mt-1 font-medium text-amber-300">{rankTierLabel(point.rank)}</div>
    </div>
  );
}

/**
 * Histori RANK resmi (Valve).
 *
 * MMR tidak digambar karena Valve tidak mempublikasikannya dan `computed_mmr`
 * OpenDota terbukti tidak cocok dengan medal. Perkiraan MMR dari bracket medal
 * tetap ditampilkan di tooltip sebagai konteks.
 */
export default function MmrChart({ entries }: { entries: MmrHistoryEntry[] }) {
  const data: RankPoint[] = entries.map((entry) => ({
    time: entry.recorded_at * 1000,
    rank: entry.rank_tier,
  }));

  if (data.length < 2) {
    return (
      <p className="mt-2 text-sm text-slate-400">
        Not enough snapshots yet ({data.length}). The scheduler records one snapshot every 30
        minutes, so a trend appears once a few have accumulated.
      </p>
    );
  }

  return (
    <div className="mt-2 h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            interval="preserveStartEnd"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value: number) =>
              new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <YAxis
            domain={[10, 80]}
            ticks={RANK_TICKS}
            width={92}
            tick={{ fill: '#fbbf24', fontSize: 11 }}
            tickFormatter={(value: number) => medalName(value)}
          />
          <Tooltip content={<RankTooltip />} />
          <Line
            type="monotone"
            dataKey="rank"
            name="Rank (Valve, official)"
            stroke="#fbbf24"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
