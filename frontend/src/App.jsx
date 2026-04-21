import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import Students from "./pages/Students";
import Staff from "./pages/Staff";
import HOD from "./pages/HOD";
import Admin from "./pages/Admin";
import EventReport from "./pages/EventReport";
import CompletedEvents from "./pages/CompletedEvents";
import PublicEvents from "./pages/PublicEvents";
import Register from "./pages/Register";
import "./App.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <div className="main-content">
          <Routes>
            {/* React handles only sub-routes; legacy index.html handles / */}
            <Route path="/event/register/:eventId" element={<Register />} />
            <Route path="/event/report/:eventId" element={<EventReport />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/student" element={<Students />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/hod" element={<HOD />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/completed-events" element={<CompletedEvents />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
