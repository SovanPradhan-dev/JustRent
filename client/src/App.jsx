import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/public/HomePage.jsx';
import AuthPage from './pages/public/AuthPage.jsx';
import AboutPage from './pages/public/InfoPage.jsx';
import DashboardRouter from './pages/DashboardRouter.jsx';
import FleetTrackingPage from './pages/fleet/FleetTrackingPage.jsx';
import FleetVehiclesPage from './pages/fleet/FleetVehiclesPage.jsx';
import DriverPage from './pages/driver/DriverPage.jsx';
import PassengerTrackingPage from './pages/passenger/PassengerTrackingPage.jsx';
import PassengerDashboard from './pages/passenger/PassengerDashboard.jsx';
import PassengerSearchPage from './pages/passenger/PassengerSearchPage.jsx';
import FleetBookingsPage from './pages/fleet/FleetBookingsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/how-it-works" element={<AboutPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
      </Route>
      <Route element={<ProtectedRoute roles={['individual_owner', 'fleet_company']} />}>
        <Route path="/fleet/tracking" element={<FleetTrackingPage />} />
        <Route path="/fleet/vehicles" element={<FleetVehiclesPage />} />
        <Route path="/fleet/bookings" element={<FleetBookingsPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['driver']} />}>
        <Route path="/driver" element={<DriverPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={['passenger']} />}>
        <Route path="/passenger" element={<PassengerDashboard />} />
        <Route path="/passenger/search" element={<PassengerSearchPage />} />
        <Route path="/passenger/tracking/:bookingId" element={<PassengerTrackingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
