const API_URL = "https://smart-event-and-attendance-management.onrender.com/api";

const auth = {
  login: async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Store ALL organizations
        const orgs = data.organizations || [];
        localStorage.setItem("organizations", JSON.stringify(orgs));

        // Auto-select first org if not selected yet, or re-select if previous choice is invalid
        const prevSelected = auth.getSelectedOrg();
        const validSelection = orgs.find(o => o.id === prevSelected?.id);
        if (!validSelection && orgs.length > 0) {
          localStorage.setItem("selectedOrg", JSON.stringify(orgs[0]));
        }

        return { success: true, role: data.role, organizations: orgs };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: "Connection error" };
    }
  },

  logout: () => {
    localStorage.clear();
    window.location.href = "/login.html";
  },

  getToken: () => localStorage.getItem("token"),
  getRole: () => localStorage.getItem("role"),
  getUser: () => JSON.parse(localStorage.getItem("user")),
  isLoggedIn: () => !!localStorage.getItem("token"),

  // Multi-org helpers
  getOrganizations: () => JSON.parse(localStorage.getItem("organizations") || "[]"),
  getSelectedOrg: () => JSON.parse(localStorage.getItem("selectedOrg") || "null"),
  setSelectedOrg: (org) => {
    localStorage.setItem("selectedOrg", JSON.stringify(org));
    // Also update user's clubId/clubName for backward compat
    const user = auth.getUser();
    if (user) {
      user.clubId = org.id;
      user.clubName = org.name;
      localStorage.setItem("user", JSON.stringify(user));
    }
  },

  // Returns the active org ID for API calls
  getActiveOrgId: () => {
    const selected = auth.getSelectedOrg();
    if (selected) return selected.id;
    const user = auth.getUser();
    return user?.clubId || null;
  },

  checkAccess: (allowedRoles) => {
    const role = localStorage.getItem("role");
    if (!role || !allowedRoles.includes(role)) {
      window.location.href = "/login.html";
    }
  },

  compareIds: (id1, id2) => {
    if (!id1 || !id2) return false;
    const finalId1 = (typeof id1 === 'object') ? (id1._id || id1.id) : id1;
    const finalId2 = (typeof id2 === 'object') ? (id2._id || id2.id) : id2;
    return String(finalId1) === String(finalId2);
  }
};

// Auto-redirect if trying to access dashboard without login
if (window.location.pathname.includes("dashboards") && !auth.isLoggedIn()) {
  window.location.href = "/login.html";
}
