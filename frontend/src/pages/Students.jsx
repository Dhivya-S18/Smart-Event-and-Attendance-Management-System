import { useState, useEffect, useContext } from "react";
import API from "../api/api";
import AuthContext from "../context/AuthContext";
import EventReportForm from "../components/EventReportForm";
import "./Students.css";

const Students = () => {
    const [events, setEvents] = useState([]);
    const [publishedEvents, setPublishedEvents] = useState([]);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        rules: "",
        date: "",
        venue: "",
        isTeamEvent: false,
        maxParticipants: 100,
        maxTeams: 20,
        maxTeamSize: 4,
        selectedStaff: "",
        hasRounds: false,
        eventRounds: 1,
        expectedParticipants: 50,
        contactDetails: "",
    });
    const [clubs, setClubs] = useState([]);
    const { user } = useContext(AuthContext); // Access logged in user info
    const [message, setMessage] = useState({ type: "", text: "" });
    const [activeTab, setActiveTab] = useState("published");
    const [feedbackData, setFeedbackData] = useState({ rating: 5, comments: "" });

    const [showPosterModal, setShowPosterModal] = useState(false);
    const [showCircularModal, setShowCircularModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [posterData, setPosterData] = useState({ tagline: "", templateId: "1", staffCoordinator2: "", studentCoordinator2: "" });
    const [circularData, setCircularData] = useState({ rules: "", teamMembers: "" });

    useEffect(() => {
        fetchClubEvents();
        fetchPublishedEvents();
        fetchClubs();
    }, []);

    const fetchClubEvents = async () => {
        try {
            const { data } = await API.get("/events/status"); // This returns club events for staff/student if filtered correctly
            setEvents(data);
        } catch (error) {
            console.error("Error fetching club events", error);
        }
    };

    const fetchPublishedEvents = async () => {
        try {
            const { data } = await API.get("/events/published");
            setPublishedEvents(data);
        } catch (error) {
            console.error("Error fetching published events", error);
        }
    };

    const fetchClubs = async () => {
        try {
            const { data } = await API.get("/clubs");
            setClubs(data);
        } catch (error) {
            console.error("Error fetching clubs", error);
        }
    }

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        try {
            await API.post("/events/create", formData);
            setMessage({ type: "success", text: "Event request submitted successfully!" });
            setFormData({ 
                title: "", 
                description: "", 
                rules: "", 
                date: "", 
                venue: "", 
                isTeamEvent: false, 
                maxParticipants: 100, 
                maxTeams: 20, 
                maxTeamSize: 4, 
                selectedStaff: "", 
                hasRounds: false, 
                eventRounds: 1, 
                expectedParticipants: 50, 
                contactDetails: "" 
            });
            fetchClubEvents();
            setActiveTab("my-requests");
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.message || "Failed to create event" });
        }
    };

    const handleRegister = async (eventId) => {
        try {
            await API.post(`/events/${eventId}/register`);
            alert("Successfully registered!");
            fetchPublishedEvents();
        } catch (error) {
            alert(error.response?.data?.message || "Registration failed");
        }
    };

    const handleWorkflowAction = async (id, endpoint, method = "post") => {
        try {
            setMessage({ type: "", text: "" });
            if (method === "post") {
                await API.post(`/events/${id}/${endpoint}`);
            } else {
                await API.put(`/events/${id}/${endpoint}`);
            }
            fetchClubEvents();
            setMessage({ type: "success", text: `${endpoint.replace("-", " ").toUpperCase()} completed successfully!` });
        } catch (error) {
            setMessage({ type: "error", text: error.response?.data?.message || `Failed to ${endpoint}` });
        }
    };

    const handleFeedbackSubmit = async (eventId, e) => {
        e.preventDefault();
        try {
            await API.post(`/feedback`, { eventId, ...feedbackData });
            alert("Feedback submitted successfully!");
            setFeedbackData({ rating: 5, comments: "" });
        } catch (error) {
            alert(error.response?.data?.message || "Feedback submission failed");
        }
    };

    const handlePosterDetails = async (e) => {
        e.preventDefault();
        try {
            await API.post(`/events/${selectedEvent._id}/generate-poster`, posterData);
            setShowPosterModal(false);
            fetchClubEvents();
            alert("Poster generated successfully!");
        } catch (error) {
            alert("Failed to generate poster");
        }
    };

    const handleCircularDetails = async (e) => {
        e.preventDefault();
        try {
            await API.post(`/events/${selectedEvent._id}/generate-circular`, circularData);
            setShowCircularModal(false);
            fetchClubEvents();
            alert("Circular generated successfully!");
        } catch (error) {
            alert("Failed to generate circular");
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await API.put(`/events/${selectedEvent._id}/update`, formData);
            setShowEditModal(false);
            fetchClubEvents();
            alert("Event updated and resubmitted successfully!");
        } catch (error) {
            alert(error.response?.data?.message || "Failed to update event");
        }
    };

    const openEditModal = (event) => {
        setSelectedEvent(event);
        setFormData({
            title: event.title,
            description: event.description,
            rules: event.rules || "",
            date: event.date.split('T')[0],
            venue: event.venue,
            isTeamEvent: event.isTeamEvent || false,
            maxParticipants: event.maxParticipants || 100,
            maxTeams: event.maxTeams || 20,
            maxTeamSize: event.maxTeamSize || 4,
            selectedStaff: event.selectedStaff || "",
            hasRounds: event.hasRounds || false,
            eventRounds: event.eventRounds || 1,
            expectedParticipants: event.expectedParticipants || 50,
            contactDetails: event.contactDetails || "",
        });
        setShowEditModal(true);
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>Member Dashboard</h2>
                <p>Welcome! View your club's details and upcoming events.</p>
            </header>

            <div className="tabs-container">
                <button className={`tab ${activeTab === "published" ? "active" : ""}`} onClick={() => setActiveTab("published")}>Published Events</button>
                {user?.clubId && (
                    <>
                        <button className={`tab ${activeTab === "my-requests" ? "active" : ""}`} onClick={() => setActiveTab("my-requests")}>Club Workflow</button>
                        <button className={`tab ${activeTab === "create" ? "active" : ""}`} onClick={() => setActiveTab("create")}>Propose Event</button>
                    </>
                )}
            </div>

            <div className="dashboard-content">
                {activeTab === "published" && (
                    <div className="list-section">
                        <h3>Upcoming Published Events</h3>
                        <div className="events-grid">
                            {publishedEvents.length === 0 ? (
                                <p className="no-data">No published events currently available.</p>
                            ) : (
                                publishedEvents.map((event) => (
                                    <div key={event._id} className="event-card">
                                        <h4>{event.title}</h4>
                                        <p className="event-date"><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                                        <p className="event-venue"><strong>Venue:</strong> {event.venue}</p>
                                        <p><strong>Club:</strong> {event.clubId?.clubName || 'Unknown Club'}</p>
                                        <p>{event.description}</p>
                                        
                                        <div className="document-links">
                                            {event.circularPdf && <a href={`https://smart-event-and-attendance-management.onrender.com${event.circularPdf}`} target="_blank" rel="noreferrer" className="btn-secondary-link">View Circular</a>}
                                            {event.posterImage && <a href={`https://smart-event-and-attendance-management.onrender.com${event.posterImage}`} target="_blank" rel="noreferrer" className="btn-secondary-link">View Poster</a>}
                                        </div>

                                        {event.registrationEnabled && (
                                            <div className="registration-section">
                                                <button onClick={() => handleRegister(event._id)} className="btn-primary">Register Now</button>
                                            </div>
                                        )}

                                        <div className="feedback-section" style={{marginTop: '15px', borderTop: '1px solid #ccc', paddingTop: '10px'}}>
                                            <h5>Provide Feedback</h5>
                                            <form onSubmit={(e) => handleFeedbackSubmit(event._id, e)}>
                                                <input type="number" min="1" max="5" value={feedbackData.rating} onChange={(e) => setFeedbackData({...feedbackData, rating: e.target.value})} placeholder="Rating 1-5" required style={{width: '60px', marginRight: '10px'}} />
                                                <input type="text" value={feedbackData.comments} onChange={(e) => setFeedbackData({...feedbackData, comments: e.target.value})} placeholder="Comments..." style={{width: '60%'}} />
                                                <button type="submit" className="btn-secondary" style={{marginLeft: '10px'}}>Submit</button>
                                            </form>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "my-requests" && (
                    <div className="list-section">
                        <h3>Club Events - Preparation Workflow</h3>
                        <div className="events-grid">
                            {events.length === 0 ? (
                                <p className="no-data">No active event workflows for your club.</p>
                            ) : (
                                events.map((event) => (
                                    <div key={event._id} className="event-card">
                                        <div className="card-header" style={{display: 'flex', justifyContent: 'space-between'}}>
                                            <h4>{event.title}</h4>
                                            <span className={`status-badge ${event.status || 'pending'}`}>
                                                {(event.status || 'pending').replace(/_/g, " ").toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="event-date"><strong>Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                                        <p><strong>Registrations:</strong> <span style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{event.registrationCount || 0}</span></p>
                                        

                                        {event.status === "circular_creation_pending" && (
                                            <div className="workflow-steps" style={{marginTop: '20px', borderTop: '1px solid #444', paddingTop: '15px'}}>
                                                <h5 style={{color: '#3498db', marginBottom: '15px'}}>Preparation Workflow (5 Required Steps)</h5>
                                                
                                                <div className="workflow-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                                                    <div className="step-item">
                                                        <p><strong>1. Circular Details</strong></p>
                                                        <button onClick={() => {setSelectedEvent(event); setShowCircularModal(true)}} className="btn-secondary" style={{width: '100%', fontSize: '0.8rem'}} disabled={!!event.circularPdf}>
                                                            {event.circularPdf ? "Generated ✓" : "Prepare Circular"}
                                                        </button>
                                                    </div>

                                                    <div className="step-item">
                                                        <p><strong>2. Poster Preparation</strong></p>
                                                        <button onClick={() => {setSelectedEvent(event); setShowPosterModal(true)}} className="btn-secondary" style={{width: '100%', fontSize: '0.8rem'}} disabled={!!event.posterImage}>
                                                            {event.posterImage ? "Generated ✓" : "Prepare Poster"}
                                                        </button>
                                                    </div>

                                                    <div className="step-item">
                                                        <p><strong>3. Registration Link</strong></p>
                                                        <button onClick={() => handleWorkflowAction(event._id, "create-registration")} className="btn-secondary" style={{width: '100%', fontSize: '0.8rem'}} disabled={!!event.registrationLink}>
                                                            {event.registrationLink ? "Created ✓" : "Generate Link"}
                                                        </button>
                                                    </div>

                                                    <div className="step-item">
                                                        <p><strong>4. Feedback Link</strong></p>
                                                        <button onClick={() => handleWorkflowAction(event._id, "create-feedback")} className="btn-secondary" style={{width: '100%', fontSize: '0.8rem'}} disabled={!!event.feedbackLink}>
                                                            {event.feedbackLink ? "Created ✓" : "Generate Link"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="step-item" style={{marginTop: '15px'}}>
                                                    <p><strong>5. Submit to HOD</strong></p>
                                                    <button onClick={() => handleWorkflowAction(event._id, "submit-hod", "put")} className="btn-primary" style={{width: '100%', background: '#27ae60'}} disabled={!event.circularPdf || !event.posterImage || !event.registrationLink || !event.feedbackLink}>
                                                        Send for Final Approval
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {event.staffFeedback && (
                                            <div className="staff-feedback" style={{marginTop: '10px', padding: '10px', background: 'rgba(230, 126, 34, 0.1)', borderRadius: '5px', fontSize: '0.9rem'}}>
                                                <strong>Staff Note:</strong> {event.staffFeedback}
                                            </div>
                                        )}
                                        {event.hodFeedback && (
                                            <div className="hod-feedback" style={{marginTop: '10px', padding: '10px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '5px', fontSize: '0.9rem', borderLeft: '4px solid #e74c3c'}}>
                                                <strong>HOD Feedback:</strong> {event.hodFeedback}
                                            </div>
                                        )}
                                        {event.status === "published" && (
                                            <button 
                                                onClick={() => handleWorkflowAction(event._id, "close", "put")} 
                                                className="btn-primary" 
                                                style={{marginTop: '10px', width: '100%', background: '#8e44ad'}}
                                            >
                                                🏁 Mark Event as Completed
                                            </button>
                                        )}
                                        {event.status === "completed" && (
                                            <button 
                                                onClick={() => {
                                                    setSelectedEvent(event);
                                                    setShowReportModal(true);
                                                }} 
                                                className="btn-primary" 
                                                style={{marginTop: '10px', width: '100%', background: '#e67e22'}}
                                            >
                                                📄 Manage Event Report
                                            </button>
                                        )}
                                        {event.status === "rejected" && (
                                            <button 
                                                onClick={() => openEditModal(event)} 
                                                className="btn-primary" 
                                                style={{marginTop: '10px', width: '100%', background: '#e67e22'}}
                                            >
                                                Edit & Resubmit Proposal
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "create" && (
                    <div className="form-section">
                        <h3>Propose a New Event</h3>
                        {message.text && (
                            <div className={`message ${message.type}`}>
                                {message.text}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="event-form">
                            <div className="form-group">
                                <label>Event Title</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} required rows="3" />
                            </div>
                            <div className="form-group">
                                <label>Event Rules</label>
                                <textarea name="rules" value={formData.rules || ""} onChange={handleInputChange} placeholder="Specify rules for the event..." rows="3" />
                            </div>
                            <div className="form-row" style={{display: 'flex', gap: '15px'}}>
                                <div className="form-group" style={{flex: 1}}>
                                    <label>Date</label>
                                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                                </div>
                                <div className="form-group" style={{flex: 1}}>
                                    <label>Venue</label>
                                    <input type="text" name="venue" value={formData.venue} onChange={handleInputChange} required />
                                </div>
                            </div>
                            <div className="form-row" style={{display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px'}}>
                                <div className="form-group" style={{flex: 1}}>
                                    <label>Team Event?</label>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleInputChange} />
                                        <span>Yes</span>
                                    </div>
                                </div>
                                {formData.isTeamEvent ? (
                                    <div style={{display: 'flex', gap: '15px', flex: 1}}>
                                        <div className="form-group" style={{flex: 1}}>
                                            <label>Registration Limit (Max Teams)</label>
                                            <input type="number" name="maxTeams" value={formData.maxTeams} onChange={handleInputChange} min="1" />
                                        </div>
                                        <div className="form-group" style={{flex: 1}}>
                                            <label>Team Size</label>
                                            <input type="number" name="maxTeamSize" value={formData.maxTeamSize} onChange={handleInputChange} min="2" max="20" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="form-group" style={{flex: 1}}>
                                        <label>Registration Limit (Max Participants)</label>
                                        <input type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleInputChange} min="1" />
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Select Staff Coordinator (for approval)</label>
                                <select name="selectedStaff" value={formData.selectedStaff || ""} onChange={handleInputChange} required>
                                    <option value="">-- Choose Coordinator --</option>
                                    {clubs.find(c => c._id === user?.clubId)?._id && 
                                        clubs.find(c => c._id === user?.clubId).coordinators?.map(staff => (
                                            <option key={staff._id} value={staff._id}>{staff.name} ({staff.department})</option>
                                        ))
                                    }
                                </select>
                                <p style={{fontSize: '0.8rem', color: '#888', marginTop: '5px'}}>* This coordinator will be notified for approval.</p>
                            </div>
                            <button type="submit" className="btn-primary">Submit Event Proposal</button>
                        </form>
                    </div>
                )}
            </div>

            {/* Poster Details Modal */}
            {showPosterModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Poster Preparation Form</h3>
                        <form onSubmit={handlePosterDetails} className="event-form">
                            <div className="form-group">
                                <label>Poster Tagline</label>
                                <input type="text" value={posterData.tagline} onChange={(e) => setPosterData({...posterData, tagline: e.target.value})} placeholder="Catchy slogan for the poster..." required />
                            </div>
                            <div className="form-group" style={{marginTop: '15px'}}>
                                <label>Select Design Template</label>
                                <select value={posterData.templateId} onChange={(e) => setPosterData({...posterData, templateId: e.target.value})} required style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}>
                                    <option value="1">Template 1: Tech & Hackathon (Neon Dark)</option>
                                    <option value="2">Template 2: Minimal Academic (Light & Clean)</option>
                                    <option value="3">Template 3: Dark Corporate (Professional)</option>
                                    <option value="4">Template 4: Vibrant Fest (Pink & Orange)</option>
                                    <option value="5">Template 5: Cyberpunk (Red & Gold)</option>
                                </select>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                                    All templates automatically include the National Engineering College logo and name.
                                </div>
                            </div>
                            <div className="form-group" style={{marginTop: '15px'}}>
                                <label>Second Staff Coordinator</label>
                                <select 
                                    value={posterData.staffCoordinator2} 
                                    onChange={(e) => setPosterData({...posterData, staffCoordinator2: e.target.value})} 
                                    required
                                    style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
                                >
                                    <option value="">-- Choose Staff Coordinator --</option>
                                    {selectedEvent && clubs.find(c => c._id === (selectedEvent.clubId?._id || selectedEvent.clubId))?.coordinators
                                        ?.filter(staff => staff._id !== (selectedEvent.selectedStaff?._id || selectedEvent.selectedStaff))
                                        ?.map(staff => (
                                            <option key={staff._id} value={staff.name}>{staff.name} ({staff.department})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{marginTop: '15px'}}>
                                <label>Second Student Coordinator</label>
                                <select 
                                    value={posterData.studentCoordinator2} 
                                    onChange={(e) => setPosterData({...posterData, studentCoordinator2: e.target.value})} 
                                    required
                                    style={{width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px'}}
                                >
                                    <option value="">-- Choose Student Coordinator --</option>
                                    {selectedEvent && clubs.find(c => c._id === (selectedEvent.clubId?._id || selectedEvent.clubId))?.members
                                        ?.filter(member => member._id !== (selectedEvent.createdBy?._id || selectedEvent.createdBy))
                                        ?.map(member => (
                                            <option key={member._id} value={member.name}>{member.name} ({member.registerNumber})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-actions" style={{marginTop: '20px'}}>
                                <button type="submit" className="btn-primary">Generate Poster Image</button>
                                <button type="button" onClick={() => setShowPosterModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Circular Details Modal */}
            {showCircularModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Circular Preparation Form</h3>
                        <form onSubmit={handleCircularDetails} className="event-form">
                            <div className="form-group">
                                <label>Official Rules</label>
                                <textarea value={circularData.rules} onChange={(e) => setCircularData({...circularData, rules: e.target.value})} placeholder="Detailed rules for the circular..." rows="4" required />
                            </div>
                            <div className="form-group">
                                <label>Team/Committee Members</label>
                                <textarea value={circularData.teamMembers} onChange={(e) => setCircularData({...circularData, teamMembers: e.target.value})} placeholder="Names of organizers/volunteers..." rows="3" />
                            </div>
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">Generate Official PDF</button>
                                <button type="button" onClick={() => setShowCircularModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Proposal Modal */}
            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '600px'}}>
                        <h3>Edit & Resubmit Event Proposal</h3>
                        <form onSubmit={handleEditSubmit} className="event-form">
                            <div className="form-group">
                                <label>Event Title</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} required rows="3" />
                            </div>
                            <div className="form-group">
                                <label>Event Rules</label>
                                <textarea name="rules" value={formData.rules} onChange={handleInputChange} rows="3" />
                            </div>
                            <div className="form-row" style={{display: 'flex', gap: '15px'}}>
                                <div className="form-group" style={{flex: 1}}>
                                    <label>Date</label>
                                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                                </div>
                                <div className="form-group" style={{flex: 1}}>
                                    <label>Venue</label>
                                    <input type="text" name="venue" value={formData.venue} onChange={handleInputChange} required />
                                </div>
                            </div>
                            <div className="modal-actions" style={{marginTop: '20px'}}>
                                <button type="submit" className="btn-primary">Update & Resubmit</button>
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Report Modal */}
            {showReportModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '850px', width: '95%', padding: '0'}}>
                        <EventReportForm 
                            eventId={selectedEvent?._id} 
                            onClose={() => setShowReportModal(false)}
                            onSave={() => {
                                fetchClubEvents();
                                setShowReportModal(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Students;
