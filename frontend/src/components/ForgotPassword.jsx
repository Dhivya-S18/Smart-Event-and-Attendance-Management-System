import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import "./Login.css"; // Reuse login styles

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);

        try {
            const { data } = await API.post("/users/forgot-password", { email });
            // For this mockup, we expose the debug token so the user can actually test it
            setMessage(`Reset link sent! (Mock Mode: Copy this token to use: ${data.debugToken})`);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to send reset link.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Forgot Password</h2>
                <p style={{ marginBottom: '1rem', color: '#666' }}>Enter your email to receive a password reset link. (Only applicable for Students and Staff).</p>

                {message && <div className="message success" style={{ wordBreak: 'break-all' }}>{message}</div>}
                {error && <div className="message error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <Link to="/login" style={{ color: '#007bff' }}>Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
