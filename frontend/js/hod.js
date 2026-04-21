const hod = {
    init: async () => {
        auth.checkAccess(["hod"]);
        const user = auth.getUser();
        document.getElementById("welcome-msg").textContent = `Welcome, ${user.name}`;
        await hod.loadEvents();
        await hod.loadClubs();
        await hod.loadAssociationTeam();
        await hod.loadNotifications();
        hod.loadProfile();
        
        // Profile Init
        document.getElementById("profile-pic-input")?.addEventListener("change", hod.handleImageUpload);
        document.getElementById("profile-form")?.addEventListener("submit", hod.handleProfileUpdate);

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

    loadEvents: async () => {
        try {
            const res = await fetch("http://localhost:5000/api/events/status?status=pending_hod_approval", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            hod.allPending = await res.json();
            hod.filterPending();
        } catch (err) {
            const body = document.getElementById("hod-table-body");
            if (body) body.innerHTML = '<tr><td colspan="7">Error loading data</td></tr>';
        }
    },

    filterPending: () => {
        const searchInput = document.getElementById("hod-search");
        const dateInput = document.getElementById("hod-date-filter");
        const body = document.getElementById("hod-table-body");

        if (!body) return;

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const dateFilter = dateInput ? dateInput.value : "";

        const filtered = hod.allPending.filter(event => {
            const matchesName = event.title.toLowerCase().includes(searchTerm) || 
                               (event.clubId?.clubName || '').toLowerCase().includes(searchTerm);
            let matchesDate = true;
            if (dateFilter) {
                matchesDate = event.date.split("T")[0] === dateFilter;
            }
            return matchesName && matchesDate;
        });

        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No matching events found</td></tr>';
            return;
        }

        body.innerHTML = filtered.map(event => `
            <tr>
                <td>${event.title}</td>
                <td>${event.clubId?.clubName || 'N/A'}</td>
                <td>${new Date(event.date).toLocaleDateString()}</td>
                <td>${event.venue}</td>
                <td><span style="color: var(--success); font-weight: 600;">Ready</span></td>
                <td style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="hod.viewDocument('${event.posterImage}')">Poster</button>
                    <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="hod.viewDocument('${event.circularPdf}')">Circular</button>
                    <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="hod.viewDocument('${event.registrationLink}')">Reg Link</button>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="hod.approveEvent('${event._id}')">Approve</button>
                        <button class="btn btn-primary" style="padding: 0.5rem 1rem; background: var(--accent);" onclick="hod.openRejectModal('${event._id}')">Reject</button>
                    </div>
                </td>
            </tr>
        `).join("");
    },

    loadClubs: async () => {
        try {
            const res = await fetch("http://localhost:5000/api/clubs", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            hod.allClubs = await res.json();
            hod.filterClubs();
        } catch (err) {
            document.getElementById("hod-clubs-grid").innerHTML = "<p>Error loading clubs</p>";
        }
    },

    filterClubs: () => {
        const searchInput = document.getElementById("club-search");
        const grid = document.getElementById("hod-clubs-grid");
        
        if (!grid) return;
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        
        const filtered = hod.allClubs.filter(club => 
            club.clubName.toLowerCase().includes(searchTerm) || 
            (club.department || '').toLowerCase().includes(searchTerm)
        );

        if (filtered.length === 0) {
            grid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: var(--text-muted);'>No matching clubs found.</p>";
            return;
        }

        grid.innerHTML = filtered.map(club => `
            <div class="card clickable" onclick="hod.openClubModal('${club._id}')">
                <h3 style="color: var(--primary);">${club.clubName}</h3>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0;">${club.department}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem;">Coord: ${club.coordinator?.name || 'N/A'}</p>
            </div>
        `).join("");
    },

    openClubModal: async (id) => {
        try {
            const res = await fetch(`http://localhost:5000/api/clubs/${id}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            window.currentClubData = data;

            document.getElementById("club-modal-name").textContent = data.club.clubName;
            document.getElementById("club-modal-dept").textContent = data.club.department || "No Department";
            document.getElementById("club-modal-staff").textContent = data.club.coordinators ? data.club.coordinators.map(c => c.name).join(", ") : "N/A";
            document.getElementById("club-modal-student").textContent = data.club.studentCoordinator ? data.club.studentCoordinator.name : "N/A";
            
            hod.switchClubTab('published');
            document.getElementById("club-modal").style.display = "flex";
        } catch (err) {
            alert("Failed to load club details");
        }
    },

    switchClubTab: (status) => {
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        const activeTab = document.getElementById(`tab-${status}`);
        if (activeTab) activeTab.classList.add("active");

        let events = window.currentClubData.events[status] || [];
        
        if (status === 'published') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            events = events.filter(e => new Date(e.date) >= today);
        }

        const body = document.getElementById("club-events-table");
        
        body.innerHTML = events.length === 0 ? 
            `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No ${status} events found</td></tr>` :
            events.map(e => `
                <tr>
                    <td>${e.title}</td>
                    <td>${new Date(e.date).toLocaleDateString()}</td>
                    <td>${e.venue}</td>
                    <td>${e.attendance || 0}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="hod.viewEventPoster('${e.posterImage || e.poster}')" ${(!e.posterImage && !e.poster) ? 'disabled' : ''}>Poster</button>
                            ${status === 'completed' ? `<button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background: var(--success); color: white;" onclick="window.location.href='../event-report.html?id=${e._id}'">Report</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join("");
    },

    closeClubModal: () => {
        document.getElementById("club-modal").style.display = "none";
    },

    downloadClubReport: () => {
        const id = window.currentClubData.club._id;
        const monthYear = document.getElementById("report-month").value;
        let url = `http://localhost:5000/api/clubs/${id}/report?token=${auth.getToken()}`;
        if (monthYear) {
            const [year, month] = monthYear.split("-");
            url += `&year=${year}&month=${month}`;
        }
        window.open(url, '_blank');
    },

    viewDocument: (url) => {
        if (!url || url === 'undefined') return alert("Document not available yet");
        if (url.startsWith('http')) {
            window.open(url, '_blank');
        } else if (url.startsWith('/')) {
            // Frontend pages (e.g. /register.html, /feedback-form.html) should open via the frontend origin
            const origin = url.includes('.html') ? window.location.origin : 'http://localhost:5000';
            window.open(`${origin}${url}`, '_blank');
        } else {
            window.open(`http://localhost:5000/${url}`, '_blank');
        }
    },

    viewEventPoster: (posterUrl) => {
        hod.viewDocument(posterUrl);
    },

    approveEvent: async (id) => {
        if (!confirm("Approve this event? This will automatically publish it to the dashboard.")) return;
        try {
            const res = await fetch(`http://localhost:5000/api/events/${id}/hod-approve`, {
                method: "PUT",
                headers: { 
                    "Authorization": `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action: 'approve' })
            });
            if (res.ok) {
                alert("Event approved and published!");
                hod.loadEvents();
            }
        } catch (err) {
            alert("Approval failed");
        }
    },

    openRejectModal: (id) => {
        document.getElementById("reject-event-id").value = id;
        document.getElementById("reject-reason").value = "";
        document.getElementById("rejection-modal").style.display = "flex";
    },

    handleRejectSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("reject-event-id").value;
        const reason = document.getElementById("reject-reason").value;

        try {
            const res = await fetch(`http://localhost:5000/api/events/${id}/hod-approve`, {
                method: "PUT",
                headers: { 
                    "Authorization": `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action: 'reject', feedback: reason })
            });
            if (res.ok) {
                alert("Event rejected. Feedback sent.");
                document.getElementById("rejection-modal").style.display = "none";
                hod.loadEvents();
            }
        } catch (err) {
            alert("Failed to reject event");
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
                document.getElementById("display-role").textContent = (user.role || "hod").toUpperCase();
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
                hod.loadProfile();
                hod.toggleProfileEdit(false);
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
                <div class="notification-item ${!n.read ? 'unread' : ''}" onclick="hod.handleNotifClick('${n._id}', '${n.relatedId}', '${n.type}', event)">
                    <p style="margin-bottom: 0.3rem;">${n.message}</p>
                    <div style="display:flex; justify-content: space-between; align-items: center;">
                        <span class="time">${new Date(n.createdAt).toLocaleDateString()}</span>
                        ${n.type === 'event_approval' ? '<span style="font-size: 0.7rem; color: var(--primary); font-weight: bold;">ACTION REQUIRED</span>' : ''}
                    </div>
                    ${n.type === 'event_approval' && !n.read ? `
                        <div class="actions">
                            <button class="notification-btn notification-btn-primary" onclick="event.stopPropagation(); hod.approveEvent('${n.relatedId}'); hod.markAsRead('${n._id}')">Quick Approve</button>
                            <button class="notification-btn notification-btn-secondary" onclick="event.stopPropagation(); hod.handleNotifClick('${n._id}', '${n.relatedId}', '${n.type}', event)">View Details</button>
                        </div>
                    ` : ''}
                </div>
            `).join("");
        } catch (err) {
            console.error("Notifications failed to load");
        }
    },

    handleNotifClick: async (notifId, relatedId, type, event) => {
        if (event) event.stopPropagation();
        
        // Mark as read
        await hod.markAsRead(notifId);

        // If it's an event, scroll to review section and filter
        if (type === 'event_approval') {
            showSection('review');
            const searchInput = document.getElementById("hod-search");
            // Find event title from some state or just let the table load
            // For now, just ensuring the table is loaded
            await hod.loadEvents();
            // Optional: highlight the row
        }
        
        document.getElementById("notif-panel")?.classList.remove("show");
    },

    markAsRead: async (id) => {
        try {
            await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            await hod.loadNotifications();
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
            await hod.loadNotifications();
        } catch (err) {
            console.error(err);
        }
    },

    loadAssociationTeam: async () => {
        try {
            const res = await fetch(`http://localhost:5000/api/associations/my-team`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (!res.ok) return;

            const data = await res.json();
            window.myAssociation = data;

            document.getElementById("team-assoc-name").textContent = data.name;
            document.getElementById("team-dept-name").textContent = data.departmentId?.name || "Department";
            document.getElementById("team-hod-name").textContent = data.hodId?.name || "Unassigned";
            document.getElementById("team-hod-email").textContent = data.hodId?.email || "";
            document.getElementById("team-student-count").textContent = data.studentCoordinators.length;

            // Load Staff Coordinators (Read-only for HOD)
            const staffList = document.getElementById("team-staff-list");
            staffList.innerHTML = data.staffCoordinators.map(s => `
                <div class="card" style="padding: 1rem; border-left: 3px solid var(--secondary);">
                    <h4 style="margin: 0;">${s.name}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted);">${s.email}</p>
                    <span class="badge badge-secondary" style="margin-top: 0.5rem; font-size: 0.6rem;">Staff Coordinator</span>
                </div>
            `).join("");

            // Load Student Coordinators (Manageable)
            const tableBody = document.getElementById("team-student-table-body");
            if (data.studentCoordinators.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No student coordinators added yet.</td></tr>';
            } else {
                tableBody.innerHTML = data.studentCoordinators.map(s => `
                    <tr>
                        <td>${s.name}</td>
                        <td>${s.registerNumber || 'N/A'}</td>
                        <td>${s.email}</td>
                        <td>
                            <button class="btn" style="background: var(--danger); padding: 0.3rem 0.6rem; font-size: 0.7rem;" 
                                    onclick="hod.removeStudentCoordinator('${s._id}')">Remove</button>
                        </td>
                    </tr>
                `).join("");
            }
        } catch (err) {
            console.error("Failed to load association team");
        }
    },

    openAddStudentModal: () => {
        document.getElementById("add-student-form").reset();
        document.getElementById("add-student-modal").classList.add("show");
    },

    addStudentCoordinator: async (e) => {
        if (e) e.preventDefault();
        const email = document.getElementById("new-student-email").value;
        const assocId = window.myAssociation ? window.myAssociation._id : null;
        if (!assocId) return alert("Association context missing");

        try {
            const res = await fetch(`http://localhost:5000/api/associations/${assocId}/students`, {
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
                hod.loadAssociationTeam();
            } else {
                alert(data.message || "Failed to add student");
            }
        } catch (err) {
            alert("System error");
        }
    },

    removeStudentCoordinator: async (studentId) => {
        if (!confirm("Remove this student from coordinators?")) return;
        const assocId = window.myAssociation._id;

        try {
            const res = await fetch(`http://localhost:5000/api/associations/${assocId}/students`, {
                method: "DELETE",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ studentId })
            });

            if (res.ok) {
                alert("Coordinator removed");
                hod.loadAssociationTeam();
            }
        } catch (err) {
            alert("Failed to remove student");
        }
    }
};

document.getElementById("rejection-form")?.addEventListener("submit", hod.handleRejectSubmit);

function showSection(section) {
    document.getElementById("review-section").style.display = section === "review" ? "block" : "none";
    document.getElementById("clubs-section").style.display = section === "clubs" ? "block" : "none";
    document.getElementById("team-section").style.display = section === "team" ? "block" : "none";
    document.getElementById("profile-section").style.display = section === "profile" ? "block" : "none";

    if (section === "profile") hod.loadProfile();
    if (section === "team") hod.loadAssociationTeam();

    document.querySelectorAll(".sidebar nav ul li a").forEach(a => {
        a.classList.remove("active");
        if (a.getAttribute("onclick")?.includes(`'${section}'`)) a.classList.add("active");
    });
}

hod.init();
