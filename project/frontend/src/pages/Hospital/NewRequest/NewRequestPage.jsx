import { useOutletContext } from 'react-router-dom';
import NewRequest from '../../../components/Hospital/NewRequest/NewRequest';

export default function NewRequestPage() {
  const context = useOutletContext();
  return <NewRequest {...context} />;
}
