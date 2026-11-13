import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'driver') return <Navigate to="/driver" replace />;
  if (user?.role === 'individual_owner' || user?.role === 'fleet_company') return <Navigate to="/fleet/tracking" replace />;
  if (user?.role === 'admin') return <main className="p-8">Administration access is reserved for approved platform administrators.</main>;
  return <Navigate to="/passenger" replace />;
}
