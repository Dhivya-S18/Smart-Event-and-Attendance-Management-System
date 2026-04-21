import { useState, useEffect, useContext } from "react";
import AuthContext from "../context/AuthContext";
import API from "../api/api";
import "./Students.css"; 

const HOD = () => {
    const { user } = useContext(AuthContext);
    const [events, setEvents] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [activeTab, setActiveTab] = useState("approvals");
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showClubModal, setShowClubModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedClub, setSelectedClub] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");

    useEffect(() => {
        if (activeTab === "approvals") {
            fetchEvents();
        } else if (activeTab === "clubs") {
            fetchClubs();
        }
    }, [activeTab]);

    const fetchEvents = async () => {
        try {
            const { data } = await API.get("/events/status");
            // Filter for events that need HOD approval
            const pendingEvents = data.filter(event => event.status === 'pending_hod_approval');
            setEvents(pendingEvents);
        } catch (err) {
            console.error("Error fetching events", err);
            setError("Failed to fetch events");
        }
    };

    const fetchClubs = async () => {
        try {
            const { data } = await API.get("/clubs");
            setClubs(data);
        } catch (err) {
            console.error("Error fetching clubs", err);
            setError("Failed to fetch clubs");
        }
    };

    const fetchClubDetails = async (clubId) => {
        try {
            const { data } = await API.get(`/clubs/${clubId}`);
            setSelectedClub(data);
            setShowClubModal(true);
        } catch (err) {
            alert("Failed to load club details");
        }
    };

    const handleAction = async (id, actionStr, actionType, feedback = "") => {
        try {
            setError("");
            setSuccess("");
            await API.put(`/events/${id}/hod-approve`, { action: actionType, feedback });
            setSuccess(`Event ${actionStr.toLowerCase()} successfully by HOD.`);
            setEvents(events.filter(event => event._id !== id));
            setShowRejectModal(false);
            setRejectionReason("");
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${actionStr.toLowerCase()} event`);
        }
    };

    const openRejectModal = (event) => {
        setSelectedEvent(event);
        setShowRejectModal(true);
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>HOD Dashboard</h2>
                <p>Department: {user?.department || "Assigned Department"}</p>
                <p>Review and final approval of event proposals</p>
            </header>

            <div className="tabs-container">
                <button className={`tab ${activeTab === "approvals" ? "active" : ""}`} onClick={() => setActiveTab("approvals")}>Approvals</button>
                <button className={`tab ${activeTab === "clubs" ? "active" : ""}`} onClick={() => setActiveTab("clubs")}>Department Clubs</button>
            </div>

            <div className="dashboard-content" style={{ gridTemplateColumns: '1fr' }}>
                <div className="list-section">
                    {error && <div className="message error">{error}</div>}
                    {success && <div className="message success">{success}</div>}

                    {activeTab === "approvals" && (
                        <>
                            <h3>Events Pending HOD Approval</h3>
                            <div className="events-grid">
                                {events.length === 0 ? (
                                    <p className="no-data">No pending events requiring your approval.</p>
                                ) : (
                                    events.map((event) => (
                                        <div key={event._id} className="event-card">
                                            <h4>{event.title}</h4>
                                            <p><strong>Description:</strong> {event.description}</p>
                                            <p className="event-date"><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                                            <p className="event-venue"><strong>Venue:</strong> {event.venue}</p>
                                            <p><strong>Club:</strong> {event.clubId?.clubName || 'Unknown Club'}</p>

                                            <div className="document-links" style={{marginTop: '10px', marginBottom: '15px'}}>
                                                {event.circularPdf && <a href={`https://smart-event-and-attendance-management.onrender.com${event.circularPdf}`} target="_blank" rel="noreferrer" className="btn-secondary-link">View Circular</a>}
                                                {event.posterImage && <a href={`https://smart-event-and-attendance-management.onrender.com${event.posterImage}`} target="_blank" rel="noreferrer" className="btn-secondary-link">View Poster</a>}
                                            </div>

                                            <div className="card-actions" style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleAction(event._id, "Approved", "approve")} className="btn-primary">Approve Event</button>
                                                <button onClick={() => openRejectModal(event)} className="btn-secondary" style={{backgroundColor: '#e74c3c'}}>Reject Event</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === "clubs" && (
                        <>
                            <h3>Clubs in {user?.department}</h3>
                            <div className="events-grid">
                                {clubs.length === 0 ? (
                                    <p className="no-data">No clubs found for your department.</p>
                                ) : (
                                    clubs.map((club) => (
                                        <div key={club._id} className="event-card" onClick={() => fetchClubDetails(club._id)} style={{cursor: 'pointer'}}>
                                            <h4>{club.clubName}</h4>
                                            <p><strong>Staff Coordinator:</strong> {club.coordinators?.map(c => c.name).join(", ")}</p>
                                            <p><strong>Student Coordinator:</strong> {club.studentCoordinator?.name || "N/A"}</p>
                                            <p><strong>Total Members:</strong> {club.members?.length || 0}</p>
                                            <button className="btn-secondary" style={{marginTop: '10px', width: '100%'}}>View Details</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showClubModal && selectedClub && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h3>{selectedClub.club.clubName} - Details</h3>
                            <button onClick={() => setShowClubModal(false)} className="close-btn" style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#fff'}}>&times;</button>
                        </div>
                        <div className="club-details-scroll">
                            <h4>Staff Coordinators</h4>
                            <ul>
                                {selectedClub.club.coordinators?.map(c => (
                                    <li key={c._id}>{c.name} ({c.email})</li>
                                ))}
                            </ul>

                            <h4>Recent Events</h4>
                            <div className="mini-events-list">
                                {selectedClub.events.all?.length === 0 ? <p>No events recorded.</p> : (
                                    selectedClub.events.all.slice(0, 5).map(e => (
                                        <div key={e._id} style={{padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', marginBottom: '10px'}}>
                                            <strong>{e.title}</strong> - {new Date(e.date).toLocaleDateString()}
                                            <span className={`status-badge ${e.status || 'pending'}`} style={{marginLeft: '10px', fontSize: '0.7rem'}}>
                                                {(e.status || 'pending').replace(/_/g, " ")}
                                            </span>
                                            {e.status === 'completed' && (
                                                <a href={`/event/report/${e._id}`} className="btn-secondary-link" style={{marginLeft: '10px', fontSize: '0.7rem'}}>📄 Report</a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <h4>Members ({selectedClub.club.members?.length || 0})</h4>
                            <div className="members-list" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                {selectedClub.club.members?.map(m => (
                                    <div key={m._id} style={{fontSize: '0.8rem', padding: '5px', borderBottom: '1px solid #333'}}>
                                        {m.name} ({m.registerNumber})
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-actions" style={{marginTop: '20px'}}>
                            <button onClick={() => setShowClubModal(false)} className="btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Reject Event Proposal</h3>
                        <p><strong>Event:</strong> {selectedEvent?.title}</p>
                        <div className="form-group" style={{marginTop: '15px'}}>
                            <label>Reason for Rejection *</label>
                            <textarea 
                                value={rejectionReason} 
                                onChange={(e) => setRejectionReason(e.target.value)} 
                                placeholder="Please explain why this event is being rejected..." 
                                rows="4" 
                                style={{width: '100%', marginTop: '5px'}}
                                required 
                            />
                        </div>
                        <div className="modal-actions" style={{marginTop: '20px'}}>
                            <button 
                                onClick={() => handleAction(selectedEvent._id, "Rejected", "reject", rejectionReason)} 
                                className="btn-primary" 
                                style={{backgroundColor: '#e74c3c'}}
                                disabled={!rejectionReason.trim()}
                            >
                                Confirm Rejection
                            </button>
                            <button onClick={() => setShowRejectModal(false)} className="btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HOD;
