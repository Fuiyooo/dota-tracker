import { RANK_MEDALS } from '@dota/shared';
import {
  CartesianGrid,
  Legend,
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

/**
 * Dua seri dengan sumbu terpisah:
 * - MMR (biru, garis putus-putus) = PERKIRAAN OpenDota (`computed_mmr`), bukan MMR resmi.
 * - Rank (kuning) = resmi dari Valve (`rank_tier`), diskalakan 10..80.
 */
export default function MmrChart({ entries }: { entries: MmrHistoryEntry[] }) {
  if (entries.length < 2) {
    return (
      <p className="mt-2 text-sm text-slate-400">
        Not enough snapshots yet ({entries.length}). The scheduler records one snapshot every 30
        minutes, so a trend appears once a few have accumulated.
      </p>
    );
  }

  const data = entries.map((entry) => ({
    time: entry.recorded_at * 1000,
    mmr: entry.computed_mmr,
    rank: entry.rank_tier,
  }));

  return (
    <div className="mt-2 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value: number) =>
              new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <YAxis yAxisId="mmr" tick={{ fill: '#38bdf8', fontSize: 11 }} width={48} />
          <YAxis
            yAxisId="rank"
            orientation="right"
            domain={[10, 80]}
            ticks={RANK_TICKS}
            width={90}
            tick={{ fill: '#fbbf24', fontSize: 11 }}
            tickFormatter={(value: number) => medalName(value)}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="mmr"
            type="monotone"
            dataKey="mmr"
            name="MMR (estimate)"
            stroke="#38bdf8"
            strokeDasharray="5 4"
            connectNulls
          />
          <Line
            yAxisId="rank"
            type="monotone"
            dataKey="rank"
            name="Rank (Valve)"
            stroke="#fbbf24"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
