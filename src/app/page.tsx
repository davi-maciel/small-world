import graphData from '@/data/graph.json';
import { App } from '@/components/App';

export default function Page() {
  return <App data={graphData as any} />;
}
