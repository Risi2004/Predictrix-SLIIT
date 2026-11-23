import { useOutletContext } from 'react-router-dom';
import DonorManagement from '../../components/Donors/DonorManagement';

export default function DonorsPage() {
  const { state, onApproveCampaign, onCancelCampaign, onPrepareCampaign } = useOutletContext();
  return (
    <DonorManagement
      state={state}
      onApproveCampaign={onApproveCampaign}
      onCancelCampaign={onCancelCampaign}
      onPrepareCampaign={onPrepareCampaign}
    />
  );
}
