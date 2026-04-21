const report = {
    eventId: new URLSearchParams(window.location.search).get("id"),
    data: {
        description: "",
        rounds: [],
        winners: [],
        photos: []
    },
    isCoordinator: false,

    init: async () => {
        auth.checkAccess(["student", "staff", "hod", "admin"]);
        if (!report.eventId) {
            alert("No event ID provided");
            window.history.back();
            return;
        }

        const user = auth.getUser();
        const success = await report.fetchEventAndReport();
        if (!success) return; // Stop if data couldn't be fetched
        
        report.checkPermissions(user);
        report.render();
    },

    checkPermissions: (user) => {
        // A student is a coordinator if they belong to a club
        // We also check if their club matches the event's club
        if (user.role === 'student' && user.clubId && report.event?.clubId?._id === user.clubId) {
            report.isCoordinator = true;
            document.getElementById("save-btn").style.display = "inline-block";
        } else if (user.role === 'admin') {
            report.isCoordinator = true;
            document.getElementById("save-btn").style.display = "inline-block";
        } else {
            // Read-only mode
            report.isCoordinator = false;
            document.querySelectorAll("input, textarea, button.btn-secondary").forEach(el => {
                el.disabled = true;
                if (el.tagName === 'BUTTON' && el.id !== 'back-btn') el.style.display = 'none';
            });
            document.getElementById("save-btn").style.display = "none";
        }
    },

    fetchEventAndReport: async () => {
        try {
            // Fetch Event Details
            const eventRes = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/status`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const allEvents = await eventRes.json();
            report.event = allEvents.find(e => e._id === report.eventId);

            if (!report.event) {
                const specRes = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/events/status?status=completed`, {
                    headers: { "Authorization": `Bearer ${auth.getToken()}` }
                });
                const compEvents = await specRes.json();
                report.event = compEvents.find(e => e._id === report.eventId);
            }

            if (!report.event) throw new Error("Event not found or not accessible");

            // Fetch Report Data
            const repRes = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/reports/${report.eventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            const repData = await repRes.json();
            
            if (repRes.ok && repData._id) {
                report.data = repData;
            } else {
                report.data.description = report.event.description || "";
            }

            // Fetch Participants (from Feedback Responses)
            const attRes = await fetch(`https://smart-event-and-attendance-management.onrender.com/api/feedback/${report.eventId}`, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });
            report.participants = await attRes.json();
            report.attendanceCount = report.participants.length;

            return true;
        } catch (err) {
            console.error("Fetch error:", err);
            alert("Error loading report data: " + err.message);
            return false;
        }
    },

    render: () => {
        const e = report.event;
        const d = report.data;

        document.getElementById("event-title-main").textContent = `Report: ${e.title}`;
        document.getElementById("event-club-name").textContent = (e.clubId?.clubName || "Club Association").toUpperCase();
        
        document.getElementById("report-title").textContent = e.title;
        document.getElementById("report-venue").textContent = e.venue;
        document.getElementById("report-date-time").textContent = `${new Date(e.date).toLocaleDateString()} & ${e.time || 'N/A'}`;

        document.getElementById("report-desc").value = d.description || "";

        // Render Participants
        const pBody = document.getElementById("participants-list-body");
        if (report.participants && report.participants.length > 0) {
            document.getElementById("p-count").textContent = `(Total: ${report.participants.length})`;
            pBody.innerHTML = report.participants.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.studentName}</td>
                    <td>${p.department || 'II Year'}</td>
                </tr>
            `).join("");
        } else {
            pBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No participants found.</td></tr>';
        }

        // Render Rounds
        const roundsCont = document.getElementById("rounds-container");
        roundsCont.innerHTML = (d.rounds || []).map((r, i) => report.getRoundHtml(i, r)).join("");

        // Render Winners
        const winnersCont = document.getElementById("winners-container");
        winnersCont.innerHTML = (d.winners || []).map((w, i) => report.getWinnerHtml(i, w)).join("");

        // Render Photos
        const photosCont = document.getElementById("photos-container");
        photosCont.innerHTML = (d.photos || []).map((p, i) => report.getPhotoHtml(i, p)).join("");
    },

    getRoundHtml: (index, round) => `
        <div class="dynamic-item">
            ${report.isCoordinator ? `<button class="remove-btn" onclick="report.removeItem('rounds', ${index})">Remove</button>` : ''}
            <div class="form-group">
                <label>Round Name</label>
                <input type="text" value="${round.roundName || ''}" onchange="report.updateItem('rounds', ${index}, 'roundName', this.value)" placeholder="e.g. Preliminary Quiz">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="report.updateItem('rounds', ${index}, 'roundDescription', this.value)" placeholder="Rules or highlights of this round...">${round.roundDescription || ''}</textarea>
            </div>
        </div>
    `,

    getWinnerHtml: (index, winner) => `
        <div class="dynamic-item">
            ${report.isCoordinator ? `<button class="remove-btn" onclick="report.removeItem('winners', ${index})">✕</button>` : ''}
            <div class="winner-row" style="margin-bottom: 0.5rem; display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr 1fr; gap: 0.8rem;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem;">Student Name</label>
                    <input type="text" value="${winner.studentName || ''}" onchange="report.updateItem('winners', ${index}, 'studentName', this.value)" placeholder="Full Name" style="padding: 0.4rem; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem;">Reg No</label>
                    <input type="text" value="${winner.registerNumber || ''}" onchange="report.updateItem('winners', ${index}, 'registerNumber', this.value)" placeholder="Reg No" style="padding: 0.4rem; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; color: #fbbf24; font-weight: 600;">Rank / Place</label>
                    <select onchange="report.updateItem('winners', ${index}, 'ranking', this.value)" style="padding: 0.4rem; font-size: 0.9rem; background: var(--bg-dark); color: #fbbf24; border: 1px solid rgba(255,191,36,0.3); width: 100%; border-radius: 4px; font-weight: bold;">
                        <option value="">Select Rank</option>
                        <option value="1st" ${winner.ranking === '1st' ? 'selected' : ''}>🥇 1st Place</option>
                        <option value="2nd" ${winner.ranking === '2nd' ? 'selected' : ''}>🥈 2nd Place</option>
                        <option value="3rd" ${winner.ranking === '3rd' ? 'selected' : ''}>🥉 3rd Place</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem;">Year</label>
                    <select onchange="report.updateItem('winners', ${index}, 'year', this.value)" style="padding: 0.4rem; font-size: 0.9rem; background: var(--bg-dark); color: white; border: 1px solid rgba(255,255,255,0.1); width: 100%;">
                        <option value="">Year</option>
                        <option value="1" ${winner.year == '1' ? 'selected' : ''}>I</option>
                        <option value="2" ${winner.year == '2' ? 'selected' : ''}>II</option>
                        <option value="3" ${winner.year == '3' ? 'selected' : ''}>III</option>
                        <option value="4" ${winner.year == '4' ? 'selected' : ''}>IV</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem;">Dept</label>
                    <input type="text" value="${winner.department || ''}" onchange="report.updateItem('winners', ${index}, 'department', this.value)" placeholder="CSE" style="padding: 0.4rem; font-size: 0.9rem;">
                </div>
            </div>
        </div>
    `,

    getPhotoHtml: (index, p) => {
        const url = typeof p === 'string' ? p : (p?.url || "");
        const isLocal = typeof url === 'string' && url.startsWith("/uploads");
        const fullUrl = isLocal ? `https://smart-event-and-attendance-management.onrender.com${url}` : url;
        
        return `
            <div class="dynamic-item" style="display: flex; gap: 1rem; align-items: center;">
                <div style="flex: 1;">
                    ${isLocal 
                        ? `<p style="font-size: 0.8rem; opacity: 0.6; margin-bottom: 0.5rem;">Uploaded Image</p>` 
                        : `<input type="text" value="${url}" onchange="report.updatePhoto(${index}, this.value)" placeholder="Image URL (http://...)">`
                    }
                    ${url ? `<img src="${fullUrl}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-top: 0.5rem; display: block;" onerror="this.style.display='none'">` : ''}
                </div>
                ${report.isCoordinator ? `<button class="remove-btn" style="position: static;" onclick="report.removeItem('photos', ${index})">✕</button>` : ''}
            </div>
        `;
    },



    addRound: () => {
        report.data.rounds.push({ roundName: "", roundDescription: "" });
        report.render();
    },

    addWinner: () => {
        report.data.winners.push({ studentName: "", email: "", registerNumber: "", year: "", department: "", ranking: "" });
        report.render();
    },

    addPhoto: () => {
        report.data.photos.push("");
        report.render();
    },
    
    uploadPhoto: async (input) => {
        if (!input.files || !input.files[0]) return;
        
        const file = input.files[0];
        const formData = new FormData();
        formData.append("photo", file);

        const uploadBtn = document.getElementById("upload-photo-btn");
        uploadBtn.textContent = "Uploading...";
        uploadBtn.disabled = true;

        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/reports/upload-photo", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${auth.getToken()}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                report.data.photos.push(data.imageUrl);
                report.render();
            } else {
                const err = await res.json();
                alert("Upload failed: " + err.message);
            }
        } catch (err) {
            alert("Upload error: " + err.message);
        } finally {
            uploadBtn.textContent = "+ Upload Photo";
            uploadBtn.disabled = false;
            input.value = ""; // Clear file input
        }
    },


    updateItem: (list, index, field, value) => {
        report.data[list][index][field] = value;
    },

    updatePhoto: (index, value) => {
        report.data.photos[index] = value;
        report.render(); // Re-render to show image preview
    },

    removeItem: (list, index) => {
        report.data[list].splice(index, 1);
        report.render();
    },

    save: async () => {
        const desc = document.getElementById("report-desc").value.trim();
        if (!desc) {
            alert("Please provide a description of the event conductance.");
            return;
        }
        
        report.data.description = desc;
        const btn = document.getElementById("save-btn");
        btn.textContent = "Saving...";
        btn.disabled = true;


        try {
            const res = await fetch("https://smart-event-and-attendance-management.onrender.com/api/reports", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify({ ...report.data, eventId: report.eventId })
            });

            if (res.ok) {
                alert("Report saved successfully!");
            } else {
                const err = await res.json();
                alert("Error saving: " + err.message);
            }
        } catch (err) {
            alert("Connection error");
        } finally {
            btn.textContent = "Save Changes";
            btn.disabled = false;
        }
    },

    download: async (type) => {
        const url = `https://smart-event-and-attendance-management.onrender.com/api/reports/${report.eventId}/${type}`;
        const btnId = `download-${type}-btn`;
        const btn = document.getElementById(btnId);
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = "Generating...";
            btn.disabled = true;

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${auth.getToken()}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to generate file. Ensure report is saved.");
            }

            const blob = await res.blob();
            if (!blob) return;

            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `Report_${report.eventId}.${type === 'pdf' ? 'pdf' : 'docx'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
        } catch (err) {
            alert("Download failed: " + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

};

report.init();
