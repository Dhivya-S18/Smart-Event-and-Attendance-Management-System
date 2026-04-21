/**
 * orgSwitcher.js
 * Shared multi-organization context switcher.
 * Include this script in staff.html, student.html, hod.html
 * 
 * Usage: call orgSwitcher.init('container-element-id') on page load.
 */

const orgSwitcher = {
    init: (containerId) => {
        const orgs = auth.getOrganizations();
        const container = document.getElementById(containerId);
        if (!container) return;

        // Don't show switcher if only 1 org
        if (orgs.length <= 1) {
            container.style.display = 'none';
            return;
        }

        const selectedOrg = auth.getSelectedOrg();
        container.innerHTML = `
            <div id="org-switcher-widget" style="
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 10px;
                padding: 0.4rem 0.8rem;
                cursor: pointer;
                position: relative;
            ">
                <span style="font-size: 0.75rem; color: var(--text-muted, #aaa);">Managing:</span>
                <span id="org-switcher-name" style="
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--primary, #7c3aed);
                    max-width: 160px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                ">${selectedOrg?.name || 'Select Org'}</span>
                <span style="font-size: 0.7rem; color: var(--text-muted, #aaa);">▼</span>

                <div id="org-switcher-dropdown" style="
                    display: none;
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    min-width: 220px;
                    background: #1a1a2e;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    padding: 0.4rem;
                    z-index: 1000;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                ">
                    <p style="font-size:0.7rem; color:var(--text-muted, #aaa); padding: 0.3rem 0.5rem; margin:0;">Switch Organization</p>
                    ${orgs.map(org => `
                        <div class="org-option" data-org='${JSON.stringify(org)}' style="
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                            padding: 0.5rem 0.7rem;
                            border-radius: 6px;
                            cursor: pointer;
                            background: ${selectedOrg?.id === org.id ? 'rgba(124,58,237,0.15)' : 'transparent'};
                            border: 1px solid ${selectedOrg?.id === org.id ? 'rgba(124,58,237,0.3)' : 'transparent'};
                            transition: background 0.2s;
                        ">
                            <span style="font-size:0.8rem;">${org.type === 'club' ? '🏛️' : '🏢'}</span>
                            <div>
                                <div style="font-size:0.85rem; font-weight:600; color:white;">${org.name}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted, #aaa);">${org.role.replace('_', ' ')} · ${org.type}</div>
                            </div>
                            ${selectedOrg?.id === org.id ? '<span style="margin-left:auto; color:#7c3aed; font-size:0.8rem;">✓</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Toggle dropdown
        document.getElementById('org-switcher-widget').addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = document.getElementById('org-switcher-dropdown');
            dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });

        // Close on outside click
        document.addEventListener('click', () => {
            const dd = document.getElementById('org-switcher-dropdown');
            if (dd) dd.style.display = 'none';
        });

        // Org selection
        container.querySelectorAll('.org-option').forEach(el => {
            el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.05)');
            el.addEventListener('mouseleave', () => {
                const org = JSON.parse(el.dataset.org);
                el.style.background = auth.getSelectedOrg()?.id === org.id ? 'rgba(124,58,237,0.15)' : 'transparent';
            });
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const org = JSON.parse(el.dataset.org);
                auth.setSelectedOrg(org);

                // Update displayed name
                document.getElementById('org-switcher-name').textContent = org.name;

                // Close dropdown
                document.getElementById('org-switcher-dropdown').style.display = 'none';

                // Reload dashboard data for the newly selected org
                if (typeof orgSwitcher.onSwitch === 'function') {
                    orgSwitcher.onSwitch(org);
                } else {
                    window.location.reload(); // fallback
                }
            });
        });
    },

    // Dashboard handlers override this to reload data without full page refresh
    onSwitch: null,
};
