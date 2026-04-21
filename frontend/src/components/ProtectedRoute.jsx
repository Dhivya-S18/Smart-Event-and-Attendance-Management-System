import { useContext } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to their respective dashboard if they try to access an unauthorized route
        switch (user.role) {
            case "student":
                return <Navigate to="/student" replace />;
            case "staff":
                return <Navigate to="/staff" replace />;
            case "hod":
                return <Navigate to="/hod" replace />;
            case "admin":
                return <Navigate to="/admin" replace />;
            default:
                return <Navigate to="/login" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
