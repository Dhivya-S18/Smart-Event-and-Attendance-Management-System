import { createContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const decodedUser = jwtDecode(token);
                setUser(decodedUser);
            } catch (error) {
                console.error("Invalid token:", error);
                localStorage.removeItem("token");
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password, role) => {
        try {
            // use auth route which returns a token containing both id and role
            const { data } = await API.post("/auth/login", { email, password, role });
            localStorage.setItem("token", data.token);
            const decodedUser = jwtDecode(data.token);
            setUser(decodedUser);
            return { success: true, role: decodedUser.role };
        } catch (error) {
            console.error("Login failed", error)
            return { success: false, message: error.response?.data?.message || "Login failed" };
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
