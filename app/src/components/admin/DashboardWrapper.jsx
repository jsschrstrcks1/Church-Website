import { useMemberAuth } from '../../context/MemberAuthContext';
import Dashboard from './Dashboard';

const DashboardWrapper = () => {
  const { memberProfile } = useMemberAuth();
  return <Dashboard memberProfile={memberProfile} />;
};

export default DashboardWrapper;
