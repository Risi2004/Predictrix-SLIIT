import { useOutletContext } from 'react-router-dom';
import Reports from '../../components/Reports/Reports';

export default function ReportsPage() {
  const { state } = useOutletContext();
  return <Reports state={state} />;
}
