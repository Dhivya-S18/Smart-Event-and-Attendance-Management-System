const admin = {
    init: async () => {
        auth.checkAccess(["admin"]);
        const user = auth.getUser();
        document.getElementById("welcome-msg").textContent = `Welcome, ${user.name}`;
        
        await admin.loadAnalytics();
        await admin.loadPublishableEvents();
        await admin.loadAllEvents();
        await admin.loadUsers();
        await admin.loadDepartments();
        await admin.loadClubs();
        await admin.loadAssociations();
        admin.loadProfile();
        
        // Profile Init
        document.getElementById("profile-pic-input")?.addEventListener("change", admin.handleImageUpload);
        document.getElementById("profile-form")?.addEventListener("submit", admin.handleProfileUpdate);

        // Global Click Listener for Dropdowns
        window.addEventListener("click", (e) => {
            if (!e.target.closest(".create-dropdown")) {
                document.getElementById("create-club-dropdown")?.classList.remove("show");
            }
        });
    },

    toggleLimitField: (groupId, type) => {
        const group = document.getElementById(groupId);
        if (group) group.style.display = type === 'open' ? 'block' : 'none';
    },

    addClubStaffRow: (prefix) => {
        const container = document.getElementById(`${prefix}-staff-container`);
        if (!container) return;
        const div = document.createElement("div");
        div.style = "display: flex; gap: 0.5rem;";
        div.innerHTML = `
            <input type="email" class="${prefix}-staff-email" placeholder="Staff Email" required style="flex: 1;">
            <button type="button" class="btn" style="background: var(--danger); padding: 0.2rem 0.5rem;" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(div);
    },

    loadAnalytics: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/analytics", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });

            if (res.status === 401 || res.status === 403) {
                console.warn("Invalid session detected, forcing logout...");
                auth.logout();
                return;
            }

            const data = await res.json();
            
            document.getElementById("stat-users").textContent = data.totalUsers;
            document.getElementById("stat-clubs").textContent = data.totalClubs;
            document.getElementById("stat-events").textContent = data.totalEvents;

            const ctx = document.getElementById('analyticsChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Total Users', 'Total Clubs', 'Total Events', 'Completed', 'Published'],
                    datasets: [{
                        label: 'Counts',
                        data: [data.totalUsers, data.totalClubs, data.totalEvents, data.completedEvents, data.publishedEvents],
                        backgroundColor: 'rgba(99, 102, 241, 0.5)',
                        borderColor: '#6366f1',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true } },
                    plugins: { legend: { display: false } }
                }
            });
        } catch (err) {
            console.error("Failed to load analytics");
        }
    },

    loadPublishableEvents: async () => {
        const body = document.getElementById("admin-table-body");
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/status?status=pending_hod_approval", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const events = await res.json();
            
            if (events.length === 0) {
                body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No events ready to publish</td></tr>';
                return;
            }

            body.innerHTML = events.map(event => `
                <tr>
                    <td>${event.title}</td>
                    <td>${event.club.clubName}</td>
                    <td>${new Date(event.date).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="admin.publishEvent('${event._id}')">Publish</button>
                        <button class="btn" style="padding: 0.5rem 1rem; background: var(--bg-dark);" onclick="admin.generateCircular('${event._id}')">Circular</button>
                    </td>
                </tr>
            `).join("");
        } catch (err) {
            body.innerHTML = '<tr><td colspan="4">Error loading data</td></tr>';
        }
    },

    publishEvent: async (id) => {
        if (!confirm("Publish this event to the homepage?")) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/events/${id}/publish`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Published successfully!");
                admin.loadPublishableEvents();
                admin.loadAnalytics();
            }
        } catch (err) {
            alert("Publishing failed");
        }
    },

    generateCircular: (id) => {
        window.open(`https://smart-event-and-attendance-management.onrender.com/api/generate/circular/${id}?token=${auth.getToken()}`, '_blank');
    },

    loadUsers: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/users", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const users = await res.json();
            
            if (!Array.isArray(users)) {
                console.error("Failed to load users array:", users);
                document.getElementById("hod-count").textContent = '0';
                document.getElementById("staff-count").textContent = '0';
                document.getElementById("student-count").textContent = '0';
                return;
            }

            window.allUsers = users; // Store globally for easy access

            // Update Counts
            const hods = users.filter(u => u.role === 'hod');
            const staff = users.filter(u => u.role === 'staff');
            const students = users.filter(u => u.role === 'student');

            document.getElementById("hod-count").textContent = hods.length;
            document.getElementById("staff-count").textContent = staff.length;
            document.getElementById("student-count").textContent = students.length;

            // Render HODs
            document.getElementById("hod-users-table").innerHTML = hods.map(u => `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.openModal('${u._id}')">View</button>
                        <button class="btn" style="background: var(--primary); padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.deleteUserDirectly('${u._id}', '${u.name}')">Delete</button>
                    </td>
                </tr>
            `).join("");

            // Render Staff
            document.getElementById("staff-users-table").innerHTML = staff.map(u => `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.department || 'N/A'}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.openModal('${u._id}')">View</button>
                        <button class="btn" style="background: var(--primary); padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.deleteUserDirectly('${u._id}', '${u.name}')">Delete</button>
                    </td>
                </tr>
            `).join("");

            // Render Students
            document.getElementById("student-users-table").innerHTML = students.map(u => `
                <tr>
                    <td>${u.name}</td>
                    <td>${u.registerNumber || 'N/A'}</td>
                    <td>${u.department || 'N/A'}</td>
                    <td>${u.clubId ? u.clubId.clubName : 'None'}</td>
                    <td>
                        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.openModal('${u._id}')">View</button>
                        <button class="btn" style="background: var(--primary); padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="admin.deleteUserDirectly('${u._id}', '${u.name}')">Delete</button>
                    </td>
                </tr>
            `).join("");

            // Apply filters immediately if any exist
            admin.filterUsers();

        } catch (err) {
            console.error("Error loading users", err);
        }
    },

    filterUsers: () => {
        const query = document.getElementById("search-users").value.toLowerCase();
        const deptFilter = document.getElementById("filter-user-dept").value.toLowerCase();

        // Target tables
        const hodRows = document.querySelectorAll("#hod-users-table tr");
        const staffRows = document.querySelectorAll("#staff-users-table tr");
        const studentRows = document.querySelectorAll("#student-users-table tr");

        const filterRow = (row, isStudent = false) => {
            const name = row.cells[0]?.textContent.toLowerCase() || "";
            let emailOrReg = row.cells[1]?.textContent.toLowerCase() || "";
            let dept = "";
            
            if (isStudent) {
                dept = row.cells[2]?.textContent.toLowerCase() || "";
            } else {
                dept = row.cells[1]?.textContent.toLowerCase() || ""; // In Staff table, cell 1 is Dept. Cell 1 in HOD is Email.
                if (row.closest('#hod-users-table')) dept = ""; // HODs don't show dept in this table layout easily
            }

            const matchesQuery = name.includes(query) || emailOrReg.includes(query);
            const matchesDept = !deptFilter || dept.includes(deptFilter);

            row.style.display = (matchesQuery && matchesDept) ? "" : "none";
        };

        hodRows.forEach(r => filterRow(r, false));
        staffRows.forEach(r => filterRow(r, false));
        studentRows.forEach(r => filterRow(r, true));
    },

    loadDepartments: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/departments", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            window.allDepartments = await res.json();
        } catch (err) {
            console.error("Error loading departments");
        }
    },

    showRole: (role) => {
        // Ensure Users section is visible if called from elsewhere
        if (document.getElementById("users-section").style.display === "none") {
            showSection('users');
        }

        document.querySelectorAll(".role-list").forEach(el => el.style.display = "none");
        const target = document.getElementById(`${role}-category`);
        if (target) {
            target.style.display = "block";
            // Smooth scroll to the category
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    },

    openModal: (id) => {
        const user = window.allUsers.find(u => u._id === id);
        if (!user) return;

        document.getElementById("edit-user-id").value = user._id;
        document.getElementById("edit-name").value = user.name;
        document.getElementById("edit-email").value = user.email;
        document.getElementById("edit-dept").value = user.department || "";
        document.getElementById("edit-reg").value = user.registerNumber || "";
        
        document.getElementById("role-group").style.display = "none";
        document.getElementById("password-group").style.display = "none";
        document.getElementById("student-extra-fields").style.display = 'block';
        document.getElementById("reg-id-label").textContent = user.role === 'student' ? "Register Number" : "Employee ID";
        
        document.getElementById("save-user-btn").textContent = "Update";
        document.getElementById("delete-user-btn").style.display = "block";
        
        document.getElementById("user-modal").style.display = "flex";
    },

    openAddUserModal: () => {
        document.getElementById("edit-user-form").reset();
        document.getElementById("edit-user-id").value = "";
        
        document.getElementById("role-group").style.display = "block";
        document.getElementById("password-group").style.display = "block";
        document.getElementById("student-extra-fields").style.display = "block";
        document.getElementById("reg-id-label").textContent = "Register Number / Employee ID";
        
        // Listen to role change in add mode
        document.getElementById("edit-role").onchange = (e) => {
            document.getElementById("reg-id-label").textContent = e.target.value === 'student' ? "Register Number" : "Employee ID";
        };

        document.getElementById("save-user-btn").textContent = "Create User";
        document.getElementById("delete-user-btn").style.display = "none";
        document.getElementById("user-modal").style.display = "flex";
    },

    closeModal: (id) => {
        if (!id) {
            // Default to user-modal for backward compatibility if called without ID
            const userModal = document.getElementById("user-modal");
            if (userModal) {
                userModal.style.display = "none";
                userModal.classList.remove("show");
            }
            return;
        }
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("show");
        }
    },

    deleteUser: async () => {
        const id = document.getElementById("edit-user-id").value;
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
        
        await admin._executeDeleteUser(id);
    },

    deleteUserDirectly: async (id, name) => {
        if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return;
        await admin._executeDeleteUser(id);
    },

    _executeDeleteUser: async (id) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/users/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("User deleted successfully");
                admin.closeModal('user-modal');
                admin.loadUsers();
                admin.loadAnalytics();
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed");
            }
        } catch (err) {
            alert("Delete failed: Network error");
        }
    },

    loadClubs: async () => {
        const grid = document.getElementById("admin-clubs-grid");
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/clubs", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const clubs = await res.json();
            window.allClubs = clubs;
            admin.renderClubs(clubs);
            
            admin.filterClubs(); // Apply any existing filter
        } catch (err) {
            grid.innerHTML = "<p>Error loading clubs</p>";
        }
    },

    renderClubs: (clubs) => {
        const grid = document.getElementById("admin-clubs-grid");
        if (clubs.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No clubs found in this category.</p>';
            return;
        }

        grid.innerHTML = clubs.map(club => {
            const studentCoord = club.studentCoordinators?.[0]?.name || club.studentCoordinator?.name || "None";
            return `
                <div class="card clickable" onclick="admin.viewClubDetails('${club._id}')" style="position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h3 style="color: var(--primary);">${club.clubName}</h3>
                        <button onclick="event.stopPropagation(); admin.deleteClub('${club._id}')" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                        </button>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0;">
                        ${club.clubType === 'independent' ? 'Independent' : club.departmentIds?.length > 1 ? 'Shared' : 'Departmental'}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; font-size: 0.9rem;">
                        <span><span style="color: var(--text-muted);">S.Coord:</span> ${studentCoord}</span>
                        <span class="badge" style="background: rgba(99,102,241,0.1); color: var(--primary); padding: 0.2rem 0.5rem; border-radius: 4px;">${club.members?.length || 0}</span>
                    </div>
                </div>
            `;
        }).join("");
    },

    filterClubsByType: (type, event) => {
        // Update tab styles
        if (event && event.target) {
            const tabs = event.target.closest('.category-tabs');
            if (tabs) {
                tabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
            }
        }

        if (type === 'all') {
            admin.renderClubs(window.allClubs);
        } else {
            const filtered = window.allClubs.filter(c => c.clubType === type);
            admin.renderClubs(filtered);
        }
    },

    filterClubs: () => {
        const query = document.getElementById("search-clubs").value.toLowerCase();
        const cards = document.querySelectorAll("#admin-clubs-grid .card");
        
        cards.forEach(card => {
            const name = card.querySelector("h3").textContent.toLowerCase();
            const dept = card.querySelector("p").textContent.toLowerCase();
            card.style.display = (name.includes(query) || dept.includes(query)) ? "" : "none";
        });
    },

    openAddClubModal: () => {
        document.getElementById("edit-user-id").value = "NEW_CLUB"; // Hijack unused input as flag
        document.getElementById("club-modal-name-input").value = "";
        document.getElementById("club-modal-desc-input").value = "";
        document.getElementById("club-modal-student-input").value = "";
        
        document.getElementById("club-report-div").style.display = "none";
        document.getElementById("club-events-section").style.display = "none";
        document.getElementById("delete-club-btn").style.display = "none";

        document.getElementById("club-edit-modal").style.display = "flex";
        document.getElementById("club-edit-modal").classList.add("show");
    },

    openAddDeptClubModal: () => {
        const deptSelect = document.getElementById("dept-club-dept-select");
        deptSelect.innerHTML = '<option value="">Select Department</option>' + 
            window.allDepartments.map(d => `<option value="${d._id}">${d.name}</option>`).join("");
        
        document.getElementById("dept-club-name").value = "";
        document.getElementById("dept-club-hod-select").innerHTML = '<option value="">Select HOD</option>';
        document.getElementById("dept-club-staff-container").innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Select a department first to load staff.</p>';
        document.getElementById("dept-club-modal").style.display = "flex";
    },

    loadHodsForDept: (deptId, targetSelectId) => {
        const select = document.getElementById(targetSelectId);
        if (!deptId) {
            select.innerHTML = '<option value="">Select HOD</option>';
            return;
        }
        
        const deptName = window.allDepartments.find(d => d._id === deptId)?.name;
        const hods = window.allUsers?.filter(u => u.role === 'hod' && u.department === deptName) || [];
        
        let options = '<option value="">Select HOD</option>';
        if (hods.length > 0) {
            options += hods.map(h => `<option value="${h._id}">${h.name}</option>`).join("");
        } else {
            options = '<option value="">No HOD found for this dept</option>';
        }
        select.innerHTML = options;
    },

    loadTeamForDept: (deptId, hodSelectId, staffContainerId, staffInputClass) => {
        const hodSelect = document.getElementById(hodSelectId);
        const staffContainer = document.getElementById(staffContainerId);
        
        if (!deptId) {
            hodSelect.innerHTML = '<option value="">Select HOD</option>';
            staffContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Select a department first to load staff.</p>';
            return;
        }
        
        const deptName = window.allDepartments.find(d => d._id === deptId)?.name;
        
        // Auto-fill HOD
        const hods = window.allUsers?.filter(u => u.role === 'hod' && u.department === deptName) || [];
        if (hods.length === 1) {
             hodSelect.innerHTML = `<option value="${hods[0]._id}" selected>${hods[0].name}</option>`;
        } else {
             hodSelect.innerHTML = hods.length ? hods.map(h => `<option value="${h._id}">${h.name}</option>`).join("") :
                 '<option value="">No HOD found for this dept</option>';
        }

        // Generate Checklist of Staffs
        const staffs = window.allUsers?.filter(u => u.role === 'staff' && u.department === deptName) || [];
        if (staffs.length > 0) {
            staffContainer.innerHTML = staffs.map(s => `
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; padding: 0.3rem 0; color: var(--text-main);">
                    <input type="checkbox" class="${staffInputClass}" value="${s.email}">
                    ${s.name} (${s.email})
                </label>
            `).join("");
        } else {
            staffContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">No staff found for this department.</p>';
        }
    },

    loadStaffForClubs: (deptIds, containerId, inputClass) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!window.allUsers) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Loading staff data...</p>';
            return;
        }

        let staffs = [];
        if (!deptIds || deptIds.length === 0) {
            // Independent: Load all staff
            staffs = window.allUsers.filter(u => u.role === 'staff');
        } else {
            // Filter by departments
            const deptNames = window.allDepartments
                .filter(d => deptIds.includes(d._id))
                .map(d => d.name);
            staffs = window.allUsers.filter(u => u.role === 'staff' && deptNames.includes(u.department));
        }

        if (staffs.length > 0) {
            container.innerHTML = staffs.map(s => `
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; padding: 0.3rem 0; color: var(--text-main);">
                    <input type="checkbox" class="${inputClass}" value="${s.email}">
                    ${s.name} (${s.email}${s.department ? ` - ${s.department}` : ''})
                </label>
            `).join("");
        } else {
            container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">${deptIds && deptIds.length > 0 ? 'No staff found for selected departments.' : 'No staff members found in the system.'}</p>`;
        }
    },

    saveDeptClub: async (e) => {
        if (e) e.preventDefault();
        const clubName = document.getElementById("dept-club-name").value;
        const description = document.getElementById("dept-club-description").value;
        const departmentId = document.getElementById("dept-club-dept-select").value;
        const hodId = document.getElementById("dept-club-hod-select").value;
        const staffEmails = [...document.querySelectorAll(".dept-club-staff-email:checked")].map(i => i.value);
        const membershipType = document.getElementById("dept-club-membership-type").value;
        const memberLimit = document.getElementById("dept-club-member-limit").value;

        if (!clubName) return alert("Club Name is required.");
        if (!description) return alert("Description is required.");
        if (!departmentId) return alert("Please select a Department.");
        if (!hodId) return alert("Please select a Department HOD.");
        if (staffEmails.length === 0) return alert("Please select at least one Staff Coordinator.");

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/clubs", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({
                    clubName,
                    description,
                    clubType: "department",
                    departmentIds: [departmentId],
                    hods: [hodId],
                    staffEmails: staffEmails.join(','),
                    membershipType,
                    memberLimit,
                    isPaidMembership: document.getElementById("dept-club-is-paid").value === "true",
                    membershipFee: Number(document.getElementById("dept-club-fee").value) || 0
                })
            });

            if (res.ok) {
                alert("Department Club Created!");
                admin.closeModal('dept-club-modal');
                admin.loadClubs();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create club");
            }
        } catch(err) { alert("Error saving club"); }
    },

    openAddSharedClubModal: () => {
        document.getElementById("shared-club-name").value = "";
        document.getElementById("shared-club-description").value = "";
        document.getElementById("shared-club-staff-container").innerHTML = "";
        admin.addClubStaffRow('shared-club');
        
        const grid = document.getElementById("shared-dept-checkbox-grid");
        grid.innerHTML = window.allDepartments.map(d => `
            <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                <input type="checkbox" class="shared-dept-check" value="${d._id}" data-name="${d.name}" onchange="admin.toggleSharedDeptAssignment(this)">
                <span>${d.name}</span>
            </div>
        `).join("");

        document.getElementById("hod-assignment-container").innerHTML = `
            <p id="hod-empty-msg" style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">Select departments above to assign HODs</p>
        `;

        document.getElementById("shared-club-modal").style.display = "flex";
    },

    toggleSharedDeptAssignment: (checkbox) => {
        const deptId = checkbox.value;
        const deptName = checkbox.getAttribute("data-name");
        const container = document.getElementById("hod-assignment-container");
        const emptyMsg = document.getElementById("hod-empty-msg");

        if (checkbox.checked) {
            if (emptyMsg) emptyMsg.remove();
            
            const div = document.createElement("div");
            div.id = `hod-row-${deptId}`;
            div.className = "hod-assignment-row";
            div.style = "display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);";
            div.innerHTML = `
                <span style="font-size: 0.8rem; font-weight: 500;">${deptName}</span>
                <select class="shared-hod-sel" data-dept="${deptId}" id="hod-select-${deptId}" style="width: 60%; background: var(--bg-dark); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.4rem; border-radius: 4px;">
                    <option value="">Select HOD</option>
                </select>
            `;
            container.appendChild(div);
            admin.loadHodsForDept(deptId, `hod-select-${deptId}`);
        } else {
            document.getElementById(`hod-row-${deptId}`)?.remove();
            if (container.children.length === 0) {
                container.innerHTML = `<p id="hod-empty-msg" style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">Select departments above to assign HODs</p>`;
            }
        }

        // Refresh Staff List
        const selectedCount = document.querySelectorAll(".shared-dept-check:checked").length;
        if (selectedCount > 0) {
            const selectedIds = [...document.querySelectorAll(".shared-dept-check:checked")].map(c => c.value);
            admin.loadStaffForClubs(selectedIds, 'shared-club-staff-container', 'shared-club-staff-email');
        } else {
            document.getElementById("shared-club-staff-container").innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Select departments above to load staff.</p>';
        }
    },

    saveSharedClub: async (e) => {
        if (e) e.preventDefault();
        const clubName = document.getElementById("shared-club-name").value;
        const description = document.getElementById("shared-club-description").value;
        const membershipType = document.getElementById("shared-club-membership-type").value;
        const memberLimit = document.getElementById("shared-club-member-limit").value;
        
        // Collect checked departments in DOM order
        const deptIds = [...document.querySelectorAll(".shared-dept-check:checked")].map(c => c.value);
        
        // Map HOD IDs matching the exact department order
        const hodIds = deptIds.map(id => document.getElementById(`hod-select-${id}`)?.value).filter(v => v);

        const staffEmails = [...document.querySelectorAll(".shared-club-staff-email:checked")].map(i => i.value);

        if (!clubName) return alert("Club Name is required.");
        if (!description) return alert("Description is required.");
        if (deptIds.length < 2) return alert("At least 2 departments must be selected for a Shared Club.");
        
        // Detailed HOD check
        for (const id of deptIds) {
            const hSel = document.getElementById(`hod-select-${id}`);
            const dName = document.querySelector(`.shared-dept-check[value="${id}"]`)?.getAttribute("data-name") || "one department";
            if (!hSel || !hSel.value) {
                return alert(`Please select an HOD for the department: ${dName}`);
            }
        }

        if (staffEmails.length === 0) return alert("Please select at least one Staff Coordinator.");

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/clubs", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({
                    clubName,
                    description,
                    clubType: "shared",
                    departmentIds: deptIds,
                    hods: hodIds,
                    staffEmails: staffEmails.join(','),
                    membershipType,
                    memberLimit,
                    isPaidMembership: document.getElementById("shared-club-is-paid").value === "true",
                    membershipFee: Number(document.getElementById("shared-club-fee").value) || 0
                })
            });

            if (res.ok) {
                alert("Shared Club Created!");
                admin.closeModal('shared-club-modal');
                admin.loadClubs();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create shared club");
            }
        } catch(err) { alert("Error saving shared club"); }
    },

    openAddIndependentClubModal: () => {
        document.getElementById("ind-club-name").value = "";
        document.getElementById("ind-club-description").value = "";
        admin.loadStaffForClubs([], 'ind-club-staff-container', 'ind-club-staff-email');
        document.getElementById("independent-club-modal").style.display = "flex";
    },

    saveIndependentClub: async (e) => {
        if (e) e.preventDefault();
        const clubName = document.getElementById("ind-club-name").value;
        const description = document.getElementById("ind-club-description").value;
        const staffEmails = [...document.querySelectorAll(".ind-club-staff-email:checked")].map(i => i.value);
        const membershipType = document.getElementById("ind-club-membership-type").value;
        const memberLimit = document.getElementById("ind-club-member-limit").value;

        if (!clubName) return alert("Club Name is required.");
        if (!description) return alert("Description is required.");
        if (staffEmails.length === 0) return alert("Please select at least one Staff Coordinator.");

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/clubs", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({
                    clubName,
                    description,
                    clubType: "independent",
                    departmentIds: [],
                    hods: [],
                    staffEmails: staffEmails.join(','),
                    membershipType,
                    memberLimit,
                    isPaidMembership: document.getElementById("ind-club-is-paid").value === "true",
                    membershipFee: Number(document.getElementById("ind-club-fee").value) || 0
                })
            });

            if (res.ok) {
                alert("Independent Club Created!");
                admin.closeModal('independent-club-modal');
                admin.loadClubs();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create independent club");
            }
        } catch(err) { alert("Error saving independent club"); }
    },

    // Unify name rendering to handle 'Pending' users cleaner
    formatTeamMemberName: (user) => {
        if (!user) return "Unassigned";
        if (user.name && !user.name.includes("Pending") && user.name !== "Staff Coordinator" && user.name !== "Head of Department") {
            return user.name;
        }
        return user.email || "Unknown User";
    },

    viewClubDetails: async (id) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/clubs/${id}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            window.currentClubData = data;
            const { club, events } = data;

            document.getElementById("detail-club-name").textContent = club.clubName;
            document.getElementById("detail-club-type-label").textContent = `${club.clubType.toUpperCase()} CLUB`;
            document.getElementById("detail-club-desc").textContent = club.description || "No description provided.";

            // Stats cards
            document.getElementById("club-detail-team-grid").innerHTML = `
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--primary);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Type</p>
                    <h4 style="margin-top: 0.5rem;">${club.clubType.charAt(0).toUpperCase() + club.clubType.slice(1)}</h4>
                </div>
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--secondary);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Staff Coordinators</p>
                    <h4 style="margin-top: 0.5rem;">${club.staffCoordinators?.length || 0}</h4>
                </div>
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--success);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Members</p>
                    <h4 style="margin-top: 0.5rem;">${club.members?.length || 0}</h4>
                </div>
            `;

            // Staff List
            document.getElementById("club-detail-staff-list").innerHTML = (club.staffCoordinators || []).map(s => `
                <li style="font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="min-width: 6px; height: 6px; background: var(--secondary); border-radius: 50%; margin-top: 4px;"></span>
                    <div>
                        <div style="font-weight: 600;">${admin.formatTeamMemberName(s)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.7;">${s.department || "Dept Coordinator"}</div>
                    </div>
                </li>
            `).join("");

            // Student Coord
            const studentCoord = club.studentCoordinators?.[0] || club.studentCoordinator;
            document.getElementById("club-detail-student-list").innerHTML = studentCoord ? `
                <li style="font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="min-width: 6px; height: 6px; background: var(--success); border-radius: 50%; margin-top: 4px;"></span>
                    <div>
                        <div style="font-weight: 600;">${admin.formatTeamMemberName(studentCoord)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.7;">Register: ${studentCoord.registerNumber || "N/A"}</div>
                    </div>
                </li>
            ` : '<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No student coordinator assigned.</p>';

            // HODs section (only for shared/dept)
            const hodSection = document.getElementById("club-detail-hods-section");
            if (club.clubType !== 'independent' && club.hods?.length > 0) {
                hodSection.style.display = "block";
                document.getElementById("club-detail-hod-list").innerHTML = club.hods.map(h => `
                    <li style="font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: start; gap: 0.5rem; background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 6px;">
                        <span style="min-width: 6px; height: 6px; background: var(--primary); border-radius: 50%; margin-top: 4px;"></span>
                        <div>
                            <div style="font-weight: 600;">${admin.formatTeamMemberName(h)}</div>
                            <div style="font-size: 0.75rem; opacity: 0.7;">${h.department || "HOD"}</div>
                        </div>
                    </li>
                `).join("");
            } else {
                hodSection.style.display = "none";
            }

            // Events
            const eventTable = document.getElementById("club-detail-events-table");
            const publishedEvents = data.events?.published || [];
            if (publishedEvents.length === 0) {
                eventTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No published events.</td></tr>';
            } else {
                eventTable.innerHTML = publishedEvents.map(e => `
                    <tr>
                        <td>${e.title}</td>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        <td>${e.venue}</td>
                        <td><button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="admin.openEventModal('${e._id}')">Review</button></td>
                    </tr>
                `).join("");
            }

            document.getElementById("club-detail-modal").classList.add("show");
        } catch (err) {
            console.error(err);
            alert("Failed to load club details");
        }
    },

    openClubEditModal: () => {
        // Use current data to populate edit modal
        const data = window.currentClubData;
        if (!data) return;
        admin.closeModal('club-detail-modal');
        admin.openClubModal(data.club._id);
    },

    openClubModal: async (id) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/clubs/${id}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            window.currentClubData = data;

            if (data.club) {
                document.getElementById("club-modal-desc-input").value = data.club.description || "";
                
                // Select type and visibility
                document.getElementById("club-modal-type-select").value = data.club.clubType || "department";
                document.getElementById("club-modal-visibility-select").value = data.club.eventVisibility || "public";

                // Populate Dept/HOD container
                const container = document.getElementById("dept-hod-container");
                container.innerHTML = "";
                if (data.club.clubType !== 'independent') {
                   const deptIds = data.club.departmentIds || [];
                   const hods = data.club.hods || [];
                   
                   if (deptIds.length > 0) {
                       deptIds.forEach((deptId, idx) => {
                           admin.addDeptHodRow(deptId, typeof hods[idx] === 'object' ? hods[idx]._id : hods[idx]);
                       });
                   } else {
                       admin.addDeptHodRow();
                   }
                }
                
                // Multi-staff handling in modal
                const staffContainer = document.getElementById("club-modal-staff-container");
                staffContainer.innerHTML = "";
                if (data.club.staffCoordinators && data.club.staffCoordinators.length > 0) {
                    data.club.staffCoordinators.forEach(s => {
                        const div = document.createElement("div");
                        div.style = "display: flex; gap: 0.5rem;";
                        div.innerHTML = `
                            <input type="email" class="club-modal-staff-email" value="${s.email}" required style="flex: 1;">
                            <button type="button" class="btn" style="background: var(--danger); padding: 0.2rem 0.5rem;" onclick="this.parentElement.remove()">×</button>
                        `;
                        staffContainer.appendChild(div);
                    });
                } else {
                    admin.addClubStaffRow('club-modal');
                }

                document.getElementById("club-modal-student-input").value = data.club.studentCoordinator?.email || "";
                
                document.getElementById("club-modal-membership-type").value = data.club.membershipType || "controlled";
                document.getElementById("club-modal-member-limit").value = data.club.memberLimit || 0;
                admin.toggleLimitField('club-modal-limit-group', data.club.membershipType || "controlled");

                document.getElementById("club-report-div").style.display = "block";
                document.getElementById("club-events-section").style.display = "block";
                document.getElementById("delete-club-btn").style.display = "block";

                admin.switchClubTab('published');
                document.getElementById("club-edit-modal").style.display = "flex";
                document.getElementById("club-edit-modal").classList.add("show");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to load club details");
        }
    },

    switchClubTab: (status, event = null) => {
        document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
        if (event) event.target?.classList?.add("active");
        else {
            const tabs = document.querySelectorAll(".tab-btn");
            tabs.forEach(btn => {
                if (btn.getAttribute("onclick")?.includes(`'${status}'`)) btn.classList.add("active");
            });
        }

        // Hide all tab contents
        document.getElementById("club-events-tab-content").style.display = "none";
        document.getElementById("club-members-tab-content").style.display = "none";
        document.getElementById("club-requests-tab-content").style.display = "none";

        if (status === 'members') {
            document.getElementById("club-members-tab-content").style.display = "block";
            const members = window.currentClubData.club.members || [];
            const body = document.getElementById("club-members-table");
            body.innerHTML = members.length === 0 ? 
                '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No members found</td></tr>' :
                members.map(m => `
                    <tr>
                        <td>${m.name}</td>
                        <td>${m.registerNumber || 'N/A'}</td>
                        <td>${m.department || 'N/A'}</td>
                        <td>${m.year || 'N/A'}</td>
                        <td>
                            <button class="btn" style="background:var(--danger); padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="admin.removeMember('${m._id}')">Remove</button>
                        </td>
                    </tr>
                `).join("");
        } else if (status === 'requests') {
            document.getElementById("club-requests-tab-content").style.display = "block";
            const requests = window.currentClubData.club.joinRequests || [];
            const body = document.getElementById("club-requests-table");
            body.innerHTML = requests.length === 0 ? 
                '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No join requests</td></tr>' :
                requests.map(r => `
                    <tr>
                        <td>${r.studentId?.name || 'Unknown'}</td>
                        <td>${r.studentId?.registerNumber || 'N/A'}</td>
                        <td><code style="font-size:0.7rem;">${r.transactionId || 'N/A'}</code></td>
                        <td><span class="badge ${r.status === 'pending' ? 'warning' : ''}">${r.status}</span></td>
                        <td>${new Date(r.appliedAt).toLocaleDateString()}</td>
                    </tr>
                `).join("");
        } else {
            document.getElementById("club-events-tab-content").style.display = "block";
            const events = window.currentClubData.events[status] || [];
            const body = document.getElementById("club-events-table");
            
            body.innerHTML = events.length === 0 ? 
                '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No events found</td></tr>' :
                events.map(e => `
                    <tr>
                        <td>${e.title}</td>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        <td>${e.venue}</td>
                        <td>${e.attendance || 0}</td>
                        <td>
                            <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="hod.viewEventPoster('${e.posterImage || e.poster}')" ${(!e.posterImage && !e.poster) ? 'disabled' : ''}>Poster</button>
                            ${status === 'completed' ? `<button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; background: var(--success); color: white;" onclick="window.location.href='../event-report.html?id=${e._id}'">Manage Report</button>` : ''}
                        </td>
                    </tr>
                `).join("");
        }
    },

    removeMember: async (userId) => {
        if (!confirm("Are you sure you want to remove this member?")) return;
        const clubId = window.currentClubData.club._id;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/clubs/${clubId}/members/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });

            if (res.ok) {
                alert("Member removed successfully");
                // Refresh modal data
                admin.openClubModal(clubId);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to remove member");
            }
        } catch (err) {
            console.error(err);
            alert("Error removing member");
        }
    },

    closeClubModal: () => {
        admin.closeModal('club-edit-modal');
    },

    handleClubTypeChange: () => {
        const type = document.getElementById("club-modal-type-select").value;
        const container = document.getElementById("dept-hod-container");
        container.innerHTML = "";
        
        if (type !== 'independent') {
            admin.addDeptHodRow();
        }
    },

    addDeptHodRow: (selectedDeptId = "", selectedHodId = "") => {
        const container = document.getElementById("dept-hod-container");
        const rowId = `dept-hod-row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const div = document.createElement("div");
        div.id = rowId;
        div.style = "display: flex; gap: 0.5rem; width: 200%;"; // Container spans across grid
        
        const deptSelect = document.createElement("select");
        deptSelect.className = "club-dept-select";
        deptSelect.style = "flex: 1; background: var(--bg-dark); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.5rem; border-radius: 4px;";
        deptSelect.innerHTML = '<option value="">Select Dept</option>' + 
            window.allDepartments.map(d => `<option value="${d._id}" ${d._id === selectedDeptId ? 'selected' : ''}>${d.name}</option>`).join("");
        
        const hodSelect = document.createElement("select");
        hodSelect.className = "club-hod-select";
        hodSelect.style = "flex: 1; background: var(--bg-dark); color: white; border: 1px solid rgba(255,255,255,0.1); padding: 0.5rem; border-radius: 4px;";
        hodSelect.innerHTML = '<option value="">Select HOD</option>';
        
        deptSelect.onchange = () => {
            const deptName = window.allDepartments.find(d => d._id === deptSelect.value)?.name;
            const hods = window.allUsers?.filter(u => u.role === 'hod' && u.department === deptName) || [];
            hodSelect.innerHTML = hods.length ? hods.map(h => `<option value="${h._id}">${h.name}</option>`).join("") :
                '<option value="">No HOD</option>';
        };

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn";
        removeBtn.style = "background: var(--danger); padding: 0.2rem 0.5rem;";
        removeBtn.textContent = "×";
        removeBtn.onclick = () => div.remove();

        div.appendChild(deptSelect);
        div.appendChild(hodSelect);
        div.appendChild(removeBtn);
        container.appendChild(div);

        // If a department is already selected, trigger HOD load
        if (selectedDeptId) {
            deptSelect.onchange();
            hodSelect.value = selectedHodId;
        }

        // Shared clubs might need multiple rows
        const type = document.getElementById("club-modal-type-select").value;
        if (type === 'shared') {
            // Logic to add 'Add Row' button for shared clubs if not exists or similar
        }
    },

    saveClub: async () => {
        const id = document.getElementById("edit-user-id").value;
        const clubName = document.getElementById("club-modal-name-input").value;
        const clubType = document.getElementById("club-modal-type-select").value;
        const eventVisibility = document.getElementById("club-modal-visibility-select").value;
        const membershipType = document.getElementById("club-modal-membership-type").value;
        const memberLimit = document.getElementById("club-modal-member-limit").value;
        const description = document.getElementById("club-modal-desc-input").value;
        const staffEmails = [...document.querySelectorAll(".club-modal-staff-email")].map(i => i.value).filter(v => v);
        const studentEmail = document.getElementById("club-modal-student-input").value;

        // Collect Departments and HODs
        const deptIds = [...document.querySelectorAll(".club-dept-select")].map(s => s.value).filter(v => v);
        const hods = [...document.querySelectorAll(".club-hod-select")].map(s => s.value).filter(v => v);

        if(!clubName || !description || staffEmails.length === 0) return alert("Fill required names, description and at least one staff email");

        try {

            let payload = { 
                clubName, 
                description, 
                clubType, 
                eventVisibility,
                membershipType,
                memberLimit,
                departmentIds: deptIds,
                hods: hods,
                staffEmails: staffEmails.join(',') 
            };
            
            if (studentEmail) {
                const studentUser = window.allUsers?.find(u => u.email === studentEmail);
                if (studentUser) payload.studentCoordinators = [studentUser._id];
            }

            const method = id === "NEW_CLUB" ? "POST" : "PUT";
            const url = id === "NEW_CLUB" ? "https://smart-event-and-attendance-management.onrender.com/api/admin/clubs" : `https://smart-event-and-attendance-management.onrender.com/api/admin/clubs/${id}`;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert(`Club ${id === "NEW_CLUB" ? "Created" : "Updated"}`);
                admin.closeClubModal();
                admin.loadClubs();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to save club");
            }
        } catch (err) {
            console.error(err);
            alert("Error saving club");
        }
    },

    openAddAssociationModal: () => {
        const select = document.getElementById("assoc-dept-select");
        select.innerHTML = '<option value="">Select Department</option>' + 
            window.allDepartments.map(d => `<option value="${d._id}">${d.name}</option>`).join("");
        
        document.getElementById("assoc-name").value = "";
        document.getElementById("association-modal").style.display = "flex";
    },

    closeAssociationModal: () => {
        document.getElementById("association-modal").style.display = "none";
    },

    saveAssociation: async (e) => {
        if (e) e.preventDefault();
        const name = document.getElementById("assoc-name").value;
        const departmentId = document.getElementById("assoc-dept-select").value;

        if (!name || !departmentId) return alert("Fill all fields");

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/associations", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ name, departmentId })
            });

            if (res.ok) {
                alert("Association created!");
                admin.closeAssociationModal();
                admin.loadAssociations();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create association");
            }
        } catch (err) {
            alert("Error creating association");
        }
    },

    deleteClub: async (id) => {
        const clubId = id || document.getElementById("edit-user-id").value;
        if (!confirm("Delete this club securely?")) return;

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/clubs/${clubId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Club deleted");
                if (!id) admin.closeClubModal(); // Only close if called from modal
                admin.loadClubs();
                admin.loadAnalytics();
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed");
            }
        } catch(err) {
            alert("Delete failed: Network error");
        }
    },

    downloadClubReport: () => {
        const id = window.currentClubData.club._id;
        const monthYear = document.getElementById("report-month").value; // YYYY-MM
        let url = `https://smart-event-and-attendance-management.onrender.com/api/clubs/${id}/report?token=${auth.getToken()}`;
        
        if (monthYear) {
            const [year, month] = monthYear.split("-");
            url += `&year=${year}&month=${month}`;
        } else {
            url += `&year=${new Date().getFullYear()}`;
        }
        
        window.open(url, '_blank');
    },

    loadAssociations: async () => {
        const grid = document.getElementById("admin-associations-grid");
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/associations", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const associations = await res.json();
            window.allAssociations = associations;

            if (associations.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No associations found.</p>';
                return;
            }

            grid.innerHTML = associations.map(assoc => `
                <div class="card clickable" onclick="admin.viewAssociationDetails('${assoc._id}')" style="padding: 1.5rem; transition: transform 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <h3 style="color: var(--primary); margin-bottom: 0.5rem;">${assoc.name}</h3>
                        <button onclick="event.stopPropagation(); admin.deleteAssociation('${assoc._id}')" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                        </button>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">Department Association</p>
                    <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; display: flex; justify-content: space-between;">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">DEPT: ${assoc.departmentId?.name || 'Loading...'}</span>
                        <span style="font-size: 0.8rem; color: var(--success); font-weight: bold;">VIEW DETAILS</span>
                    </div>
                </div>
            `).join("");
        } catch (err) {
            grid.innerHTML = "<p>Error loading associations</p>";
        }
    },

    saveAssociation: async (e) => {
        if (e) e.preventDefault();
        const name = document.getElementById("assoc-name").value;
        const departmentId = document.getElementById("assoc-dept-select").value;
        const hodId = document.getElementById("assoc-hod-select").value;
        const staffEmails = [...document.querySelectorAll(".assoc-staff-email:checked")].map(i => i.value);

        if (!name || !departmentId || !hodId) return alert("Please fill Association Name, Department and select an HOD.");
        if (staffEmails.length === 0) return alert("Please add at least one Staff Coordinator.");

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/associations", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ name, departmentId, hodId, staffEmails })
            });

            if (res.ok) {
                alert("Association created and invitations sent!");
                admin.closeModal('association-modal');
                admin.loadAssociations();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create association");
            }
        } catch (err) {
            alert("Error creating association");
        }
    },

    deleteAssociation: async (id) => {
        if (!confirm("Are you sure you want to delete this association?")) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/associations/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Association deleted");
                admin.loadAssociations();
            }
        } catch (err) { alert("Failed to delete association"); }
    },

    _deleteAssocFromDetail: async () => {
        // Find association ID from current state or data-assoc-id if added
        // Alternatively, since viewAssociationDetails stores data in a way we can access or we just pass it
        const name = document.getElementById("detail-assoc-name").textContent;
        // We need the ID. Let's look for where we might have stored it.
        // I'll update viewAssociationDetails to store the current ID.
        const id = window.currentAssocId; 
        if (!id) return alert("Association ID not found");
        
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/associations/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Association deleted");
                admin.closeModal('association-detail-modal');
                admin.loadAssociations();
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed");
            }
        } catch (err) { alert("Delete failed: Network error"); }
    },

    openAddAssociationModal: () => {
        const select = document.getElementById("assoc-dept-select");
        
        // Logical Rule: Hide departments that already have an association
        const takenDeptIds = window.allAssociations?.map(a => a.departmentId?._id || a.departmentId) || [];
        const availableDepts = window.allDepartments?.filter(d => !takenDeptIds.includes(d._id)) || [];

        if (availableDepts.length === 0) {
            return alert("All departments already have associations assigned.");
        }

        select.innerHTML = '<option value="">Select Department</option>' + 
            availableDepts.map(d => `<option value="${d._id}">${d.name}</option>`).join("");
        
        document.getElementById("assoc-name").value = "";
        document.getElementById("assoc-hod-select").innerHTML = '<option value="">Select HOD</option>';
        document.getElementById("assoc-staff-container").innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Select a department first to load staff.</p>';
        
        document.getElementById("association-modal").style.display = "flex";
    },

    updateAssocHODInfo: () => {
        // Obsolete: Replaced by loadTeamForDept
    },

    addAssocStaffRow: () => {
        const container = document.getElementById("assoc-staff-container");
        const div = document.createElement("div");
        div.style = "display: flex; gap: 0.5rem;";
        div.innerHTML = `
            <input type="email" class="assoc-staff-email" placeholder="Staff Email" required style="flex: 1;">
            <button type="button" class="btn" style="background: var(--danger); padding: 0.2rem 0.5rem;" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(div);
    },

    filterAssociations: () => {
        const query = document.getElementById("search-associations").value.toLowerCase();
        const cards = document.querySelectorAll("#admin-associations-grid .card");
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(query) ? "" : "none";
        });
    },

    viewAssociationDetails: async (id) => {
        try {
            window.currentAssocId = id; // Store for deletion
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/associations/${id}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            const { association, events } = data;

            document.getElementById("detail-assoc-name").textContent = association.name;
            document.getElementById("detail-assoc-dept").textContent = association.departmentId?.name || "No Department";

            // Team Summary Cards
            document.getElementById("detail-team-grid").innerHTML = `
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--primary);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Lead HOD</p>
                    <h4 style="margin-top: 0.5rem;">${admin.formatTeamMemberName(association.hodId)}</h4>
                    <p style="font-size: 0.75rem; opacity: 0.7;">${association.hodId?.email || ""}</p>
                </div>
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--secondary);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Staff Coordinators</p>
                    <h4 style="margin-top: 0.5rem;">${association.staffCoordinators.length}</h4>
                </div>
                <div class="card" style="padding: 1rem; border-left: 4px solid var(--success);">
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Student Coordinators</p>
                    <h4 style="margin-top: 0.5rem;">${association.studentCoordinators.length}</h4>
                </div>
            `;

            // Team Detail Lists
            document.getElementById("detail-staff-list").innerHTML = association.staffCoordinators.map(s => `
                <li style="font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: start; gap: 0.5rem;">
                    <span style="min-width: 6px; height: 6px; background: var(--secondary); border-radius: 50%; margin-top: 4px;"></span>
                    <div>
                        <div style="font-weight: 600;">${admin.formatTeamMemberName(s)}</div>
                        <div style="font-size: 0.75rem; opacity: 0.7;">${s.email}</div>
                    </div>
                </li>
            `).join("");

            document.getElementById("detail-student-list").innerHTML = association.studentCoordinators.length === 0 ? 
                '<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No student coordinators added.</p>' :
                association.studentCoordinators.map(s => `
                    <li style="font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: start; gap: 0.5rem;">
                        <span style="min-width: 6px; height: 6px; background: var(--success); border-radius: 50%; margin-top: 4px;"></span>
                        <div>
                            <div style="font-weight: 600;">${admin.formatTeamMemberName(s)}</div>
                            <div style="font-size: 0.75rem; opacity: 0.7;">${s.registerNumber || "N/A"}</div>
                        </div>
                    </li>
                `).join("");

            // Events Table
            const eventsTableBody = document.getElementById("detail-events-table");
            if (events.length === 0) {
                eventsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">No events recorded for this association.</td></tr>';
            } else {
                eventsTableBody.innerHTML = events.map(e => `
                    <tr>
                        <td style="font-weight: 500;">${e.title}</td>
                        <td>${new Date(e.date).toLocaleDateString()}</td>
                        <td><span class="badge ${e.status === 'published' ? 'success' : ''}" style="font-size: 0.7rem;">${e.status.replace(/_/g, ' ')}</span></td>
                        <td><button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="admin.openEventModal('${e._id}')">Edit</button></td>
                    </tr>
                `).join("");
            }

            document.getElementById("association-detail-modal").classList.add("show");
        } catch (err) {
            alert("Failed to load association details");
        }
    },

    viewEventPoster: (url) => {
        if (!url || url === 'undefined') return alert("No poster available");
        window.open(`https://smart-event-and-attendance-management.onrender.com${url.startsWith('/') ? '' : '/'}${url}`, '_blank');
    },

    viewEventDocument: (url) => {
        if (!url || url === 'undefined') return alert("No circular available");
        window.open(`https://smart-event-and-attendance-management.onrender.com${url.startsWith('/') ? '' : '/'}${url}`, '_blank');
    },

    loadAllEvents: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/admin/events", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const events = await res.json();
            
            if (!Array.isArray(events)) {
                console.error("Failed to load events. Received:", events);
                return;
            }

            window.allEvents = events;

            const now = new Date();
            window.categorizedEvents = {
                upcoming: events.filter(e => new Date(e.date) >= now),
                completed: events.filter(e => new Date(e.date) < now)
            };

            // Set default tab if not set
            if (!window.currentEventTab) window.currentEventTab = 'upcoming';
            
            admin.renderEventsTable(window.currentEventTab);
            admin.filterEvents();
        } catch (err) {
            console.error(err);
        }
    },

    switchEventTab: (status, event = null) => {
        if (event) {
            document.querySelectorAll("#event-tabs .tab-btn").forEach(btn => btn.classList.remove("active"));
            event.target.classList.add("active");
        }
        window.currentEventTab = status;
        admin.renderEventsTable(status);
        admin.filterEvents();
    },

    renderEventsTable: (status) => {
        const events = window.categorizedEvents[status] || [];
        const body = document.getElementById("manage-events-table");
        
        if (events.length === 0) {
            body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">No ${status} events found</td></tr>`;
            return;
        }

        body.innerHTML = events.map(e => `
            <tr>
                <td>${e.title}</td>
                <td>${e.clubId?.clubName || e.associationId?.name || e.associationName || 'N/A'}</td>
                <td>${new Date(e.date).toLocaleDateString()}</td>
                <td><span class="badge ${e.status === 'published' ? 'success' : ''}">${e.status.replace(/_/g, ' ')}</span></td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-secondary" style="padding: 0.2rem 0.4rem; font-size: 0.7rem;" onclick="admin.viewEventPoster('${e.posterImage}')" title="View Poster" ${!e.posterImage ? 'disabled' : ''}>P</button>
                    <button class="btn btn-secondary" style="padding: 0.2rem 0.4rem; font-size: 0.7rem;" onclick="admin.viewEventDocument('${e.circularPdf}')" title="View Circular" ${!e.circularPdf ? 'disabled' : ''}>C</button>
                    ${status === 'completed' ? `<button class="btn btn-success" style="padding: 0.2rem 0.4rem; font-size: 0.7rem;" onclick="window.location.href='../event-report.html?id=${e._id}'" title="Manage Report">R</button>` : ''}
                </td>
            </tr>
        `).join("");
    },

    filterEvents: () => {
        const query = document.getElementById("search-events").value.toLowerCase();
        const statusFilter = document.getElementById("filter-event-status").value.toLowerCase();
        const rows = document.querySelectorAll("#manage-events-table tr");

        rows.forEach(row => {
            const title = row.cells[0]?.textContent.toLowerCase() || "";
            const status = row.cells[3]?.textContent.toLowerCase() || "";
            
            const matchesQuery = title.includes(query);
            const matchesStatus = !statusFilter || status.includes(statusFilter);

            row.style.display = (matchesQuery && matchesStatus) ? "" : "none";
        });
    },

    openEventModal: (id) => {
        const e = window.allEvents?.find(ev => ev._id === id);
        if(!e) return;

        document.getElementById("edit-event-id").value = e._id;
        document.getElementById("edit-event-title").value = e.title;
        document.getElementById("edit-event-desc").value = e.description;
        document.getElementById("edit-event-date").value = new Date(e.date).toISOString().slice(0, 16);
        document.getElementById("edit-event-venue").value = e.venue;
        document.getElementById("edit-event-status").value = e.status;

        document.getElementById("edit-event-president").value = e.president || "";
        document.getElementById("edit-event-vp").value = e.vicePresident || "";
        document.getElementById("edit-event-security").value = e.security || "";
        document.getElementById("edit-event-other-coord").value = e.otherCoordinator || "";
        document.getElementById("edit-event-staff-1").value = e.staffCoordinator1 || "";
        document.getElementById("edit-event-staff-2").value = e.staffCoordinator2 || "";

        document.getElementById("event-modal").style.display = "flex";
    },

    closeEventModal: () => {
        document.getElementById("event-modal").style.display = "none";
    },

    deleteEventFromTable: async (id) => {
        if (!confirm("Permanently delete this event?")) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/events/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if(res.ok) {
                alert("Event deleted");
                admin.loadAllEvents();
                admin.loadAnalytics();
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed");
            }
        } catch(err) {
            alert("Delete failed: Network error");
        }
    },

    deleteEvent: async () => {
        const id = document.getElementById("edit-event-id").value;
        if (!confirm("Permanently delete this event?")) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/events/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if(res.ok) {
                alert("Event deleted");
                admin.closeEventModal();
                admin.loadAllEvents();
                admin.loadAnalytics();
            } else {
                const data = await res.json();
                alert(data.message || "Delete failed");
            }
        } catch(err) {
            alert("Delete failed: Network error");
        }
    },

    loadProfile: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/users/profile", {
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
                document.getElementById("display-role").textContent = (user.role || "admin").toUpperCase();
            }
            document.getElementById("view-email").textContent = user.email || "-";
            document.getElementById("view-phone").textContent = user.phone || "Not provided";
            document.getElementById("view-dept").textContent = user.department || "Not provided";
            document.getElementById("view-bio").textContent = user.bio || "No bio added yet.";
            
            const pic = user.profilePic ? `https://smart-event-and-attendance-management.onrender.com${user.profilePic}` : "../assets/default-avatar.png";
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
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/upload/profile", {
                method: "POST",
                headers: { "Authorization": `Bearer ${auth.getToken()}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                const currentUser = auth.getUser();
                const updatedUser = { ...currentUser, profilePic: data.imageUrl };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                document.getElementById("profile-pic-display").src = `https://smart-event-and-attendance-management.onrender.com${data.imageUrl}`;
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
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/upload/profile", {
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
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/users/profile", {
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
                admin.loadProfile();
                admin.toggleProfileEdit(false);
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

    toggleCreateDropdown: (e) => {
        if (e) e.stopPropagation();
        const dropdown = document.getElementById("create-club-dropdown");
        dropdown?.classList.toggle("show");
    }
};

// Handle Edit Event Submit
document.getElementById("edit-event-form")?.addEventListener("submit", async(e) => {
    e.preventDefault();
    const id = document.getElementById("edit-event-id").value;
    const payload = {
        title: document.getElementById("edit-event-title").value,
        description: document.getElementById("edit-event-desc").value,
        date: document.getElementById("edit-event-date").value,
        venue: document.getElementById("edit-event-venue").value,
        status: document.getElementById("edit-event-status").value,
        president: document.getElementById("edit-event-president").value,
        vicePresident: document.getElementById("edit-event-vp").value,
        security: document.getElementById("edit-event-security").value,
        otherCoordinator: document.getElementById("edit-event-other-coord").value,
        staffCoordinator1: document.getElementById("edit-event-staff-1").value,
        staffCoordinator2: document.getElementById("edit-event-staff-2").value
    };

    try {
        const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/admin/events/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            alert("Event updated successfully");
            admin.closeEventModal();
            admin.loadAllEvents();
            admin.loadAnalytics();
        }
    } catch(err) {
        alert("Failed to update event");
    }
});

// Handle Edit Form Submission
document.getElementById("edit-user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-user-id").value;
    
    // Check if Create or Update mode
    const isCreate = !id;

    const payload = {
        name: document.getElementById("edit-name").value,
        email: document.getElementById("edit-email").value,
        department: document.getElementById("edit-dept").value,
        registerNumber: document.getElementById("edit-reg").value
    };

    if (isCreate) {
        payload.role = document.getElementById("edit-role").value;
        payload.password = document.getElementById("edit-password").value;
        if (!payload.password) return alert("Password is required for new users");
    }

    try {
        const method = isCreate ? "POST" : "PUT";
        const url = isCreate 
            ? "https://smart-event-and-attendance-management.onrender.com/api/admin/users" 
            : `https://smart-event-and-attendance-management.onrender.com/api/admin/users/${id}`;

        const res = await fetch(url, {
            method,
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${auth.getToken()}` 
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert(isCreate ? "User created successfully" : "User updated successfully");
            admin.closeModal('user-modal');
            admin.loadUsers();
            admin.loadAnalytics();
        } else {
            const errBody = await res.json();
            alert(errBody.message || "Action failed");
        }
    } catch (err) {
        alert("Update failed");
    }
});

function showSection(section) {
    const sections = ["analytics", "publish", "events", "users", "associations", "clubs", "profile"];
    sections.forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.style.display = s === section ? "block" : "none";
    });

    if (section === "associations") admin.loadAssociations();
    if (section === "clubs") admin.loadClubs();

    if (section === "profile") admin.loadProfile();
    
    // Update sidebar active state
    document.querySelectorAll(".sidebar nav ul li a").forEach(a => {
        a.classList.remove("active");
        if (a.getAttribute("onclick")?.includes(`'${section}'`)) {
            a.classList.add("active");
        }
    });
}

admin.init();
