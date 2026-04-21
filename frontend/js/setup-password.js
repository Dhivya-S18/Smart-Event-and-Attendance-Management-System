const API_BASE = "https://smart-event-and-attendance-management.onrender.com/api";

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        alert("Invalid or missing verification token. Please check your email link again.");
        window.location.href = 'join-club.html';
        return;
    }

    document.getElementById('setup-form').addEventListener('submit', (e) => handleSetupSubmit(e, token));
});

async function handleSetupSubmit(e, token) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btn = document.getElementById('submit-btn');

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "Finalizing...";

        const response = await fetch(`${API_BASE}/auth/accept-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('setup-form-container').style.display = 'none';
            document.getElementById('success-state').style.display = 'block';
        } else {
            alert(data.message || "Failed to finalize account. The link might be expired.");
            btn.disabled = false;
            btn.textContent = "Complete Setup";
        }
    } catch (err) {
        console.error(err);
        alert("A network error occurred.");
        btn.disabled = false;
        btn.textContent = "Complete Setup";
    }
}
