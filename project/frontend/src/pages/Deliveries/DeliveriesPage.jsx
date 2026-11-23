import { useOutletContext } from 'react-router-dom';
import Deliveries from '../../components/Deliveries/Deliveries';

export default function DeliveriesPage() {
  const { state, onOpenCase } = useOutletContext();
  return <Deliveries state={state} onOpenCase={onOpenCase} />;
}
