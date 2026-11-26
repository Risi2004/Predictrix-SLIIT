import { useOutletContext } from 'react-router-dom';
import CommandCentre from '../../components/CommandCentre/CommandCentre';

export default function CommandCentrePage() {
  const { state, onNavigate, onOpenCase, onApproveRequest } = useOutletContext();
  return <CommandCentre state={state} onNavigate={onNavigate} onOpenCase={onOpenCase} onApprove={onApproveRequest} />;
}
