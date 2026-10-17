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
    <div className="text-right text-xs text-slate-500">
      {status === undefined ? (
        <div>{statusQuery.isError ? 'API offline' : 'Checking API…'}</div>
      ) : (
        <>
          <div>
            OpenDota: {status.opendota.used}/{status.opendota.limit} requests today
          </div>
          <div>
            Cache: {status.cacheSize} entries · {status.tracked_players.length} tracked
          </div>
        </>
      )}
    </div>
  );
}
