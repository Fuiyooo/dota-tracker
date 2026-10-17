import { useQuery } from '@tanstack/react-query';
import { getSyncStatus } from '../api';

export default function StatusBar() {
  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: 60_000,
  });

  const status = statusQuery.data;

  return (
    <div className="text-left text-[11px] text-slate-500 sm:text-right sm:text-xs">
      {status === undefined ? (
        <div>{statusQuery.isError ? 'API offline' : 'Checking API…'}</div>
      ) : (
        <>
          {/* Layar kecil: satu baris ringkas. */}
          <div className="sm:hidden">
            OpenDota {status.opendota.used}/{status.opendota.limit} · cache {status.cacheSize} ·{' '}
            {status.tracked_players.length} tracked
          </div>
          {/* Layar lebar: dua baris. */}
          <div className="hidden sm:block">
            <div>
              OpenDota: {status.opendota.used}/{status.opendota.limit} requests today
            </div>
            <div>
              Cache: {status.cacheSize} entries · {status.tracked_players.length} tracked
            </div>
          </div>
        </>
      )}
    </div>
  );
}
