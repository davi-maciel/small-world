import graphData from '@/data/graph.json';
import teachingData from '@/data/teaching.json';
import { App } from '@/components/App';

export default function Page() {
  return <App data={graphData as any} teachingData={teachingData as any} />;
}
