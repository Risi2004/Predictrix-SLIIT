import { useOutletContext } from 'react-router-dom';
import InventoryManagement from '../../components/Inventory/InventoryManagement';

export default function InventoryPage() {
  const { state, onApproveMove, onDismissMove } = useOutletContext();
  return <InventoryManagement state={state} onApproveMove={onApproveMove} onDismissMove={onDismissMove} />;
}
