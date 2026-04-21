const API_BASE = "http://localhost:5000";
const staff = {
    init: async () => {
        auth.checkAccess(["staff"]);
        const user = auth.getUser();
        const welcomeMsg = document.getElementById("welcome-msg");
        const clubInfo = document.getElementById("club-info");
        if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${user.name}`;
        if (clubInfo) clubInfo.textContent = `Club: ${user.clubName || 'Not Assigned'}`;
        
        // Hide Join Requests for HOD and Student Coordinator roles
        if (user.role === 'hod' || user.role === 'student') {
            const navJoin = document.getElementById("nav-join-requests");
            if (navJoin) navJoin.style.display = "none";
        }
        
        await staff.loadPendingEvents();
        await staff.loadClubInsight();
        await staff.loadMembers();
        await staff.loadTeam();
        await staff.loadJoinRequests();
        await staff.loadNotifications();
        staff.loadProfile();

        document.getElementById("approval-form")?.addEventListener("submit", staff.handleApprovalSubmit);
        document.getElementById("profile-form")?.addEventListener("submit", staff.handleProfileUpdate);
        document.getElementById("profile-pic-input")?.addEventListener("change", staff.handleImageUpload);
        document.getElementById("approval-action")?.addEventListener("change", (e) => {
            const btn = document.getElementById("confirm-btn");
            btn.className = e.target.value === 'reject' ? 'btn btn-danger' : 'btn btn-primary';
            btn.textContent = e.target.value === 'reject' ? 'Confirm Rejection' : 'Confirm Approval';
        });

        // Notification Panel Toggle
        const notifTrigger = document.getElementById("notif-trigger");
        if (notifTrigger) {
            notifTrigger.onclick = (e) => {
                e.stopPropagation();
                const panel = document.getElementById("notif-panel");
                panel.classList.toggle("show");
            };
        }

        window.addEventListener("click", () => {
            document.getElementById("notif-panel")?.classList.remove("show");
        });
    },

    loadPendingEvents: async () => {
        try {
            const res = await fetch(`${API_BASE}/api/events/status?status=pending_staff_approval`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            staff.allPending = await res.json();
            staff.filterRequests();
        } catch (err) {
            const body = document.getElementById("pending-table-body");
            if (body) body.innerHTML = '<tr><td colspan="6">Error loading data</td></tr>';
        }
    },

    filterRequests: () => {
        const searchInput = document.getElementById("staff-search");
        const dateInput = document.getElementById("staff-date-filter");
        const body = document.getElementById("pending-table-body");

        if (!body) return;

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const dateFilter = dateInput ? dateInput.value : "";

        const filtered = staff.allPending.filter(event => {
            const matchesName = event.title.toLowerCase().includes(searchTerm) || 
                               (event.createdBy?.name || '').toLowerCase().includes(searchTerm);
            let matchesDate = true;
            if (dateFilter) {
                matchesDate = event.date.split("T")[0] === dateFilter;
            }
            return matchesName && matchesDate;
        });

        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No matching requests</td></tr>';
            return;
        }

        body.innerHTML = filtered.map(event => `
            <tr>
                <td>${event.title}</td>
                <td>${event.createdBy?.name || 'Unknown'}</td>
                <td>${new Date(event.date).toLocaleDateString()}</td>
                <td>${event.venue}</td>
                <td>
                    <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="staff.openApprovalModal('${escape(JSON.stringify(event))}')">Review</button>
                </td>
            </tr>
        `).join("");
    },

    loadClubInsight: async () => {
        const insight = document.getElementById("staff-club-detail");
        const user = auth.getUser();
        try {
            if (!user.clubId) {
                insight.innerHTML = "<p>No club assigned to your profile.</p>";
                return;
            }

            const detailRes = await fetch(`${API_BASE}/api/clubs/${user.clubId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await detailRes.json();
            window.currentClubData = data;

            insight.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
                    <div>
                        <h2>${data.club.clubName}</h2>
                        <p style="color: var(--text-muted);">${data.club.department}</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Monthly Events Report:</span>
                        <input type="month" id="report-month" style="padding: 0.5rem; background: var(--bg-dark); border: 1px solid rgba(255,255,255,0.1); color: white; border-radius: 8px;">
                        <button class="btn btn-primary" onclick="staff.downloadReport()">Report</button>
                    </div>
                </div>
                
                <div class="tabs" style="display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <button class="tab-btn active" onclick="staff.switchTab('published', this)">Upcoming</button>
                    <button class="tab-btn" onclick="staff.switchTab('completed', this)">Completed</button>
                    <button class="tab-btn" onclick="staff.switchTab('pending', this)">Approval</button>
                </div>
                
                <div class="table-container">
                    <table>
                        <thead><tr><th>Event</th><th>Date</th><th>Attendance</th><th>Action</th></tr></thead>
                        <tbody id="insight-events-table"></tbody>
                    </table>
                </div>
            `;
            staff.switchTab('published');
        } catch (err) {
            insight.innerHTML = "<p>Error loading performance data</p>";
        }
    },

    toggleRegistration: async (clubId, currentStatus) => {
        const btn = document.getElementById("reg-toggle-btn");
        const newStatus = !currentStatus;
        
        try {
            btn.disabled = true;
            btn.textContent = "Updating...";

            const res = await fetch(`${API_BASE}/api/clubs/${clubId}/toggle-registration`, {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ isPublished: newStatus })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                await staff.loadClubInsight(); // Refresh data
                await staff.loadJoinRequests(); // Refresh UI button
            } else {
                alert(data.message || "Failed to update registration status");
                await staff.loadClubInsight();
                await staff.loadJoinRequests();
            }
        } catch (err) {
            console.error("Toggle error:", err);
            alert("Connection error occurred.");
            await staff.loadClubInsight();
            await staff.loadJoinRequests();
        }
    },

    switchTab: (status, target) => {
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        if (target) {
            target.classList.add("active");
        } else {
            // Initial load or programmatic call - highlight the first tab
            const firstTab = document.querySelector(`.tab-btn[onclick*="'${status}'"]`);
            if (firstTab) firstTab.classList.add("active");
        }

        let events = window.currentClubData.events[status] || [];
        
        if (status === 'published') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            events = events.filter(e => new Date(e.date) >= today);
        }

        const body = document.getElementById("insight-events-table");
        body.innerHTML = events.length === 0 ? 
            '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No events found</td></tr>' :
            events.map(e => `
                <tr>
                    <td>${e.title}</td>
                    <td>${new Date(e.date).toLocaleDateString()}</td>
                    <td>${staff.getStatusLabel(e.status)}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.2rem 0.5rem;" onclick="staff.openEventDetails('${escape(JSON.stringify(e))}')">View Details</button>
                        ${status === 'completed' ? `<button class="btn" style="padding: 0.2rem 0.5rem; background: var(--success); color: white;" onclick="window.location.href='../event-report.html?id=${e._id}'">Manage Report</button>` : ''}
                    </td>
                </tr>
            `).join("");
    },

    openEventDetails: async (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        window.activeEvent = event;
        
        document.getElementById("modal-event-title").textContent = event.title;
        document.getElementById("modal-event-status").textContent = staff.getStatusLabel(event.status);
        document.getElementById("modal-event-desc").textContent = event.description;
        document.getElementById("modal-event-venue").textContent = event.venue;
        document.getElementById("modal-event-date").textContent = new Date(event.date).toLocaleDateString();
        document.getElementById("modal-event-time").textContent = event.time || 'N/A';

        // Feedback display
        const feedbackContainer = document.getElementById("modal-feedback-display");
        if (feedbackContainer) {
            if (event.status === 'rejected') {
                feedbackContainer.style.display = 'block';
                feedbackContainer.innerHTML = `
                    <div style="background: rgba(231, 76, 60, 0.1); border-left: 4px solid var(--accent); padding: 1rem; margin-top: 1rem;">
                        <h4 style="color: var(--accent); margin-top: 0;">Rejection Feedback</h4>
                        <p style="font-size: 0.9rem;"><strong>Staff:</strong> ${event.staffFeedback || 'None'}</p>
                        <p style="font-size: 0.9rem;"><strong>HOD:</strong> ${event.hodFeedback || 'None'}</p>
                    </div>
                `;
            } else {
                feedbackContainer.style.display = 'none';
            }
        }

        // Assets - Ensure correct URLs with backend origin
        const posterBtn = document.getElementById("btn-modal-poster");
        let posterUrl = event.posterImage || '';
        if (posterUrl && !posterUrl.startsWith('http')) {
            posterUrl = `${API_BASE}${posterUrl.startsWith('/') ? '' : '/'}${posterUrl}`;
        }
        posterBtn.dataset.url = posterUrl;
        posterBtn.disabled = !posterUrl;

        const circularBtn = document.getElementById("btn-modal-circular");
        let circularUrl = event.circularPdf || '';
        if (circularUrl && !circularUrl.startsWith('http')) {
            // Only prepend /uploads/ if it's not already there
            const path = circularUrl.startsWith('/uploads/') ? circularUrl : `/uploads/${circularUrl}`;
            circularUrl = `${API_BASE}${path}`;
        }
        circularBtn.dataset.url = circularUrl;
        circularBtn.disabled = !circularUrl;

        const regBtn = document.getElementById("btn-modal-reg-link");
        let regUrl = event.registrationLink || '';
        if (regUrl && !regUrl.startsWith('http')) {
            // Registration links are frontend routes
            regUrl = `${window.location.origin}${regUrl.startsWith('/') ? '' : '/'}${regUrl}`;
        }
        regBtn.dataset.url = regUrl;
        regBtn.disabled = !regUrl;

        staff.switchModalTab('overview');
        document.getElementById("event-detail-modal").classList.add("show");
    },

    switchModalTab: async (tab) => {
        const overview = document.getElementById("modal-overview-content");
        const participation = document.getElementById("modal-participation-content");
        const tabOverview = document.getElementById("tab-overview");
        const tabParticipation = document.getElementById("tab-participation");

        if (tab === 'overview') {
            overview.style.display = "block";
            participation.style.display = "none";
            tabOverview.classList.add("active");
            tabParticipation.classList.remove("active");
        } else {
            overview.style.display = "none";
            participation.style.display = "block";
            tabOverview.classList.remove("active");
            tabParticipation.classList.add("active");
            await staff.loadParticipation(window.activeEvent._id);
        }
    },

    loadParticipation: async (eventId) => {
        const body = document.getElementById("participation-table-body");
        body.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
        
        try {
            const res = await fetch(`${API_BASE}/api/events/${eventId}/registrations`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const registrations = await res.json();
            
            if (registrations.length === 0) {
                body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">No registrations yet.</td></tr>';
                return;
            }

            body.innerHTML = registrations.map(reg => `
                <tr>
                    <td>${reg.studentName}</td>
                    <td>${reg.registerNumber || 'N/A'}</td>
                    <td>${reg.department || 'N/A'}</td>
                    <td>${reg.email}</td>
                </tr>
            `).join("");
        } catch (err) {
            body.innerHTML = '<tr><td colspan="4">Error loading participation</td></tr>';
        }
    },

    getStatusLabel: (status) => {
        const labels = {
            'pending_staff_approval': 'Pending Your Approval',
            'circular_creation_pending': 'Pending Circular creation',
            'pending_hod_approval': 'Pending HOD Approval',
            'published': 'Published',
            'rejected': 'Rejected'
        };
        return labels[status] || status;
    },

    downloadReport: () => {
        const id = window.currentClubData.club._id;
        const monthYear = document.getElementById("report-month").value;
        let url = `${API_BASE}/api/clubs/${id}/report?token=${auth.getToken()}`;
        if (monthYear) {
            const [year, month] = monthYear.split("-");
            url += `&year=${year}&month=${month}`;
        }
        window.open(url, '_blank');
    },

    viewPoster: (url) => { if (url && url !== 'undefined') window.open(url, '_blank'); },

    openApprovalModal: (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        document.getElementById("approval-event-id").value = event._id;
        document.getElementById("approval-event-title").innerHTML = `
            <strong>Event:</strong> ${event.title}<br>
            <strong>Rules:</strong> ${event.rules || 'N/A'}<br>
            <strong>Attendance Type:</strong> ${event.memberDetails || 'Individual'}<br>
            <strong>Date/Time:</strong> ${new Date(event.date).toLocaleDateString()} at ${event.time || 'N/A'}
        `;
        document.getElementById("approval-feedback").value = "";
        document.getElementById("approval-modal").classList.add("show");
    },

    handleApprovalSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("approval-event-id").value;
        const action = document.getElementById("approval-action").value;
        const staffFeedback = document.getElementById("approval-feedback").value;

        try {
            const res = await fetch(`${API_BASE}/api/events/${id}/staff-approve`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ action, staffFeedback })
            });
            if (res.ok) {
                alert(`Event ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
                document.getElementById("approval-modal").classList.remove("show");
                staff.loadPendingEvents();
            }
        } catch (err) {
            alert("Action failed");
        }
    },

    loadMembers: async () => {
        try {
            if (!window.currentClubData || !window.currentClubData.club) {
                document.getElementById("members-list").innerHTML = "<p>No club data available.</p>";
                return;
            }
            staff.allMembers = window.currentClubData.club.members || [];
            staff.filterMembers();
        } catch (err) {
            document.getElementById("members-list").innerHTML = "<p>Error loading members</p>";
        }
    },

    filterMembers: () => {
        const searchInput = document.getElementById("member-search");
        const grid = document.getElementById("members-list");
        
        if (!grid) return;
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        
        const filtered = (staff.allMembers || []).filter(m => 
            (m.name || '').toLowerCase().includes(searchTerm) || 
            (m.registerNumber || '').toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            grid.innerHTML = "<p>No matching members found.</p>";
            return;
        }

        grid.innerHTML = filtered.map(m => `
            <div class="card" style="text-align: left; padding: 1.2rem; display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; gap: 0.8rem; align-items: start; flex: 1;">
                    <div style="font-size: 1.5rem; background: var(--bg-dark); padding: 0.6rem; border-radius: 10px; display: flex; align-items: center; justify-content: center; min-width: 50px;">👤</div>
                    <div style="overflow: hidden;">
                        <h3 style="margin-bottom: 0.2rem; font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</h3>
                        <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.2rem;">${m.registerNumber || 'No Register No'}</p>
                        <p style="color: var(--primary); font-size: 0.75rem; font-weight: 600;">${m.department || 'General'}</p>
                        <p style="color: var(--text-muted); font-size: 0.7rem; margin-top: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.email}</p>
                    </div>
                </div>
            </div>
        `).join("");
    },

    approveEvent: async (id) => {
        if (!confirm("Approve this event?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/events/${id}/staff-approve`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Approved successfully!");
                staff.loadPendingEvents();
            }
        } catch (err) {
            alert("Approval failed");
        }
    },
    loadProfile: async () => {
        try {
            const res = await fetch("http://localhost:5000/api/users/profile", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const user = await res.json();
            
            if (!res.ok) {
                console.error("Profile fetch error:", user.message);
                return;
            }

            console.log("Profile data loaded:", user);

            // Sync localStorage
            const localUser = auth.getUser();
            localStorage.setItem("user", JSON.stringify({ ...localUser, ...user }));

            // View Mode
            document.getElementById("display-name").textContent = user.name || "User Name";
            if (document.getElementById("display-role")) {
                document.getElementById("display-role").textContent = (user.role || "staff").toUpperCase();
            }
            document.getElementById("view-email").textContent = user.email || "-";
            document.getElementById("view-phone").textContent = user.phone || "Not provided";
            document.getElementById("view-dept").textContent = user.department || "Not provided";
            document.getElementById("view-bio").textContent = user.bio || "No bio added yet.";
            
            const pic = user.profilePic ? `http://localhost:5000${user.profilePic}` : "../assets/default-avatar.png";
            document.getElementById("profile-pic-display").src = pic;

            // Edit Mode
            document.getElementById("profile-name").value = user.name || "";
            document.getElementById("profile-email").value = user.email || "";
            document.getElementById("profile-phone").value = user.phone || "";
            document.getElementById("profile-dept-input").value = user.department || "";
            document.getElementById("profile-bio-input").value = user.bio || "";
        } catch (err) {
            console.error("System error loading profile:", err);
        }
    },

    toggleProfileEdit: (isEdit) => {
        document.getElementById("profile-view-mode").style.display = isEdit ? "none" : "block";
        document.getElementById("profile-edit-mode").style.display = isEdit ? "block" : "none";
        document.getElementById("edit-profile-btn").style.display = isEdit ? "none" : "inline-block";
    },

    handleImageUpload: async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch("http://localhost:5000/api/upload/profile", {
                method: "POST",
                headers: { "Authorization": `Bearer ${auth.getToken()}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                const currentUser = auth.getUser();
                const updatedUser = { ...currentUser, profilePic: data.imageUrl };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                document.getElementById("profile-pic-display").src = `http://localhost:5000${data.imageUrl}`;
                alert("Profile picture updated!");
            } else {
                alert(data.message || "Upload failed");
            }
        } catch (err) {
            alert("Upload error");
        }
    },

    deleteProfilePic: async () => {
        if (!confirm("Are you sure you want to remove your profile picture?")) return;
        try {
            const res = await fetch("http://localhost:5000/api/upload/profile", {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                const currentUser = auth.getUser();
                const updatedUser = { ...currentUser, profilePic: "" };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                document.getElementById("profile-pic-display").src = "../assets/default-avatar.png";
                alert("Profile picture removed");
            }
        } catch (err) {
            alert("Delete failed");
        }
    },

    handleProfileUpdate: async (e) => {
        e.preventDefault();
        const msg = document.getElementById("profile-msg");
        msg.textContent = "Updating...";
        
        const updateData = {
            name: document.getElementById("profile-name").value,
            email: document.getElementById("profile-email").value,
            phone: document.getElementById("profile-phone").value,
            department: document.getElementById("profile-dept-input").value,
            bio: document.getElementById("profile-bio-input").value
        };

        try {
            const res = await fetch("http://localhost:5000/api/users/profile", {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify(updateData)
            });

            const data = await res.json();
            if (res.ok) {
                const currentUser = auth.getUser();
                localStorage.setItem("user", JSON.stringify({ ...currentUser, ...data }));
                document.getElementById("welcome-msg").textContent = `Welcome, ${data.name}`;
                staff.loadProfile();
                staff.toggleProfileEdit(false);
                msg.textContent = "Profile updated successfully!";
                msg.style.color = "var(--success)";
            } else {
                msg.textContent = data.message || "Update failed";
                msg.style.color = "var(--error)";
            }
        } catch (err) {
            msg.textContent = "System error";
            msg.style.color = "var(--error)";
        }
    },

    loadTeam: async () => {
        const user = auth.getUser();
        try {
            let url = "";
            let isAssoc = false;

            if (user.associationId) {
                url = `${API_BASE}/api/associations/my-team`;
                isAssoc = true;
            } else if (user.clubId) {
                url = `${API_BASE}/api/clubs/${user.clubId}`;
            } else {
                return;
            }

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (!res.ok) return;

            const data = await res.json();
            const org = isAssoc ? data : data.club;
            if (!org) return;

            window.myOrganization = org;
            window.isAssociationTeam = isAssoc;

            document.getElementById("team-assoc-name").textContent = isAssoc ? org.name : org.clubName;
            document.getElementById("team-dept-name").textContent = (isAssoc ? org.departmentId?.name : org.department) || "Organization Team";
            
            const hod = isAssoc ? org.hodId : (org.hods && org.hods[0]);
            document.getElementById("team-hod-name").textContent = hod?.name || "Unassigned";
            document.getElementById("team-hod-email").textContent = hod?.email || "";
            
            document.getElementById("team-student-count").textContent = org.studentCoordinators?.length || 0;
            document.getElementById("team-staff-count").textContent = org.staffCoordinators?.length || 0;
            const memberCountEl = document.getElementById("team-member-count");
            if (memberCountEl) memberCountEl.textContent = org.members?.length || 0;

            // Render Student Coordinators
            const studentTableBody = document.getElementById("team-student-table-body");
            const students = org.studentCoordinators || [];
            if (students.length === 0) {
                studentTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No student coordinators added yet.</td></tr>';
            } else {
                studentTableBody.innerHTML = students.map(s => `
                    <tr>
                        <td>${s.name}</td>
                        <td>${s.registerNumber || 'N/A'}</td>
                        <td>${s.email}</td>
                        <td>
                            <button class="btn" style="background: var(--danger); padding: 0.3rem 0.6rem; font-size: 0.7rem;" 
                                    onclick="staff.removeCoordinator('${s._id}', 'student')">Remove</button>
                        </td>
                    </tr>
                `).join("");
            }

            // Render Staff Coordinators
            const staffTableBody = document.getElementById("team-staff-table-body");
            const staffMembers = org.staffCoordinators || [];
            if (staffMembers.length === 0) {
                staffTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No other staff coordinators.</td></tr>';
            } else {
                staffTableBody.innerHTML = staffMembers.map(s => `
                    <tr>
                        <td>${s.name} ${s._id === user._id ? ' (You)' : ''}</td>
                        <td>${s.department || 'N/A'}</td>
                        <td>${s.email}</td>
                        <td>
                            ${s._id !== user._id ? `<button class="btn" style="background: var(--danger); padding: 0.3rem 0.6rem; font-size: 0.7rem;" 
                                    onclick="staff.removeCoordinator('${s._id}', 'staff')">Remove</button>` : '<span style="color: var(--text-muted); font-size: 0.7rem;">-</span>'}
                        </td>
                    </tr>
                `).join("");
            }
        } catch (err) {
            console.error("Failed to load team");
        }
    },

    openAddStaffModal: () => {
        document.getElementById("add-staff-form").reset();
        document.getElementById("add-staff-modal").classList.add("show");
    },

    openAddStudentModal: () => {
        document.getElementById("add-student-form").reset();
        document.getElementById("add-student-modal").classList.add("show");
    },

    addStudentCoordinator: async (e) => {
        if (e) e.preventDefault();
        const email = document.getElementById("new-student-email").value;
        const orgId = window.myOrganization._id;
        const isAssoc = window.isAssociationTeam;

        const url = isAssoc ? `${API_BASE}/api/associations/${orgId}/students` : `${API_BASE}/api/clubs/${orgId}/coordinators`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                document.getElementById("add-student-modal").classList.remove("show");
                staff.loadTeam();
            } else {
                alert(data.message || "Failed to add student");
            }
        } catch (err) {
            alert("System error");
        }
    },

    addStaffCoordinator: async (e) => {
        if (e) e.preventDefault();
        const email = document.getElementById("new-staff-email").value;
        const orgId = window.myOrganization._id;
        const isAssoc = window.isAssociationTeam;

        const url = isAssoc ? `${API_BASE}/api/associations/${orgId}/staff` : `${API_BASE}/api/clubs/${orgId}/staff`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                document.getElementById("add-staff-modal").classList.remove("show");
                staff.loadTeam();
            } else {
                alert(data.message || "Failed to add staff");
            }
        } catch (err) {
            alert("System error");
        }
    },

    removeCoordinator: async (userId, type) => {
        const entityTypeName = type === 'staff' ? 'Staff' : 'Student';
        if (!confirm(`Are you sure you want to remove this ${entityTypeName} coordinator?`)) return;
        
        const orgId = window.myOrganization._id;
        const isAssoc = window.isAssociationTeam;

        // Note: Backend might need specific check for staff removal
        // For now using association student removal logic pattern if applicable
        let url = "";
        if (isAssoc) {
            url = type === 'student' ? `${API_BASE}/api/associations/${orgId}/students` : `${API_BASE}/api/associations/${orgId}/staff`;
        } else {
            // Club removal logic (needs backend support for staff removal specifically)
            url = type === 'student' ? `${API_BASE}/api/clubs/${orgId}/coordinators` : `${API_BASE}/api/clubs/${orgId}/staff`;
        }

        try {
            const res = await fetch(url, {
                method: "DELETE",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify(type === 'student' ? { studentId: userId } : { staffId: userId })
            });

            if (res.ok) {
                alert("Coordinator removed");
                staff.loadTeam();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to remove coordinator");
            }
        } catch (err) {
            alert("Failed to remove coordinator");
        }
    },

    loadNotifications: async () => {
        try {
            const res = await fetch("http://localhost:5000/api/notifications", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const notifications = await res.json();
            const unreadCount = notifications.filter(n => !n.read).length;
            
            const badge = document.getElementById("notif-badge");
            if (badge) {
                badge.style.display = unreadCount > 0 ? "block" : "none";
                badge.textContent = unreadCount;
            }

            const list = document.getElementById("notif-list");
            if (!list) return;

            if (notifications.length === 0) {
                list.innerHTML = '<div class="notification-empty">No notifications yet</div>';
                return;
            }

            list.innerHTML = notifications.map(n => `
                <div class="notification-item ${!n.read ? 'unread' : ''}" onclick="staff.handleNotifClick('${n._id}', '${n.relatedId}', '${n.type}', event)">
                    <p style="margin-bottom: 0.3rem;">${n.message}</p>
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <span class="time">${new Date(n.createdAt).toLocaleDateString()}</span>
                        ${n.type === 'event_approval' ? '<span style="font-size: 0.7rem; color: var(--primary); font-weight: bold;">ACTION REQUIRED</span>' : ''}
                    </div>
                    ${n.type === 'event_approval' && !n.read ? `
                        <div class="actions">
                            <button class="notification-btn notification-btn-primary" onclick="event.stopPropagation(); staff.quickReview('${n.relatedId}'); staff.markAsRead('${n._id}')">Quick Review</button>
                        </div>
                    ` : ''}
                </div>
            `).join("");
        } catch (err) {
            console.error("Notifications failed to load");
        }
    },

    quickReview: async (eventId) => {
        try {
            const res = await fetch(`${API_BASE}/api/events/${eventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const event = await res.json();
            staff.openApprovalModal(JSON.stringify(event));
        } catch (err) {
            alert("Failed to load event details");
        }
    },

    handleNotifClick: async (notifId, relatedId, type, event) => {
        if (event) event.stopPropagation();
        
        await staff.markAsRead(notifId);

        if (type === 'event_approval') {
            showSection('pending');
            const searchInput = document.getElementById("staff-search");
            await staff.loadPendingEvents();
        }
        
        document.getElementById("notif-panel")?.classList.remove("show");
    },

    markAsRead: async (id) => {
        try {
            await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            await staff.loadNotifications();
        } catch (err) {
            console.error(err);
        }
    },

    markAllRead: async (e) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch("http://localhost:5000/api/notifications", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const notifications = await res.json();
            const unread = notifications.filter(n => !n.read);
            
            for (const n of unread) {
                await fetch(`http://localhost:5000/api/notifications/${n._id}/read`, {
                    method: "PUT",
                    headers: { "Authorization": `Bearer ${auth.getToken()}` }
                });
            }
            await staff.loadNotifications();
        } catch (err) {
            console.error(err);
        }
    },

    loadJoinRequests: async () => {
        const body = document.getElementById("join-requests-table-body");
        const toggleContainer = document.getElementById("join-form-toggle-container");
        const user = auth.getUser();
        if (!body || !user.clubId) return;

        if (window.currentClubData && window.currentClubData.club && toggleContainer) {
            const club = window.currentClubData.club;
            
            if (!club.hasJoinForm) {
                toggleContainer.innerHTML = `
                    <button class="btn btn-secondary" onclick="staff.openJoinFormModal()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        ⚙️ Create Join Request Form
                    </button>
                    <button class="btn" disabled style="padding: 0.5rem 1rem; font-size: 0.85rem; background: rgba(255,255,255,0.05); color: #64748b; border: 1px solid rgba(255,255,255,0.1); cursor: not-allowed;" title="Create a form first">
                        ⚪ Post Join Form to Students
                    </button>
                `;
            } else {
                toggleContainer.innerHTML = `
                    <button class="btn btn-secondary" onclick="staff.openJoinFormModal()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                        ✏️ Edit Join Form
                    </button>
                    <button id="reg-toggle-btn" class="btn ${club.isPublishedForRegistration ? 'btn-primary' : ''}" 
                        style="padding: 0.5rem 1rem; font-size: 0.85rem; background: ${club.isPublishedForRegistration ? '#22c55e' : 'rgba(255,255,255,0.05)'}; color: ${club.isPublishedForRegistration ? 'white' : '#94a3b8'}; border: 1px solid rgba(255,255,255,0.1);"
                        onclick="staff.toggleRegistration('${club._id}', ${club.isPublishedForRegistration})">
                        ${club.isPublishedForRegistration ? '🟢 Join Form Active (Visible to Students)' : '⚪ Post Join Form to Students'}
                    </button>
                `;
            }
        }

        try {
            const res = await fetch(`http://localhost:5000/api/clubs/${user.clubId}/requests`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const requests = await res.json();

            if (requests.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pending applications</td></tr>';
                return;
            }

            body.innerHTML = requests.map(req => `
                <tr>
                    <td>${req.studentId?.name || 'N/A'}</td>
                    <td>${req.studentId?.registerNumber || 'N/A'}</td>
                    <td>${req.studentId?.email || 'N/A'}</td>
                    <td><span style="font-family: monospace; background: rgba(0,0,0,0.2); padding: 0.2rem 0.4rem; border-radius: 4px;">${req.transactionId || 'Free'}</span></td>
                    <td>${new Date(req.appliedAt).toLocaleDateString()}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-success" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="staff.manageJoinRequest('${req.studentId?._id}', 'approve')">Approve</button>
                            <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="staff.manageJoinRequest('${req.studentId?._id}', 'reject')">Reject</button>
                        </div>
                    </td>
                </tr>
            `).join("");
        } catch (err) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Error loading applications</td></tr>';
        }
    },

    manageJoinRequest: async (userId, action) => {
        const user = auth.getUser();
        if (!confirm(`Are you sure you want to ${action} this application?`)) return;

        try {
            const res = await fetch(`http://localhost:5000/api/clubs/${user.clubId}/requests/manage`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ userId, action })
            });

            if (res.ok) {
                alert(`Application ${action}ed successfully!`);
                await staff.loadJoinRequests();
                await staff.loadMembers();
            } else {
                const data = await res.json();
                alert(data.message || `Failed to ${action} application`);
            }
        } catch (err) {
            alert("Network error occurred.");
        }
    },

    openJoinFormModal: () => {
        if (!window.currentClubData || !window.currentClubData.club) return;
        const club = window.currentClubData.club;
        
        document.getElementById("join-membership-type").value = club.membershipType || "controlled";
        const limitGroup = document.getElementById("join-member-limit-group");
        if (club.membershipType === "open") {
            limitGroup.style.display = "block";
        } else {
            limitGroup.style.display = "none";
        }
        document.getElementById("join-member-limit").value = club.memberLimit || 0;
        
        document.getElementById("join-is-paid").value = club.isPaidMembership ? "true" : "false";
        const feeGroup = document.getElementById("join-fee-group");
        if (club.isPaidMembership) {
            feeGroup.style.display = "block";
        } else {
            feeGroup.style.display = "none";
        }
        document.getElementById("join-fee").value = club.membershipFee || 0;
        
        document.getElementById("join-form-modal").classList.add("show");
    },

    closeJoinFormModal: () => {
        document.getElementById("join-form-modal").classList.remove("show");
    },

    saveJoinForm: async (e) => {
        e.preventDefault();
        const user = auth.getUser();
        
        const payload = {
            membershipType: document.getElementById("join-membership-type").value,
            memberLimit: parseInt(document.getElementById("join-member-limit").value),
            isPaidMembership: document.getElementById("join-is-paid").value === "true",
            membershipFee: parseInt(document.getElementById("join-fee").value)
        };
        
        try {
            const res = await fetch(`${API_BASE}/api/clubs/${user.clubId}/join-form`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
                alert("Form configured successfully!");
                staff.closeJoinFormModal();
                await staff.loadClubInsight(); // Refresh currentClubData
                await staff.loadJoinRequests(); // Re-render the buttons
            } else {
                alert(data.message || "Failed to configure join form.");
            }
        } catch (err) {
            alert("Network error occurred.");
        }
    }
};

function showSection(section) {
    document.getElementById("pending-section").style.display = section === "pending" ? "block" : "none";
    document.getElementById("join-requests-section").style.display = section === "join-requests" ? "block" : "none";
    document.getElementById("team-section").style.display = section === "team" ? "block" : "none";
    document.getElementById("club-insight-section").style.display = section === "club-insight" ? "block" : "none";
    document.getElementById("profile-section").style.display = section === "profile" ? "block" : "none";

    if (section === "profile") staff.loadProfile();
    if (section === "team") staff.loadTeam();

    document.querySelectorAll(".sidebar nav ul li a").forEach(a => {
        a.classList.remove("active");
        if (a.getAttribute("onclick")?.includes(`'${section}'`)) a.classList.add("active");
    });
}

staff.init();
