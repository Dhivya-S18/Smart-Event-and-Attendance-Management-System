import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    // always show brand; if no user show a login button
    if (!user) {
        return (
            <nav className="navbar">
                <div className="navbar-brand">
                    <Link to="/">Club Event CMS</Link>
                </div>
                <div className="navbar-menu">
                    <Link to="/login" className="login-link">Login</Link>
                </div>
            </nav>
        );
    }

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Club Event CMS</Link>
            </div>
            <div className="navbar-links">
                {user.role === 'admin' && <Link to="/admin">Admin Desk</Link>}
                {user.role === 'hod' && <Link to="/hod">HOD Desk</Link>}
                {user.role === 'staff' && <Link to="/staff">Staff Desk</Link>}
                {user.role === 'student' && <Link to="/student">Student Desk</Link>}
                {(user.role === 'hod' || user.role === 'staff' || user.role === 'student') && <Link to="/completed-events">Completed Events</Link>}
            </div>
            <div className="navbar-menu">
                <span className="user-role">{user.role ? user.role.toUpperCase() : 'USER'}</span>
                <button onClick={logout} className="logout-btn">
                    Logout
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
