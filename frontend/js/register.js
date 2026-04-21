const register = {
    eventId: null,
    eventData: null,

    init: async () => {
        const urlParams = new URLSearchParams(window.location.search);
        // Supports both ?id=... and path based if we had routing, but URL param is safer for simple static
        // Actually, index.html might pass ID in URL
        const pathParts = window.location.pathname.split('/');
        register.eventId = urlParams.get('id') || pathParts[pathParts.length - 1];

        if (!register.eventId || register.eventId === 'register.html') {
            document.querySelector('.glass-card').innerHTML = '<div class="form-header"><h1>Invalid Link</h1><p>Please use the official registration link from the dashboard.</p></div>';
            return;
        }

        await register.loadEventDetails();
        
        // Auto-fill if user is logged in as a student
        if (auth.isLoggedIn()) {
            const user = auth.getUser();
            if (user && user.role === 'student') {
                if (document.getElementById('student-name')) document.getElementById('student-name').value = user.name || '';
                if (document.getElementById('reg-no')) document.getElementById('reg-no').value = user.registerNumber || '';
                if (document.getElementById('dept')) document.getElementById('dept').value = user.department || '';
                if (document.getElementById('email')) document.getElementById('email').value = user.email || '';
                if (document.getElementById('phone')) document.getElementById('phone').value = user.phone || '';
            }
        }

        document.getElementById('main-registration-form').addEventListener('submit', register.handleSubmit);
    },

    loadEventDetails: async () => {
        try {
            // We can use a public event route or a generic one
            const res = await fetch(`http://localhost:5000/api/events/published`);
            const events = await res.json();
            const event = events.find(e => e._id === register.eventId);
            
            if (!event) throw new Error("Event not found");
            
            register.eventData = event;
            document.getElementById('event-title').textContent = event.title;
            
            let isFull = false;
            let statusText = "";
            if (event.isTeamEvent) {
                if (event.maxTeams > 0 && event.registeredTeamsCount >= event.maxTeams) {
                    isFull = true;
                    statusText = "All team slots are filled.";
                }
            } else {
                if (event.maxParticipants > 0 && event.registeredCount >= event.maxParticipants) {
                    isFull = true;
                    statusText = "Registration Full: Maximum participants reached.";
                }
            }

            if (isFull || event.feedbackEnabled) {
                const title = event.feedbackEnabled ? "Registration Closed" : statusText;
                const message = event.feedbackEnabled ? 
                    `Registration for <strong>${event.title}</strong> is closed as the event has moved to the feedback stage.` :
                    `Registration for <strong>${event.title}</strong> is currently closed as the capacity has been reached.`;

                document.querySelector('.glass-card').innerHTML = `
                    <div class="form-header">
                        <h2 style="color: #f87171; font-size: 2.5rem; margin-bottom: 1rem;">⚠️</h2>
                        <h1>${title}</h1>
                        <p style="margin-top: 1rem;">${message}</p>
                        <button class="btn btn-primary" style="margin-top: 2rem;" onclick="window.location.href='index.html'">Go Back</button>
                    </div>
                `;
                return;
            }

            const availabilityText = event.isTeamEvent ? 
                `Available: ${event.maxTeams - event.registeredTeamsCount} / ${event.maxTeams} Teams` :
                `Available: ${event.maxParticipants - event.registeredCount} / ${event.maxParticipants} Seats`;

            document.getElementById('event-info').innerHTML = `
                ${event.clubId?.clubName || 'Club Event'} | ${new Date(event.date).toLocaleDateString()} at ${event.venue}<br>
                <strong style="color: var(--primary); font-size: 0.85rem;">${availabilityText}</strong>
            `;
            
            if (event.isTeamEvent) {
                document.getElementById('team-section').style.display = 'block';
                const teamMsg = document.createElement('p');
                teamMsg.style.fontSize = '0.8rem';
                teamMsg.style.color = 'var(--text-muted)';
                teamMsg.style.marginTop = '0.5rem';
                teamMsg.textContent = `Team Size Limit: ${event.maxTeamSize} members (including leader).`;
                document.getElementById('team-section').prepend(teamMsg);
            }
        } catch (err) {
            console.error(err);
            document.getElementById('event-info').textContent = "Registration for this event is active.";
        }
    },

    handleSubmit: async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('feedback-msg');
        const loading = document.getElementById('loading');
        
        feedback.textContent = "";
        loading.style.display = "flex";

        try {
            const teamMembers = [];
            const teammateRows = document.querySelectorAll('.teammate-row');
            for (const row of teammateRows) {
                const tName = row.querySelector('.t-name').value;
                let tReg = row.querySelector('.t-reg').value.toLowerCase().trim();
                tReg = tReg.split('@')[0]; // Strip email domain if accidentally pasted
                const tEmail = row.querySelector('.t-email').value.toLowerCase().trim();
                
                // Teammate email validation
                const expectedTEmail = `${tReg}@nec.edu.in`;
                if (tEmail !== expectedTEmail) {
                    feedback.textContent = `Teammate ${tName}'s email must be ${expectedTEmail}`;
                    feedback.style.color = "var(--accent)";
                    loading.style.display = "none";
                    return;
                }

                teamMembers.push({
                    name: tName,
                    registerNumber: tReg,
                    email: tEmail
                });
            }

            const studentName = document.getElementById('student-name').value;
            let regNo = document.getElementById('reg-no').value.toLowerCase().trim();
            regNo = regNo.split('@')[0]; // Strip email domain if accidentally pasted
            const email = document.getElementById('email').value.toLowerCase().trim();
            
            // Primary student email validation
            const expectedEmail = `${regNo}@nec.edu.in`;
            if (email !== expectedEmail) {
                feedback.textContent = `Your email must be ${expectedEmail}`;
                feedback.style.color = "var(--accent)";
                loading.style.display = "none";
                return;
            }

            const payload = {
                studentName,
                registerNumber: regNo,
                department: document.getElementById('dept').value,
                year: document.getElementById('year-of-study').value,
                email,
                phone: document.getElementById('phone').value,
                teamMembers: teamMembers
            };

            const res = await fetch(`http://localhost:5000/api/events/${register.eventId}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (res.ok) {
                document.querySelector('.glass-card').innerHTML = `
                    <div class="form-header" style="animation: fadeIn 0.5s ease;">
                        <h2 style="color: var(--success); font-size: 2.5rem; margin-bottom: 1rem;">✅</h2>
                        <h1>Registration Successful!</h1>
                        <p style="margin-top: 1rem;">Thank you for registering for <strong>${register.eventData?.title || 'the event'}</strong>.</p>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 2rem;">A confirmation email has been dispatched to your inbox. Please present the confirmation at the venue.</p>
                        <button class="btn btn-primary" style="margin-top: 2rem;" onclick="window.location.href='index.html'">Back to Home</button>
                    </div>
                `;
            } else {
                feedback.textContent = data.message || "Registration failed. Please try again.";
                feedback.style.color = "var(--accent)";
            }
        } catch (err) {
            feedback.textContent = "Network error. Please check your connection.";
            feedback.style.color = "var(--accent)";
        } finally {
            loading.style.display = "none";
        }
    }
};

function addTeammate() {
    const max = register.eventData?.maxTeamSize || 1;
    const currentCount = document.querySelectorAll('.teammate-row').length + 1; // +1 for the leader
    
    if (currentCount >= max) {
        alert(`Maximum team size for this event is ${max} members.`);
        return;
    }

    const container = document.getElementById('teammates-container');
    const div = document.createElement('div');
    div.className = 'teammate-row';
    div.innerHTML = `
        <span class="remove-teammate" onclick="this.parentElement.remove()">✕ Remove</span>
        <div class="input-group-grid">
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="t-name" placeholder="Member Name" required>
            </div>
            <div class="form-group">
                <label>Register No</label>
                <input type="text" class="t-reg" placeholder="21CSXXX" required>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label>Email ID</label>
            <input type="email" class="t-email" placeholder="member@college.edu" required>
        </div>
    `;
    container.appendChild(div);
}

register.init();
