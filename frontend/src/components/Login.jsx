import { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import "./Login.css";

const Login = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialRole = queryParams.get("role") || "student";

    const [role, setRole] = useState(initialRole);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (initialRole) {
            setRole(initialRole);
        }
    }, [initialRole]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        // Pass the explicitly selected role
        const result = await login(email, password, role);

        if (result.success) {
            switch (result.role) {
                case "student":
                    navigate("/student");
                    break;
                case "staff":
                    navigate("/staff");
                    break;
                case "hod":
                    navigate("/hod");
                    break;
                case "admin":
                    navigate("/admin");
                    break;
                default:
                    navigate("/");
            }
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>Club Event Management</h2>
                <p>Login to your account</p>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Select Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            <option value="student">Student</option>
                            <option value="staff">Staff</option>
                            <option value="hod">HOD</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Email ID</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-btn">Login</button>
                    {(role === "student" || role === "staff") && (
                        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                            <a href="/forgot-password" style={{ color: '#007bff', fontSize: '0.9rem', textDecoration: 'none' }}>Forgot Password?</a>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default Login;
