import { useOutletContext } from 'react-router-dom';
import RequestsManagement from '../../components/Requests/RequestsManagement';

export default function RequestsPage() {
  const { state, onOpenCase } = useOutletContext();
  return <RequestsManagement state={state} onOpenCase={onOpenCase} />;
}
