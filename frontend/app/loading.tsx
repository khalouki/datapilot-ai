import { LoadingState } from '@/components/loading/Loading';
export default function Loading() {
  return (
    <main>
      <LoadingState kind="overview" label="Loading your workspace…" />
      <LoadingState kind="table" announce={false} />
    </main>
  );
}
