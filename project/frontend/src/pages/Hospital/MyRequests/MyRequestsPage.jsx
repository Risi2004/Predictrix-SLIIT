import { useOutletContext } from 'react-router-dom';
import MyRequests from '../../../components/Hospital/MyRequests/MyRequests';

export default function MyRequestsPage() {
  const context = useOutletContext();
  return <MyRequests {...context} />;
}
