import { useOutletContext } from 'react-router-dom';
import ActivityLog from '../../components/ActivityLog/ActivityLog';

export default function ActivityLogPage() {
  const { state, onOpenCase } = useOutletContext();
  return <ActivityLog state={state} onOpenCase={onOpenCase} />;
}
