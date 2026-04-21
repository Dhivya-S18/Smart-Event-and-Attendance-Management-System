import { useState, useEffect, useContext } from "react";
import API from "../api/api";
import AuthContext from "../context/AuthContext";
import "./Students.css"; 

const Staff = () => {
    const { user } = useContext(AuthContext);
    const [events, setEvents] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalFeedback, setApprovalFeedback] = useState("");
    const [approvalAction, setApprovalAction] = useState("approve");

    // Member Management States
    const [members, setMembers] = useState([]);
    const [newMemberRegNo, setNewMemberRegNo] = useState("");
    const [clubInfo, setClubInfo] = useState(null);

    useEffect(() => {
        if (activeTab === "members") {
            fetchMembers();
        } else {
            fetchEvents();
        }
    }, [activeTab]);

    const fetchEvents = async () => {
        try {
            const { data } = await API.get("/events/status");
            let filteredEvents = [];
            if (activeTab === "pending") {
                filteredEvents = data.filter(e => e.status === "pending_staff_approval");
            } else if (activeTab === "published") {
                filteredEvents = data.filter(e => e.status === "published");
            }
            setEvents(filteredEvents);
        } catch (err) {
            console.error("Error fetching events", err);
            setError("Failed to fetch events");
        }
    };

    const fetchMembers = async () => {
        try {
            if (!user.clubId) return;
            const { data } = await API.get(`/clubs/${user.clubId}/members`);
            setMembers(data);
            
            // Also fetch club details for context
            const clubRes = await API.get(`/clubs/${user.clubId}`);
            setClubInfo(clubRes.data.club);
        } catch (err) {
            console.error("Error fetching members", err);
            setError("Failed to fetch club members");
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            setError("");
            setSuccess("");
            await API.post(`/clubs/${user.clubId}/members`, { registerNumber: newMemberRegNo });
            setSuccess(`Student ${newMemberRegNo} added to club!`);
            setNewMemberRegNo("");
            fetchMembers();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add member");
        }
    };

    const handleAction = async (id, action, endpoint, method = "put", body = {}) => {
        try {
            setError("");
            setSuccess("");
            if (method === "put") {
                await API.put(`/events/${id}/${endpoint}`, body);
            } else if (method === "post") {
                await API.post(`/events/${id}/${endpoint}`, body);
            }
            setSuccess(`Action '${action}' completed successfully.`);
            setShowApprovalModal(false);
            fetchEvents();
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${action}`);
        }
    };

    const exportExcel = async (id, title) => {
        try {
            const response = await API.get(`/events/${id}/export-attendance`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `attendance_${title}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            setError("Failed to export attendance");
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>Staff Coordinator Dashboard</h2>
                <p>Welcome! Manage your assigned club events and approvals.</p>
            </header>

            <div className="tabs-container">
                <button className={`tab ${activeTab === "pending" ? "active" : ""}`} onClick={() => setActiveTab("pending")}>Approvals</button>
                <button className={`tab ${activeTab === "published" ? "active" : ""}`} onClick={() => setActiveTab("published")}>Management</button>
                <button className={`tab ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>Club Members</button>
            </div>

            <div className="dashboard-content" style={{ gridTemplateColumns: '1fr' }}>
                <div className="list-section">
                    <h3>
                        {activeTab === "pending" && "Pending Approval Requests"}
                        {activeTab === "published" && "Published Event Management"}
                        {activeTab === "members" && `Club Member Management ${clubInfo ? `- ${clubInfo.clubName}` : ''}`}
                    </h3>

                    {error && <div className="message error">{error}</div>}
                    {success && <div className="message success">{success}</div>}

                    {activeTab === "members" ? (
                        <div className="member-management-section">
                            <form onSubmit={handleAddMember} className="event-form" style={{ maxWidth: '500px', marginBottom: '2rem' }}>
                                <div className="form-group">
                                    <label>Add Student by Register Number</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. 2112001" 
                                            value={newMemberRegNo} 
                                            onChange={e => setNewMemberRegNo(e.target.value)} 
                                            required 
                                        />
                                        <button type="submit" className="btn-primary">Add Student</button>
                                    </div>
                                </div>
                            </form>

                            <div className="members-list">
                                <h4>Current Members ({members.length})</h4>
                                <div className="events-grid"> {/* Reusing grid styling */}
                                    {members.length === 0 ? (
                                        <p>No members added yet.</p>
                                    ) : (
                                        members.map(m => (
                                            <div key={m._id} className="event-card" style={{ padding: '15px' }}>
                                                <strong>{m.name}</strong>
                                                <p style={{ margin: '5px 0' }}>Reg No: {m.registerNumber}</p>
                                                <p style={{ fontSize: '0.85em', color: '#666' }}>{m.department} - Year {m.year}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="events-grid">
                            {events.length === 0 ? (
                                <p className="no-data">No events in this category for your club.</p>
                            ) : (
                                events.map((event) => (
                                    <div key={event._id} className="event-card">
                                        <h4>{event.title}</h4>
                                        <p>{event.description}</p>
                                        <div className="event-meta">
                                            <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                                            <span>📍 {event.venue}</span>
                                        </div>
                                        <p><strong>Status:</strong> {(event.status || 'pending').replace(/_/g, " ").toUpperCase()}</p>
                                        <p><strong>Registrations:</strong> <span style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{event.registrationCount || 0}</span></p>
                                        
                                        <div className="card-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                            {activeTab === "pending" && (
                                                <button onClick={() => {setSelectedEvent(event); setShowApprovalModal(true)}} className="btn-primary">Review & Approve</button>
                                            )}

                                            {activeTab === "published" && (
                                                <>
                                                    {!event.registrationEnabled ? (
                                                        <button onClick={() => handleAction(event._id, "Enable Registration", "enable-registration", "put")} className="btn-primary">Enable Entry</button>
                                                    ) : (
                                                        <span style={{color: 'green', fontWeight: 'bold'}}>Entry Open</span>
                                                    )}
                                                    
                                                    <button onClick={() => exportExcel(event._id, event.title)} className="btn-secondary">Excel Export</button>
                                                    <button onClick={() => handleAction(event._id, "Email Certificates", "generate-certificates", "post")} className="btn-primary">Email Certificates</button>
                                                    <button onClick={() => handleAction(event._id, "Complete Event", "close", "put")} className="btn-primary" style={{backgroundColor: '#8e44ad'}}>🏁 Complete Event</button>
                                                </>
                                            )}
                                            
                                            {event.hodFeedback && (
                                                <div className="hod-feedback" style={{marginTop: '10px', padding: '10px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '5px', fontSize: '0.9rem', borderLeft: '4px solid #e74c3c'}}>
                                                    <strong>HOD Feedback:</strong> {event.hodFeedback}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Staff Approval Modal */}
            {showApprovalModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Staff Approval Form</h3>
                        <p><strong>Event:</strong> {selectedEvent?.title}</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            handleAction(selectedEvent._id, approvalAction, "staff-approve", "put", {action: approvalAction, staffFeedback: approvalFeedback})
                        }} className="event-form">
                            <div className="form-group">
                                <label>Approval Action</label>
                                <select value={approvalAction} onChange={(e) => setApprovalAction(e.target.value)} required>
                                    <option value="approve">Approve Request</option>
                                    <option value="reject">Reject Request</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Staff Feedback / Notes</label>
                                <textarea value={approvalFeedback} onChange={(e) => setApprovalFeedback(e.target.value)} placeholder="Provide any suggestions or reasons for rejection..." rows="4" required />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className={`btn-primary ${approvalAction === 'reject' ? 'btn-danger' : ''}`}>
                                    Confirm {approvalAction === 'approve' ? 'Approval' : 'Rejection'}
                                </button>
                                <button type="button" onClick={() => setShowApprovalModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Staff;
