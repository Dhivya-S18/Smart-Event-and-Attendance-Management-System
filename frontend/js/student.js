const student = {
    init: async () => {
        auth.checkAccess(["student"]);
        const user = auth.getUser();
        document.getElementById("welcome-msg").textContent = `Welcome, ${user.name}`;
        
        // Profile Init
        document.getElementById("profile-pic-input")?.addEventListener("change", student.handleImageUpload);
        document.getElementById("profile-form")?.addEventListener("submit", student.handleProfileUpdate);
        if (user.clubName) {
            document.getElementById("workflow-nav").style.display = "block";
            document.getElementById("create-nav").style.display = "block";
            student.loadCoordinators();
            await student.checkWorkflowVisibility();
        }

        // Add profile info to header
        const profileInfo = document.createElement("div");
        profileInfo.style.fontSize = "0.9rem";
        profileInfo.style.color = "rgba(255,255,255,0.6)";
        profileInfo.innerHTML = `Reg No: ${user.registerNumber || 'N/A'} | Dept: ${user.department || 'N/A'}`;
        document.querySelector("header").appendChild(profileInfo);

        await student.loadPublishedEvents();
        await student.loadMyProposals();
        student.updateClubStatus();

        // Association Check: Hide department selection if user belongs to an association
        if (user.associationId) {
            const deptGroup = document.getElementById("allowed-depts-group");
            const editDeptGroup = document.getElementById("edit-allowed-depts-group");
            if (deptGroup) deptGroup.style.display = "none";
            if (editDeptGroup) editDeptGroup.style.display = "none";
        }

        // Listeners for workflow modals
        document.getElementById("poster-form")?.addEventListener("submit", student.handlePosterSubmit);
        document.getElementById("registration-setup-form")?.addEventListener("submit", student.handleRegistrationSetupSubmit);
        document.getElementById("circular-form")?.addEventListener("submit", student.handleCircularSubmit);
        document.getElementById("event-form")?.addEventListener("submit", student.submitEvent);
        document.getElementById("edit-form")?.addEventListener("submit", student.handleUpdateSubmit);
        document.getElementById("profile-form")?.addEventListener("submit", student.handleProfileUpdate);
        document.getElementById("join-club-form")?.addEventListener("submit", (e) => student.handleJoinClub(e));
        
        await student.loadAllClubs();
    },

    onParticipationTypeChange: (type, individualGroupId, teamGroupId) => {
        const indGroup = document.getElementById(individualGroupId);
        const teamGroup = document.getElementById(teamGroupId);
        if (type === 'Team') {
            indGroup.style.display = 'none';
            teamGroup.style.display = 'block';
        } else {
            indGroup.style.display = 'block';
            teamGroup.style.display = 'none';
        }
    },

    loadCoordinators: async () => {
        const select = document.getElementById("staff-coordinator");
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/auth/coordinators", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const coordinators = await res.json();
            // Filter by student's club name if possible (backend might already do this or return all)
            select.innerHTML = '<option value="">Select a Coordinator</option>' + 
                coordinators.map(c => `<option value="${c._id}">${c.name} (${c.department})</option>`).join("");
        } catch (err) {
            select.innerHTML = '<option value="">Error loading</option>';
        }
    },

    updateClubStatus: () => {
        const user = auth.getUser();
        const statusEl = document.getElementById("club-status");
        if (user.clubName) {
            statusEl.textContent = `Member of: ${user.clubName}`;
            statusEl.style.color = "#2ecc71";
        } else {
            statusEl.textContent = "No Club Assigned";
            statusEl.style.color = "var(--accent)";
        }
    },

    loadPublishedEvents: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/status", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            student.allPublishedEvents = await res.json();
            student.filterPublishedEvents();
        } catch (err) {
            const grid = document.getElementById("published-grid");
            if (grid) grid.innerHTML = "<p>Error loading events</p>";
        }
    },

    filterPublishedEvents: () => {
        const searchInput = document.getElementById("event-search");
        const dateInput = document.getElementById("date-filter");
        const upcomingGrid = document.getElementById("published-grid");
        const completedGrid = document.getElementById("completed-grid");

        if (!upcomingGrid || !completedGrid) return;

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        const dateFilter = dateInput ? dateInput.value : "";

        const filtered = student.allPublishedEvents.filter(e => {
            const matchesName = e.title.toLowerCase().includes(searchTerm);
            let matchesDate = true;
            if (dateFilter) {
                matchesDate = e.date.split("T")[0] === dateFilter;
            }
            return matchesName && matchesDate && (e.status === "published" || e.status === "completed");
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents = filtered.filter(e => e.status === "published" && new Date(e.date) >= today);
        const completedEvents = filtered.filter(e => e.status === "completed" || new Date(e.date) < today);

        const renderEvent = (event) => {
            const isManualCompleted = event.status === "completed";
            const isDateCompleted = new Date(event.date) < today;
            const isCompleted = isManualCompleted || isDateCompleted;
            const feedbackOpen = event.feedbackEnabled === true;
            const regClosed = !event.registrationEnabled || feedbackOpen;

            return `
            <div class="card">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="margin: 0;">${event.title}</h3>
                    <div style="display: flex; gap: 0.3rem;">
                        ${feedbackOpen ? '<span style="background: var(--success); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Feedback Open</span>' : ''}
                        ${isCompleted ? '<span style="background: var(--text-muted); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Completed</span>' : '<span style="background: var(--primary); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">Upcoming</span>'}
                    </div>
                </div>
                ${!isCompleted && regClosed ? `<p style="margin-top: 0.3rem; color: #f87171; font-size: 0.8rem; font-weight: bold;">⚠️ Registration Closed${feedbackOpen ? ' (Feedback Stage)' : ''}</p>` : ''}
                <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">${event.clubId?.clubName || 'Assigned Club'}</p>
                <p style="margin: 0.5rem 0;">${event.description}</p>
                <p>📍 ${event.venue}</p>
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">
                    👥 <strong>Registrations:</strong> 
                    <span style="color: var(--primary); font-weight: bold;">
                        ${event.isTeamEvent ? 
                            `${event.registeredTeamsCount || 0} / ${event.maxTeams || 0} Teams` : 
                            `${event.registeredCount || 0} / ${event.maxParticipants || 0} Seats`}
                    </span>
                </p>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="student.viewRegistrations('${event._id}', '${event.title}')">View Registered Students</button>
                    <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="student.openPublishedEventModal('${escape(JSON.stringify(event))}')">View Event Assets</button>
                    ${auth.getUser().clubName ? `<button class="btn btn-success" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="student.openFeedbackModal('${event._id}')">Manage Feedback</button>` : ''}
                    ${isCompleted && (auth.compareIds(auth.getUser()._id, event.createdBy) || auth.getUser().clubName === (event.clubId?.clubName || event.clubName)) ? 
                        `<button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.7rem; background: #8b5cf6; color: #fff;" onclick="student.openReportModal('${event._id}')">📊 Manage Report</button>` : ''}
                    <button class="btn" style="padding: 0.3rem 0.6rem; font-size: 0.7rem; background: #dc2626; color: #fff;" onclick="student.deleteEvent('${event._id}', '${event.title.replace(/'/g, "\\'")}')">🗑 Remove</button>
                </div>
            </div>
        `;
        };

        upcomingGrid.innerHTML = upcomingEvents.length === 0 ? '<p style="color: var(--text-muted);">No matching events.</p>' : 
            upcomingEvents.map(renderEvent).join("");

        completedGrid.innerHTML = completedEvents.length === 0 ? '<p style="color: var(--text-muted);">No matching events.</p>' : 
            completedEvents.map(renderEvent).join("");
    },

    loadMyProposals: async () => {
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/status", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            student.allProposals = await res.json();
            student.filterProposals();
        } catch (err) {
            const grid = document.getElementById("my-proposals-grid");
            if (grid) grid.innerHTML = "<p>Error loading proposals</p>";
        }
    },

    filterProposals: () => {
        const searchInput = document.getElementById("proposal-search");
        const grid = document.getElementById("my-proposals-grid");
        
        if (!grid) return;
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
        
        const filtered = student.allProposals.filter(e => 
            e.status !== "published" && e.status !== "completed" && e.title.toLowerCase().includes(searchTerm)
        );

        grid.innerHTML = filtered.length === 0 ? '<p style="color: var(--text-muted);">No matching proposals.</p>' : 
            filtered.map(event => `
            <div class="card" style="border-left: 4px solid ${event.status === 'rejected' ? 'var(--accent)' : 'var(--warning)'}; margin-bottom: 1rem;">
                <h3>${event.title}</h3>
                <p style="color: ${event.status === 'rejected' ? 'var(--accent)' : 'var(--warning)'}; font-size: 0.8rem; font-weight: 600;">
                    ${event.status === 'rejected' 
                        ? (event.staffApproved ? 'REJECTED BY HOD' : 'REJECTED BY STAFF') 
                        : event.status.replace(/_/g, ' ').toUpperCase()}
                </p>
                ${event.status === 'rejected' ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.3rem 0;"><em>${event.staffApproved ? (event.hodFeedback || '') : (event.staffFeedback || '')}</em></p>` : ''}
                <p style="margin: 0.5rem 0; font-size: 0.9rem;">${event.description.substring(0, 100)}...</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">📍 ${event.venue}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="student.openEditModal('${escape(JSON.stringify(event))}')">Update & Resend</button>
                        <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="showSection('workflow')">View Workflow</button>
                    </div>
                </div>
            </div>
        `).join("");
    },

    checkWorkflowVisibility: async () => {
        const token = auth.getToken();
        if (!token) {
            console.warn("⚠️ No auth token found for student, skipping workflow visibility check.");
            return;
        }

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/status", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!res.ok) {
                if (res.status === 401) {
                    console.error("🚫 Unauthorized: Token may be expired or invalid.");
                    return;
                }
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const events = await res.json();
            const activeEvents = events.filter(e => e.status !== "published" && e.status !== "completed");
            
            const nav = document.getElementById("workflow-nav");
            if (nav) nav.style.display = "block";
        } catch (err) {
            console.error("❌ Failed to check workflow visibility:", err.message);
        }
    },

    loadWorkflowEvents: async () => {
        const container = document.getElementById("workflow-events-container");
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/status", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const events = await res.json();
            const workflowEvents = events.filter(e => e.status !== "published" && e.status !== "completed");
            
            if (workflowEvents.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted);">No active workflow events for your club.</p>';
                return;
            }

            container.innerHTML = workflowEvents.map(event => {
                const isStaffApproved = event.staffApproved === true;
                const isRejectedByStaff = event.status === 'rejected' && !event.staffApproved;
                const isRejectedByHod = event.status === 'rejected' && event.staffApproved;
                
                return `
                <div class="card" style="margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3>${event.title}</h3>
                            <p style="color: ${event.status === 'rejected' ? 'var(--accent)' : 'var(--warning)'}; font-size: 0.8rem;">${event.status.replace(/_/g, " ").toUpperCase()}</p>
                        </div>
                    </div>

                    <div class="workflow-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
                        <div class="step-item ${event.status === 'pending_staff_approval' || isRejectedByStaff ? 'active' : ''}" style="${isRejectedByStaff ? 'border-color: var(--accent);' : ''}">
                            <small>Step 1</small>
                            <h4>Staff Approval</h4>
                            <span class="badge ${isRejectedByStaff ? 'badge-danger' : (isStaffApproved ? 'badge-success' : 'badge-warning')}">
                                ${isRejectedByStaff ? '✖ Rejected' : (isStaffApproved ? '✓ Approved' : '⧖ Pending')}
                            </span>
                            ${isRejectedByStaff && event.staffFeedback ? `
                                <div style="margin-top: 0.5rem; font-size: 0.7rem; color: var(--accent);">
                                    <strong>Reason:</strong> ${event.staffFeedback}
                                </div>
                            ` : ''}
                        </div>

                        <div class="step-item ${!isStaffApproved ? 'locked' : ''}">
                            <small>Step 2</small>
                            <h4>Poster</h4>
                            ${event.posterImage ? 
                                `<button class="btn btn-secondary" onclick="student.viewDocument('${event.posterImage}')">View Poster</button>` :
                                `<button class="btn btn-primary" onclick="student.openPosterModal('${escape(JSON.stringify(event))}')" ${!isStaffApproved ? 'disabled' : ''}>Prepare Poster</button>`
                            }
                        </div>

                        <div class="step-item ${!isStaffApproved ? 'locked' : ''}">
                            <small>Step 3</small>
                            <h4>Registration</h4>
                            ${event.registrationLink ? 
                                `<button class="btn btn-secondary" onclick="window.open('http://localhost:5173/register.html?id=${event._id}', '_blank')">View Link</button>` :
                                `<button class="btn btn-primary" onclick="student.openRegistrationModal('${event._id}')" ${!isStaffApproved ? 'disabled' : ''}>Setup Link</button>`
                            }
                        </div>

                        <div class="step-item ${!isStaffApproved ? 'locked' : ''}">
                            <small>Step 4</small>
                            <h4>Circular</h4>
                            ${event.circularPdf ? 
                                `<button class="btn btn-secondary" onclick="student.viewDocument('${event.circularPdf}')">View Circular</button>` :
                                `<button class="btn btn-primary" onclick="student.openCircularModal('${escape(JSON.stringify(event))}')" ${!isStaffApproved ? 'disabled' : ''}>Prepare Circular</button>`
                            }
                        </div>

                        <div class="step-item ${event.status === 'pending_hod_approval' || isRejectedByHod ? 'active' : (event.status === 'published' ? '' : 'locked')}" style="${isRejectedByHod ? 'border-color: var(--accent);' : ''}">
                            <small>Step 5</small>
                            <h4>HOD Approval</h4>
                            <span class="badge ${isRejectedByHod ? 'badge-danger' : (event.status === 'published' ? 'badge-success' : 'badge-warning')}">
                                ${event.status === 'published' ? '✓ Approved' : (isRejectedByHod ? '✖ Rejected' : '⧖ Pending')}
                            </span>
                            ${isRejectedByHod && event.hodFeedback ? `
                                <div style="margin-top: 0.5rem; font-size: 0.7rem; color: var(--accent);">
                                    <strong>Reason:</strong> ${event.hodFeedback}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${event.status === 'rejected' ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                            <button class="btn btn-primary" style="width: 100%; height: auto; padding: 0.8rem;" onclick="student.openEditModal('${escape(JSON.stringify(event))}')">Update & Resend Proposal</button>
                        </div>
                    ` : ''}

                    ${event.posterImage && event.registrationLink && event.circularPdf && event.status === 'circular_creation_pending' ? `
                        <div style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
                            <button class="btn btn-primary" style="width: 100%;" onclick="student.submitToHod('${event._id}')">Submit to HOD (Step 5)</button>
                        </div>
                    ` : (isStaffApproved && event.status === 'circular_creation_pending' ? `<p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.8rem;">Complete Steps 2-4 to enable HOD submission.</p>` : '')}

                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                        <button class="btn" style="width: 100%; background: #dc2626; color: #fff; padding: 0.6rem;" onclick="student.deleteEvent('${event._id}', '${event.title.replace(/'/g, "\\'")}')">🗑 Remove Event</button>
                    </div>
                </div>
            `}).join("");
        } catch (err) {
            container.innerHTML = "<p>Error loading workflow</p>";
        }
    },

    openPosterModal: async (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        document.getElementById("poster-event-id").value = event._id;
        document.getElementById("poster-title").value = event.title;
        document.getElementById("poster-club").value = event.clubId?.clubName || "";
        document.getElementById("poster-venue").value = event.venue;
        document.getElementById("poster-date").value = event.date.split('T')[0];
        document.getElementById("poster-time").value = event.time || "";
        document.getElementById("poster-end-time").value = event.endTime || "";
        document.getElementById("poster-rules").value = event.rules || "";
        document.getElementById("poster-coord-1").value = auth.getUser().name;
        document.getElementById("poster-dept").value = event.department || "";
        document.getElementById("poster-template").value = "1";
        document.getElementById("poster-tagline").value = event.posterTagline || "";
        
        const select = document.getElementById("poster-coord-2");
        select.innerHTML = '<option value="">Loading...</option>';
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/clubs", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const clubs = await res.json();
            const clubIdStr = event.clubId?._id || event.clubId;
            const myClub = clubs.find(c => c._id === clubIdStr);
            
            if (myClub && myClub.members) {
                const currentUser = auth.getUser();
                const membersHtml = myClub.members
                    .filter(m => m._id !== currentUser.id && m._id !== event.createdBy) 
                    .map(m => `<option value="${m.name}">${m.name} (${m.registerNumber || m.department || 'Student'})</option>`)
                    .join("");
                select.innerHTML = '<option value="">-- Choose Student Coordinator --</option>' + membersHtml;
            } else {
                select.innerHTML = '<option value="">-- Choose Student Coordinator --</option>';
            }
        } catch (err) {
            select.innerHTML = '<option value="">Error loading</option>';
        }
        
        document.getElementById("poster-modal").classList.add("show");
    },

    handlePosterSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("poster-event-id").value;
        const posterData = {
            templateId: document.getElementById("poster-template").value,
            tagline: document.getElementById("poster-tagline").value,
            title: document.getElementById("poster-title").value,
            clubName: document.getElementById("poster-club").value,
            venue: document.getElementById("poster-venue").value,
            date: document.getElementById("poster-date").value,
            time: document.getElementById("poster-time").value,
            endTime: document.getElementById("poster-end-time").value,
            rules: document.getElementById("poster-rules").value,
            organizerName: document.getElementById("poster-coord-2").value 
                ? `${document.getElementById("poster-coord-1").value}, ${document.getElementById("poster-coord-2").value}` 
                : document.getElementById("poster-coord-1").value,
            departmentName: document.getElementById("poster-dept").value
        };

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/generate-poster`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify(posterData)
            });
            if (res.ok) {
                alert("Poster generated and details updated!");
                document.getElementById("poster-modal").classList.remove("show");
                student.loadWorkflowEvents();
            }
        } catch (err) { alert("Failed to generate poster"); }
    },

    openRegistrationModal: (id) => {
        document.getElementById("reg-event-id").value = id;
        document.getElementById("registration-modal").classList.add("show");
    },

    handleRegistrationSetupSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("reg-event-id").value;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/create-registration`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Registration link generated!");
                document.getElementById("registration-modal").classList.remove("show");
                student.loadWorkflowEvents();
            }
        } catch (err) { alert("Failed to setup registration"); }
    },

    openCircularModal: (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        document.getElementById("circular-event-id").value = event._id;
        document.getElementById("circular-rules").value = event.rules || "";
        document.getElementById("circular-association").value = event.associationName || `${event.clubId?.clubName || 'CLUB'} ASSOCIATION`.toUpperCase();
        
        const preview = document.getElementById("circular-preview-details");
        preview.innerHTML = `
            <strong>Title:</strong> ${event.title}<br>
            <strong>Date/Time:</strong> ${new Date(event.date).toLocaleDateString()} at ${event.time || 'N/A'} - ${event.endTime || 'N/A'}<br>
            <strong>Venue:</strong> ${event.venue}<br>
            <strong>Club:</strong> ${event.clubId?.clubName || 'N/A'}
        `;
        
        document.getElementById("circular-modal").classList.add("show");
    },

    handleCircularSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("circular-event-id").value;
        const rules = document.getElementById("circular-rules").value;
        const associationName = document.getElementById("circular-association").value;
        
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/generate-circular`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ rules, associationName })
            });
            if (res.ok) {
                alert("Circular generated!");
                document.getElementById("circular-modal").classList.remove("show");
                student.loadWorkflowEvents();
            }
        } catch (err) { alert("Failed to generate circular"); }
    },

    viewDocument: (url) => {
        if (!url || url === 'undefined') return alert("Document not available yet");
        if (url.startsWith('http')) {
            window.open(url, '_blank');
        } else if (url.startsWith('/')) {
            // Frontend pages (e.g. /register.html) should open via the frontend origin
            const origin = url.includes('.html') ? window.location.origin : 'https://smart-event-and-attendance-management.onrender.com';
            window.open(`${origin}${url}`, '_blank');
        } else {
            window.open(`https://smart-event-and-attendance-management.onrender.com/${url}`, '_blank');
        }
    },

    openEditModal: (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        document.getElementById("edit-event-id").value = event._id;
        document.getElementById("edit-title").value = event.title;
        document.getElementById("edit-desc").value = event.description;
        document.getElementById("edit-date").value = event.date.split('T')[0];
        document.getElementById("edit-time").value = event.time || "";
        document.getElementById("edit-end-time").value = event.endTime || "";
        document.getElementById("edit-venue").value = event.venue;
        document.getElementById("edit-rules").value = event.rules || "";
        document.getElementById("edit-contact").value = event.contactDetails || "";
        
        const type = event.isTeamEvent ? "Team" : "Individual";
        document.getElementById("edit-participation-type").value = type;
        student.onParticipationTypeChange(type, 'edit-max-participants-group', 'edit-max-team-group');
        
        document.getElementById("edit-max-participants").value = event.maxParticipants || 0;
        document.getElementById("edit-max-teams").value = event.maxTeams || 0;
        document.getElementById("edit-max-team-size").value = event.maxTeamSize || 2;
        
        document.querySelectorAll('#edit-allowed-years input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#edit-allowed-depts input').forEach(cb => cb.checked = false);
        if (event.allowedYears) {
            document.querySelectorAll('#edit-allowed-years input').forEach(cb => {
                if (event.allowedYears.includes(parseInt(cb.value))) cb.checked = true;
            });
        }
        if (event.allowedDepartments) {
            document.querySelectorAll('#edit-allowed-depts input').forEach(cb => {
                if (event.allowedDepartments.includes(cb.value)) cb.checked = true;
            });
        }
        
        const feedbackMsg = document.getElementById("edit-feedback-msg");
        if (event.status === 'rejected') {
            let reason = '';
            if (event.staffApproved && event.hodFeedback) {
                reason = `HOD Rejected: ${event.hodFeedback}`;
            } else if (event.staffFeedback) {
                reason = `Staff Rejected: ${event.staffFeedback}`;
            } else {
                reason = 'Rejected. No specific feedback provided.';
            }
            feedbackMsg.textContent = reason;
            feedbackMsg.style.display = 'block';
        } else {
            feedbackMsg.style.display = 'none';
        }

        document.getElementById("edit-modal").classList.add("show");
    },

    handleUpdateSubmit: async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit-event-id").value;
        const allowedYears = Array.from(document.querySelectorAll('#edit-allowed-years input:checked')).map(cb => parseInt(cb.value));
        const allowedDepts = Array.from(document.querySelectorAll('#edit-allowed-depts-group input:checked')).map(cb => cb.value);

        if (allowedYears.length === 0) {
            return alert("Please select at least one allowed year.");
        }

        const user = auth.getUser();
        // For associations, force their own department
        let finalDepts = allowedDepts;
        if (user.associationId && user.department) {
            finalDepts = [user.department];
        }

        const updateData = {
            title: document.getElementById("edit-title").value,
            description: document.getElementById("edit-desc").value,
            date: document.getElementById("edit-date").value,
            time: document.getElementById("edit-time").value,
            endTime: document.getElementById("edit-end-time").value,
            venue: document.getElementById("edit-venue").value,
            rules: document.getElementById("edit-rules").value,
            contactDetails: document.getElementById("edit-contact").value,
            memberDetails: document.getElementById("edit-participation-type").value,
            isTeamEvent: document.getElementById("edit-participation-type").value === 'Team',
            maxParticipants: parseInt(document.getElementById("edit-max-participants").value) || 0,
            maxTeams: parseInt(document.getElementById("edit-max-teams").value) || 0,
            maxTeamSize: parseInt(document.getElementById("edit-max-team-size").value) || 1,
            allowedYears: allowedYears,
            allowedDepartments: finalDepts
        };

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/update`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(updateData),
            });
            if (res.ok) {
                document.getElementById("edit-modal").classList.remove("show");
                student.loadMyProposals();
                student.loadWorkflowEvents();
                await student.checkWorkflowVisibility();
                alert("Event updated and resubmitted successfully!");
            } else {
                const data = await res.json();
                alert(data.message);
            }
        } catch (err) {
            alert("Error updating event");
        }
    },

    createRegLink: async (id) => {
        try {
            await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/create-registration`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            alert("Registration enabled!");
            student.loadWorkflowEvents();
        } catch (err) { alert("Failed to enable registration"); }
    },

    createFeedbackLink: async (id) => {
        try {
            await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/create-feedback`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            alert("Feedback form ready!");
            student.loadWorkflowEvents();
        } catch (err) { alert("Failed to setup feedback"); }
    },

    submitToHod: async (id) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${id}/submit-hod`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Submitted to HOD successfully!");
                student.loadWorkflowEvents();
                await student.checkWorkflowVisibility();
            }
        } catch (err) { alert("Submission failed"); }
    },

    submitEvent: async (e) => {
        e.preventDefault();
        const user = auth.getUser();
        if (!user.clubName) return alert("No club assigned");

        const allowedYears = Array.from(document.querySelectorAll('#allowed-years input:checked')).map(cb => parseInt(cb.value));
        const allowedDepts = Array.from(document.querySelectorAll('#allowed-depts-group input:checked')).map(cb => cb.value);

        if (allowedYears.length === 0) {
            return alert("Please select at least one allowed year.");
        }

        // For associations, force their own department
        let finalDepts = allowedDepts;
        if (user.associationId && user.department) {
            finalDepts = [user.department];
        }

        const eventData = {
            title: document.getElementById("event-title").value,
            description: document.getElementById("event-desc").value,
            date: document.getElementById("event-date").value,
            time: document.getElementById("event-time").value,
            endTime: document.getElementById("event-end-time").value,
            venue: document.getElementById("event-venue").value,
            rules: document.getElementById("event-rules").value,
            contactDetails: document.getElementById("event-contact").value,
            memberDetails: document.getElementById("participation-type").value,
            selectedStaff: document.getElementById("staff-coordinator").value,
            isTeamEvent: document.getElementById("participation-type").value === 'Team',
            maxParticipants: parseInt(document.getElementById("max-participants").value) || 0,
            maxTeams: parseInt(document.getElementById("max-teams").value) || 0,
            maxTeamSize: parseInt(document.getElementById("max-team-size").value) || 1,
            allowedYears: allowedYears,
            allowedDepartments: finalDepts
        };

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/events/create", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(eventData),
            });
            if (res.ok) {
                document.getElementById("event-msg").textContent = "Proposal submitted! Pending staff approval.";
                document.getElementById("event-msg").style.color = "var(--success)";
                document.getElementById("event-form").reset();
                await student.checkWorkflowVisibility();
                setTimeout(() => showSection('workflow'), 1500);
            } else {
                const data = await res.json();
                document.getElementById("event-msg").textContent = data.message;
                document.getElementById("event-msg").style.color = "var(--accent)";
            }
        } catch (err) {
            alert("Error submitting proposal");
        }
    },

    deleteEvent: async (eventId, eventTitle) => {
        if (!confirm(`Are you sure you want to remove "${eventTitle}"? This will also delete all registrations for this event. This action cannot be undone.`)) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${eventId}/delete`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Event removed successfully!");
                await student.loadPublishedEvents();
                student.loadWorkflowEvents();
                await student.checkWorkflowVisibility();
            } else {
                const data = await res.json();
                alert(data.message || "Failed to remove event");
            }
        } catch (err) {
            alert("Error removing event");
        }
    },

    viewRegistrations: async (eventId, eventTitle) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${eventId}/registrations`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const registrations = await res.json();
            
            const modal = document.getElementById("registrations-modal");
            document.getElementById("reg-modal-title").textContent = `Registered Students - ${eventTitle}`;
            document.getElementById("reg-modal-count").textContent = `Total Students: ${registrations.length}`;
            
            const tbody = document.getElementById("reg-modal-tbody");
            const thead = tbody.closest('table').querySelector('thead tr');
            if (thead && !thead.innerHTML.includes('Role')) {
                thead.innerHTML += '<th>Role</th><th>Status</th>';
            }
            if (registrations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No registrations yet.</td></tr>';
            } else {
                tbody.innerHTML = registrations.map((reg, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${reg.studentName}</td>
                        <td>${reg.registerNumber || 'N/A'}</td>
                        <td>${reg.department || 'N/A'}</td>
                        <td>${reg.email}</td>
                        <td><span class="badge ${reg.isTeammate ? 'badge-secondary' : 'badge-primary'}">${reg.isTeammate ? 'Teammate' : 'Leader'}</span></td>
                        <td><span class="badge ${reg.attended ? 'badge-success' : 'badge-warning'}">${reg.attended ? 'Attended' : 'Pending'}</span></td>
                    </tr>
                `).join("");
            }
            
            modal.classList.add("show");

            // Setup Excel Export
            const exportBtn = document.getElementById("export-excel-btn");
            exportBtn.onclick = () => student.downloadExcel(eventId, eventTitle);
        } catch (err) {
            alert("Failed to load registrations. You may not have access.");
        }
    },

    openPublishedEventModal: (eventJson) => {
        const event = JSON.parse(unescape(eventJson));
        document.getElementById("pub-modal-title").textContent = event.title;
        document.getElementById("pub-modal-club").textContent = event.clubId?.clubName || "Club";
        
        const posterImg = document.getElementById("pub-poster-img");
        if (event.posterImage) {
            posterImg.src = `https://smart-event-and-attendance-management.onrender.com${event.posterImage}`;
            posterImg.style.display = "inline-block";
        } else {
            posterImg.style.display = "none";
        }

        const viewCircular = document.getElementById("pub-view-circular");
        viewCircular.onclick = () => student.viewDocument(event.circularPdf);

        const copyLink = document.getElementById("pub-copy-link");
        const regUrl = `http://localhost:5173/register.html?id=${event._id}`;
        document.getElementById("pub-reg-url").textContent = regUrl;
        
        copyLink.onclick = () => {
            navigator.clipboard.writeText(regUrl);
            alert("Link copied to clipboard!");
        };

        document.getElementById("published-event-modal").classList.add("show");
    },

    downloadExcel: async (eventId, eventTitle) => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${eventId}/export-attendance`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (!res.ok) throw new Error("Failed to export");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `registrations_${eventTitle.replace(/\s+/g, '_')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert("Export failed: " + err.message);
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
            document.getElementById("display-role").textContent = (user.role || "student").toUpperCase();
            document.getElementById("view-email").textContent = user.email || "-";
            document.getElementById("view-phone").textContent = user.phone || "Not provided";
            document.getElementById("view-reg").textContent = user.registerNumber || "Not provided";
            document.getElementById("view-dept").textContent = user.department || "Not provided";
            document.getElementById("view-bio").textContent = user.bio || "No bio added yet.";
            
            const pic = user.profilePic ? `https://smart-event-and-attendance-management.onrender.com${user.profilePic}` : "../assets/default-avatar.png";
            document.getElementById("profile-pic-display").src = pic;

            // Edit Mode
            document.getElementById("profile-name").value = user.name || "";
            document.getElementById("profile-email").value = user.email || "";
            document.getElementById("profile-phone").value = user.phone || "";
            document.getElementById("profile-reg-no-input").value = user.registerNumber || "";
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
            registerNumber: document.getElementById("profile-reg-no-input").value,
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
                // Update local storage
                const currentUser = auth.getUser();
                const updatedUser = { ...currentUser, ...data };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                
                // Update UI
                document.getElementById("welcome-msg").textContent = `Welcome, ${updatedUser.name}`;
                student.loadProfile();
                student.toggleProfileEdit(false);
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

    currentFeedbackEventId: null,
    currentFeedbackFormId: null,
    currentFeedbackQuestions: [],

    openFeedbackModal: async (eventId) => {
        student.currentFeedbackEventId = eventId;
        student.currentFeedbackFormId = null;
        student.currentFeedbackQuestions = [];
        
        const modal = document.getElementById("feedback-modal");
        document.getElementById("feedback-not-created").style.display = "none";
        document.getElementById("feedback-form-editor").style.display = "none";
        document.getElementById("feedback-published-view").style.display = "none";
        document.getElementById("download-zip-btn").style.display = "none";
        
        try {
            // Fetch Event Details too
            const [formRes, eventRes] = await Promise.all([
                fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form/event/${eventId}`, {
                    headers: { "Authorization": `Bearer ${auth.getToken()}` }
                }),
                fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/status?id=${eventId}`, {
                    headers: { "Authorization": `Bearer ${auth.getToken()}` }
                })
            ]);

            const allEvents = await eventRes.json();
            const currentEvent = allEvents.find(e => e._id === eventId);
            
            if (currentEvent) {
                // Update Button Labels based on state
                const certBtn = document.getElementById("certificate-btn");
                if (currentEvent.certificatesSent) {
                    certBtn.textContent = "Resend Certificate";
                } else {
                    certBtn.textContent = "Generate & Send Certificate";
                }

                const regBtn = document.getElementById("toggle-reg-btn");
                if (currentEvent.registrationEnabled) {
                    regBtn.textContent = "Close Registration";
                    regBtn.style.background = "#64748b";
                } else {
                    regBtn.textContent = "Open Registration";
                    regBtn.style.background = "#2ecc71";
                }
            }

            if (formRes.status === 404) {
                document.getElementById("feedback-not-created").style.display = "block";
            } else if (formRes.ok) {
                const form = await formRes.json();
                student.currentFeedbackFormId = form._id;
                student.currentFeedbackQuestions = form.questions || [];
                
                if (form.isPublished) {
                    document.getElementById("feedback-published-view").style.display = "block";
                    student.currentFeedbackLink = form.feedbackLink;
                    student.currentFeedbackQR = form.qrCodeUrl;
                    // Only show ZIP download if the event is completed or certificates sent
                    if (currentEvent?.certificatesSent || currentEvent?.status === 'completed') {
                        document.getElementById("download-zip-btn").style.display = "block";
                    }
                } else {
                    document.getElementById("feedback-form-editor").style.display = "block";
                    // Populate time fields if they exist
                    if (form.startTime) document.getElementById("feedback-start-time").value = new Date(form.startTime).toISOString().slice(0, 16);
                    if (form.endTime) document.getElementById("feedback-end-time").value = new Date(form.endTime).toISOString().slice(0, 16);
                    student.renderFeedbackQuestions();
                }
            } else {
                alert("Error loading feedback form");
            }
        } catch (err) {
            console.error(err);
        }
        modal.classList.add("show");
    },

    createFeedbackForm: async () => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ eventId: student.currentFeedbackEventId })
            });
            if (res.ok) {
                alert("Feedback form created with default questions.");
                student.openFeedbackModal(student.currentFeedbackEventId);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to create form");
            }
        } catch (err) { alert("Error creating form"); }
    },

    renderFeedbackQuestions: () => {
        const container = document.getElementById("feedback-questions-container");
        container.innerHTML = student.currentFeedbackQuestions.map((q, idx) => `
            <div class="card" style="padding: 1rem; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Question ${idx + 1}</strong>
                    <button class="btn" style="background: var(--accent); color: white; padding: 0.2rem 0.5rem; font-size: 0.7rem;" onclick="student.removeFeedbackQuestion(${idx})">✖ Remove</button>
                </div>
                <input type="text" value="${q.questionText}" onchange="student.currentFeedbackQuestions[${idx}].questionText = this.value" placeholder="Question Text" 
                    style="padding: 0.6rem; width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white;">
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <label style="font-size: 0.8rem;">Type:</label>
                    <select onchange="student.currentFeedbackQuestions[${idx}].type = this.value" 
                        style="padding: 0.4rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; outline: none;">
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>Text Response</option>
                        <option value="rating" ${q.type === 'rating' ? 'selected' : ''}>Rating (1-5)</option>
                        <option value="boolean" ${q.type === 'boolean' ? 'selected' : ''}>Yes/No</option>
                    </select>
                    <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem;">
                        <input type="checkbox" ${q.required ? 'checked' : ''} onchange="student.currentFeedbackQuestions[${idx}].required = this.checked"> Required
                    </label>
                </div>
            </div>
        `).join("");
    },

    addFeedbackQuestion: () => {
        student.currentFeedbackQuestions.push({ questionText: "New Question", type: "text", required: false });
        student.renderFeedbackQuestions();
    },

    removeFeedbackQuestion: (index) => {
        student.currentFeedbackQuestions.splice(index, 1);
        student.renderFeedbackQuestions();
    },

    saveFeedbackQuestions: async () => {
        const startTime = document.getElementById("feedback-start-time").value;
        const endTime = document.getElementById("feedback-end-time").value;
        
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form/${student.currentFeedbackFormId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ 
                    questions: student.currentFeedbackQuestions,
                    startTime: startTime,
                    endTime: endTime
                })
            });
            if (res.ok) {
                alert("Form settings and questions saved successfully.");
            } else {
                alert("Failed to save changes.");
            }
        } catch (err) { alert("Error saving form"); }
    },

    publishFeedbackForm: async () => {
        if (!confirm("Are you sure you want to publish this feedback form? You won't be able to edit the questions afterwards.")) return;
        try {
            await student.saveFeedbackQuestions(); // Save first just in case
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form/${student.currentFeedbackFormId}/publish`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (res.ok) {
                alert("Feedback form published successfully! It is now visible to registered students.");
                student.openFeedbackModal(student.currentFeedbackEventId);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to publish");
            }
        } catch (err) { alert("Error publishing form"); }
    },

    downloadFinalAttendance: async () => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback/excel/${student.currentFeedbackEventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to export");
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `final_attendance_${student.currentFeedbackEventId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert("Export failed: " + err.message);
        }
    },

    generateCertificates: async () => {
        const btn = document.getElementById("certificate-btn");
        const isResend = btn && btn.textContent.trim() === "Resend Certificate";
        
        if (!confirm(`This will ${isResend ? 're-send' : 'generate and send'} certificates for all students who submitted feedback. Proceed?`)) return;
        
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/certificate/generate/${student.currentFeedbackEventId}`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify({ resend: isResend })
            });
            const data = await res.json();
            if (res.ok) {
                document.getElementById("download-zip-btn").style.display = "block";
                const detail = [
                    `✅ Certificates Generated: ${data.sent ?? '?'}`,
                    data.skipped > 0 ? `⏭️ Already existed: ${data.skipped}` : null,
                    data.failed > 0 ? `❌ Email delivery failed for ${data.failed} student(s).` : null,
                    `\n📦 You can now download all certificates as a ZIP file.`
                ].filter(Boolean).join('\n');
                alert(`${data.message}\n\n${detail}`);
            } else {
                alert(data.message || "Failed to generate certificates");
            }
        } catch (err) {
            alert("Error generating certificates");
        }
    },

    showFeedbackQR: async () => {
        const id = student.currentFeedbackEventId;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form/event/${id}/qr`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            if (res.ok) {
                student.currentFeedbackLink = data.feedbackUrl;
                student.currentFeedbackQR = data.qrDataUrl;
                
                document.getElementById("qr-image").src = data.qrDataUrl;
                document.getElementById("qr-link").textContent = data.feedbackUrl;
                document.getElementById("qr-title").textContent = `Feedback for ${document.getElementById("feedback-modal-title").textContent.replace('Manage Feedback - ', '')}`;
                document.getElementById("qr-club").textContent = auth.getUser().clubName || "National Engineering College";
                document.getElementById("qr-projection-modal").classList.add("show");
            } else {
                alert(data.message || "Failed to load QR code");
            }
        } catch (err) {
            alert("Error loading QR code");
        }
    },

    copyFeedbackLink: () => {
        if (!student.currentFeedbackLink) return alert("Link not available. Try refreshing.");
        navigator.clipboard.writeText(student.currentFeedbackLink);
        alert("Feedback link copied to clipboard!");
    },

    downloadFeedbackQR: () => {
        if (!student.currentFeedbackQR) return alert("QR code not available. Try refreshing.");
        const a = document.createElement("a");
        a.href = student.currentFeedbackQR;
        a.download = `Feedback_QR_${student.currentFeedbackEventId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    downloadCertificatesZip: async () => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/certificate/download-zip/${student.currentFeedbackEventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to download ZIP");
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Certificates_${student.currentFeedbackEventId}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert("Download failed: " + err.message);
        }
    },

    toggleRegistration: async () => {
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${student.currentFeedbackEventId}/toggle-registration`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                student.openFeedbackModal(student.currentFeedbackEventId);
                student.loadPublishedEvents();
            } else {
                alert(data.message || "Failed to toggle registration");
            }
        } catch (err) { alert("Error toggling registration"); }
    },

    closeEvent: async () => {
        if (!confirm("Are you sure you want to close this event? This will mark it as completed and remove it from upcoming lists.")) return;
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/${student.currentFeedbackEventId}/close`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert("Event marked as completed successfully.");
                document.getElementById("feedback-modal").classList.remove("show");
                student.loadPublishedEvents();
            } else {
                alert(data.message || "Failed to close event");
            }
        } catch (err) { alert("Error closing event"); }
    },

    extendFeedbackTime: async () => {
        const endTime = document.getElementById("extend-feedback-endtime").value;
        if (!endTime) return alert("Please select a new end time.");

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback-form/${student.currentFeedbackFormId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${auth.getToken()}` },
                body: JSON.stringify({ endTime })
            });

            if (res.ok) {
                alert("Feedback time extended successfully!");
                student.openFeedbackModal(student.currentFeedbackEventId);
            } else {
                const data = await res.json();
                alert(data.message || "Failed to extend time");
            }
        } catch (err) {
            alert("Error extending feedback time");
        }
    },

    // --- 📝 REPORT MANAGEMENT FUNCTIONS ---
    openReportModal: async (eventId) => {
        const modal = document.getElementById("report-modal");
        document.getElementById("report-event-id").value = eventId;
        
        // Clear containers
        document.getElementById("report-rounds-container").innerHTML = "";
        document.getElementById("report-winners-container").innerHTML = "";
        document.getElementById("report-photos-preview").innerHTML = "";
        document.getElementById("report-form").reset();

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/reports/${eventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const data = await res.json();

            if (data && data._id) {
                // Populate existing report
                document.getElementById("report-description").value = data.description || "";
                document.getElementById("report-staff-coord").value = data.staffCoordinator || "";
                document.getElementById("report-hod").value = data.hod || "";
                document.getElementById("report-dean").value = data.dean || "";
                document.getElementById("report-principal").value = data.principal || "";

                if (data.rounds) data.rounds.forEach(r => student.addReportRound(r.roundName, r.roundDescription));
                if (data.winners) data.winners.forEach(w => student.addReportWinner(w.studentName, w.registerNumber, w.email, w.year, w.department, w.ranking));
                if (data.photos) data.photos.forEach(p => student.renderReportPhoto(p.url));
            } else if (data.eventDetails) {
                // Auto-fill from event
                document.getElementById("report-description").value = data.eventDetails.description || "";
            }
            
            // Add initial empty rows if none exist
            if (document.getElementById("report-rounds-container").children.length === 0) student.addReportRound();
            if (document.getElementById("report-winners-container").children.length === 0) student.addReportWinner();

            modal.classList.add("show");
        } catch (err) {
            alert("Error loading report data");
        }
    },

    addReportRound: (name = "", desc = "") => {
        const container = document.getElementById("report-rounds-container");
        const div = document.createElement("div");
        div.className = "report-round-item";
        div.style = "display: flex; gap: 0.5rem; margin-bottom: 0.5rem;";
        div.innerHTML = `
            <input type="text" placeholder="Round Name" value="${name}" class="round-name" style="flex: 1; background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.05); color: white; padding: 0.5rem; border-radius: 4px;">
            <input type="text" placeholder="Description" value="${desc}" class="round-desc" style="flex: 2; background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.05); color: white; padding: 0.5rem; border-radius: 4px;">
            <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #ff5f5f; cursor: pointer;">✕</button>
        `;
        container.appendChild(div);
    },

    addReportWinner: (name = "", registerNumber = "", email = "", year = "", dept = "", rank = "") => {
        const container = document.getElementById("report-winners-container");
        const div = document.createElement("div");
        div.className = "report-winner-item";
        div.style = "display: grid; grid-template-columns: 1.5fr 1.5fr 1.5fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.8rem; background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 6px;";
        div.innerHTML = `
            <input type="text" placeholder="Name" value="${name}" class="winner-name" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.4rem; border-radius: 4px; font-size: 0.8rem;">
            <input type="text" placeholder="Reg No" value="${registerNumber}" class="winner-reg" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.4rem; border-radius: 4px; font-size: 0.8rem;">
            <select class="winner-rank" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,191,36,0.3); color: #fbbf24; padding: 0.4rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">
                <option value="" style="color: white;">Rank</option>
                <option value="1st" ${rank === '1st' ? 'selected' : ''}>🥇 1st Place</option>
                <option value="2nd" ${rank === '2nd' ? 'selected' : ''}>🥈 2nd Place</option>
                <option value="3rd" ${rank === '3rd' ? 'selected' : ''}>🥉 3rd Place</option>
            </select>
            <select class="winner-year" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.4rem; border-radius: 4px; font-size: 0.8rem;">
                <option value="">Year</option>
                <option value="1" ${year == '1' ? 'selected' : ''}>I</option>
                <option value="2" ${year == '2' ? 'selected' : ''}>II</option>
                <option value="3" ${year == '3' ? 'selected' : ''}>III</option>
                <option value="4" ${year == '4' ? 'selected' : ''}>IV</option>
            </select>
            <input type="text" placeholder="Dept" value="${dept}" class="winner-dept" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.4rem; border-radius: 4px; font-size: 0.8rem;">
            <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #ff5f5f; cursor: pointer;">✕</button>
        `;
        container.appendChild(div);
    },

    uploadReportPhoto: async (input) => {
        const file = input.files[0];
        if (!file) return;

        const token = auth.getToken();
        if (!token) {
            alert("Session expired. Please log in again.");
            window.location.href = "/login.html";
            return;
        }

        const formData = new FormData();
        formData.append("photo", file);

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/reports/upload-photo", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Upload failed");
            }

            const data = await res.json();
            student.renderReportPhoto(data.imageUrl);
        } catch (err) {
            console.error("Upload error:", err);
            alert("Photo upload failed: " + err.message);
        }
    },

    renderReportPhoto: (url) => {
        const preview = document.getElementById("report-photos-preview");
        const div = document.createElement("div");
        div.className = "report-photo-item";
        div.setAttribute("data-url", url);
        div.style = "position: relative; width: 100px; height: 100px;";
        div.innerHTML = `
            <img src="https://smart-event-and-attendance-management.onrender.com${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">
            <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; background: #ff4757; color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 10px;">✕</button>
        `;
        preview.appendChild(div);
    },

    saveReport: async (e) => {
        e.preventDefault();
        const eventId = document.getElementById("report-event-id").value;
        
        const rounds = Array.from(document.querySelectorAll(".report-round-item")).map(item => ({
            roundName: item.querySelector(".round-name").value,
            roundDescription: item.querySelector(".round-desc").value
        })).filter(r => r.roundName);

        const winners = Array.from(document.querySelectorAll(".report-winner-item")).map(item => ({
            studentName: item.querySelector(".winner-name").value,
            registerNumber: item.querySelector(".winner-reg").value,
            year: item.querySelector(".winner-year").value,
            department: item.querySelector(".winner-dept").value,
            ranking: item.querySelector(".winner-rank").value
        })).filter(w => w.studentName);

        const photos = Array.from(document.querySelectorAll(".report-photo-item")).map(item => ({
            url: item.getAttribute("data-url"),
            caption: ""
        }));

        const reportBody = {
            eventId,
            description: document.getElementById("report-description").value,
            rounds,
            winners,
            photos,
            staffCoordinator: document.getElementById("report-staff-coord").value,
            hod: document.getElementById("report-hod").value,
            dean: document.getElementById("report-dean").value,
            principal: document.getElementById("report-principal").value
        };

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/reports", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}` 
                },
                body: JSON.stringify(reportBody)
            });
            
            if (res.ok) {
                alert("Report saved successfully!");
                document.getElementById("report-modal").classList.remove("show");
            } else {
                const err = await res.json();
                alert("Error: " + err.message);
            }
        } catch (err) {
            alert("Failed to save report");
        }
    },

    downloadReport: async (format) => {
        const eventId = document.getElementById("report-event-id").value;
        if (!eventId) return;

        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/reports/${eventId}/${format}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            
            if (!res.ok) throw new Error("File generation failed");
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Report_${eventId}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert(`Could not download ${format.toUpperCase()}`);
        }
    },

    // --- 🏆 CLUB HUB FUNCTIONS ---
    loadAllClubs: async () => {
        const grid = document.getElementById("clubs-grid");
        if (!grid) return;
        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/clubs", {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const clubs = await res.json();
            
            if (clubs.length === 0) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No clubs available at the moment.</p>';
                return;
            }

            const user = auth.getUser();
            grid.innerHTML = clubs.map(club => {
                const isMember = (club.members || []).some(m => (m._id || m) === user._id) || 
                                (club.studentCoordinators || []).some(m => (m._id || m) === user._id);
                
                const isPending = club.joinRequests?.some(r => (r.studentId?._id || r.studentId) === user._id && r.status === 'pending');
                const isOpen = club.membershipType === 'open' && !club.isPaidMembership;
                const hasLimit = club.memberLimit > 0;
                const isFull = hasLimit && (club.members?.length || 0) >= club.memberLimit;
                
                return `
                    <div class="card">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <h3 style="color: var(--primary); margin: 0;">${club.clubName}</h3>
                            <div style="text-align: right;">
                                <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; display: block; margin-bottom: 0.3rem;">${club.clubType}</span>
                                ${club.isPaidMembership ? `<span style="color: #fbbf24; font-weight: bold; font-size: 0.8rem;">₹${club.membershipFee}</span>` : '<span style="color: #22c55e; font-size: 0.75rem;">FREE</span>'}
                            </div>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4; height: 3.2rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${club.description || 'Discover opportunities and grow with our club activities.'}</p>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-muted);">
                                <span style="display: block;">Members: <strong>${club.members?.length || 0}${hasLimit ? ` / ${club.memberLimit}` : ''}</strong></span>
                            </div>
                            ${isMember ? 
                                '<span class="badge" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">✓ Member</span>' : 
                                (isPending ? 
                                    '<span class="badge" style="background: rgba(251, 191, 36, 0.1); color: #fbbf24;">🕒 Pending</span>' :
                                    (isFull ? 
                                        '<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">Full</span>' :
                                        `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="student.openJoinClubModal('${club._id}', '${club.clubName.replace(/'/g, "\\'")}', ${club.isPaidMembership}, ${club.membershipFee})">
                                            ${isOpen ? 'Join Club' : 'Apply to Join'}
                                        </button>`
                                    )
                                )
                            }
                        </div>
                    </div>
                `;
            }).join("");
        } catch (err) {
            grid.innerHTML = "<p>Error loading clubs</p>";
        }
    },

    openJoinClubModal: (id, name, isPaid, fee) => {
        const user = auth.getUser();
        document.getElementById("join-club-id").value = id;
        document.getElementById("join-student-name").value = user.name;
        document.getElementById("join-student-email").value = user.email;
        document.getElementById("join-student-dept").value = user.department || "No Department Set";
        document.getElementById("join-student-year").value = "";
        document.getElementById("join-club-msg").textContent = "";
        
        // Handle Fee Display
        const feeGroup = document.getElementById("join-fee-group");
        const txnGroup = document.getElementById("join-txn-group");
        if (isPaid) {
            feeGroup.style.display = "block";
            txnGroup.style.display = "block";
            document.getElementById("join-fee-amount").textContent = `₹${fee}`;
            document.getElementById("join-transaction-id").required = true;
        } else {
            feeGroup.style.display = "none";
            txnGroup.style.display = "none";
            document.getElementById("join-transaction-id").required = false;
        }

        document.getElementById("join-club-modal").classList.add("show");
    },

    handleJoinClub: async (e) => {
        if (e) e.preventDefault();
        const id = document.getElementById("join-club-id").value;
        const year = document.getElementById("join-student-year").value;
        const transactionId = document.getElementById("join-transaction-id").value;
        const msgEl = document.getElementById("join-club-msg");
        
        try {
            const res = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/clubs/${id}/join`, {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${auth.getToken()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ year, transactionId })
            });
            const data = await res.json();
            
            if (res.ok) {
                alert("Welcome! You have successfully joined the club.");
                document.getElementById("join-club-modal").classList.remove("show");
                student.loadAllClubs();
                student.updateClubStatus();
            } else {
                msgEl.textContent = data.message || "Joining failed";
                msgEl.style.color = "#ef4444";
            }
        } catch (err) {
            msgEl.textContent = "Server error. Please try again later.";
            msgEl.style.color = "#ef4444";
        }
    },
};

function showSection(section) {
    document.getElementById("overview-section").style.display = section === "overview" ? "block" : "none";
    document.getElementById("workflow-section").style.display = section === "workflow" ? "block" : "none";
    document.getElementById("events-section").style.display = section === "events" ? "block" : "none";
    document.getElementById("clubs-section").style.display = section === "clubs" ? "block" : "none";
    document.getElementById("completed-section").style.display = section === "completed" ? "block" : "none";
    document.getElementById("profile-section").style.display = section === "profile" ? "block" : "none";
    
    if (section === 'workflow') student.loadWorkflowEvents();
    if (section === 'profile') student.loadProfile();
    if (section === 'completed' || section === 'overview') student.loadPublishedEvents();
    if (section === 'clubs') student.loadAllClubs();

    document.querySelectorAll(".sidebar nav ul li a").forEach(a => {
        a.classList.remove("active");
        if (a.getAttribute("onclick")?.includes(`'${section}'`)) a.classList.add("active");
    });
}

student.init();
