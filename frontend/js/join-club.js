const API_BASE = "http://localhost:5000/api";

const explorer = {
    allClubs: [],
    selectedClub: null,

    init: async () => {
        await Promise.all([
            explorer.loadClubs(),
            explorer.loadDepartments()
        ]);
        explorer.setupForm();
        
        // Check for specific club in URL (optional deep linking)
        const params = new URLSearchParams(window.location.search);
        const clubId = params.get('clubId');
        if (clubId) explorer.selectClub(clubId);
    },

    loadClubs: async () => {
        const grid = document.getElementById('club-grid');
        try {
            const response = await fetch(`${API_BASE}/clubs/public`);
            if (!response.ok) throw new Error('Failed to fetch clubs');
            
            explorer.allClubs = await response.json();
            explorer.renderClubs(explorer.allClubs);
            
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<p class="full-width" style="text-align:center; color: #ef4444;">Unable to load clubs. Please try again later.</p>';
        }
    },

    loadDepartments: async () => {
        const deptSelect = document.getElementById('department');
        try {
            const response = await fetch(`${API_BASE}/clubs/departments`);
            if (!response.ok) throw new Error('Failed to fetch departments');
            
            const departments = await response.json();
            
            // Keep the first "Select Dept" option
            deptSelect.innerHTML = '<option value="">Select Dept</option>';
            
            departments.forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept.name; // Using name as the identifier
                opt.textContent = dept.name;
                deptSelect.appendChild(opt);
            });
            
        } catch (err) {
            console.error("Error loading departments:", err);
        }
    },

    renderClubs: (clubs) => {
        const grid = document.getElementById('club-grid');
        if (clubs.length === 0) {
            grid.innerHTML = '<p class="full-width" style="text-align:center; color: #94a3b8;">No clubs found matching your search.</p>';
            return;
        }

        grid.innerHTML = clubs.map(club => `
            <div class="club-card" onclick="explorer.selectClub('${club._id}')">
                <span class="type">${club.clubType}</span>
                <h3>${club.clubName}</h3>
                <p>${club.description || 'Discover opportunities and participate in exciting activities across the NEC campus.'}</p>
                <div class="card-footer">
                    <span style="font-size: 0.85rem; color: #94a3b8;">${club.membershipType} Membership</span>
                    ${club.isPaidMembership ? `<span class="fee-pill">₹${club.membershipFee}</span>` : '<span class="fee-pill" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">FREE</span>'}
                </div>
            </div>
        `).join('');
    },

    filterClubs: () => {
        const query = document.getElementById('club-search').value.toLowerCase();
        const filtered = explorer.allClubs.filter(c => 
            c.clubName.toLowerCase().includes(query) || 
            c.clubType.toLowerCase().includes(query) ||
            (c.description || '').toLowerCase().includes(query)
        );
        explorer.renderClubs(filtered);
    },

    selectClub: (clubId) => {
        const club = explorer.allClubs.find(c => c._id === clubId);
        if (!club) return;
        
        explorer.selectedClub = club;
        
        // Populate Details
        document.getElementById('det-name').textContent = club.clubName;
        document.getElementById('det-type').textContent = club.clubType.toUpperCase();
        document.getElementById('det-desc').textContent = club.description || 'No description provided yet.';
        document.getElementById('det-membership').textContent = club.membershipType;
        document.getElementById('det-fee').textContent = club.isPaidMembership ? `₹${club.membershipFee}` : 'Free';
        
        // Prepare Form Section
        document.getElementById('reg-club-name').textContent = club.clubName;

        explorer.showView('details');
    },

    showView: (viewName) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewName}-view`).classList.add('active');
        
        // Update Title/Subtitle for specific views
        const title = document.getElementById('page-title');
        const subtitle = document.getElementById('page-subtitle');
        const header = document.getElementById('main-header');

        if (viewName === 'explorer') {
            title.textContent = "Explore Clubs";
            subtitle.textContent = "Discover the vibrant community at NEC. Find your tribe today.";
            header.style.display = "block";
        } else {
            header.style.display = "none";
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setupForm: () => {
        document.getElementById('join-form').addEventListener('submit', explorer.handleFormSubmit);
    },

    handleFormSubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const originalText = btn.textContent;
        
        const payload = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            registerNumber: document.getElementById('registerNumber').value,
            department: document.getElementById('department').value,
            year: document.getElementById('year').value,
            clubId: explorer.selectedClub._id
        };

        try {
            btn.disabled = true;
            btn.textContent = "Processing Application...";

            const response = await fetch(`${API_BASE}/auth/request-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || "Success! Check your email to complete registration.");
                window.location.href = "login.html";
            } else {
                // Specific error from server
                alert("Application Error: " + (data.message || "Unknown error occurred."));
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (err) {
            console.error(err);
            alert("Connection Error: Unable to reach the server. Please try again.");
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

document.addEventListener('DOMContentLoaded', explorer.init);
