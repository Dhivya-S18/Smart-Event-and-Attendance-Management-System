import { useState, useEffect, useContext } from "react";
import API from "../api/api";
import AuthContext from "../context/AuthContext";
import "./Students.css";

const Coordinator = () => {
    const { user } = useContext(AuthContext);
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState("my_requests");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        date: "",
        venue: "",
        hasRounds: false,
        eventRounds: 1,
        expectedParticipants: "",
        contactDetails: "",
        clubId: user?.clubId || ""
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (activeTab === "my_requests") {
            fetchMyRequests();
        }
    }, [activeTab]);

    const fetchMyRequests = async () => {
        try {
            const { data } = await API.get("/events/my-requests");
            setEvents(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            await API.post("/events/create", formData);
            setSuccess("Event proposal submitted successfully!");
            setFormData({
                ...formData,
                title: "",
                description: "",
                date: "",
                venue: "",
                hasRounds: false,
                eventRounds: 1,
                expectedParticipants: "",
                contactDetails: ""
            });
            setActiveTab("my_requests");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit proposal");
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>{user?.clubName || "Club"} Coordinator Dashboard</h2>
                <p>Propose events and manage club activities</p>
            </header>

            <div className="tabs-container">
                <button 
                    className={`tab ${activeTab === "my_requests" ? "active" : ""}`} 
                    onClick={() => setActiveTab("my_requests")}
                >
                    Club Event Requests
                </button>
                <button 
                    className={`tab ${activeTab === "propose" ? "active" : ""}`} 
                    onClick={() => setActiveTab("propose")}
                >
                    Propose New Event
                </button>
            </div>

            <div className="dashboard-content" style={{ gridTemplateColumns: '1fr' }}>
                {activeTab === "my_requests" && (
                    <div className="list-section">
                        <h3>Our Club's Event Requests</h3>
                        <div className="events-grid">
                            {events.length === 0 ? (
                                <p className="no-data">No event requests found for your club.</p>
                            ) : (
                                events.map((event) => (
                                    <div key={event._id} className="event-card">
                                        <h4>{event.title}</h4>
                                        <p>{event.description}</p>
                                        <div className="event-meta">
                                            <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                                            <span>📍 {event.venue}</span>
                                        </div>
                                        <div className="status-badge-container" style={{ marginTop: '10px' }}>
                                            <span className={`status-badge ${event.status}`}>
                                                {event.status.replace(/_/g, " ").toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "propose" && (
                    <div className="form-section">
                        <h3>Event Proposal Form</h3>
                        {error && <div className="message error">{error}</div>}
                        {success && <div className="message success">{success}</div>}
                        <form onSubmit={handleSubmit} className="event-form">
                            <div className="form-group">
                                <label>Event Title</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date</label>
                                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Venue</label>
                                    <input type="text" name="venue" value={formData.venue} onChange={handleInputChange} required />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input type="checkbox" name="hasRounds" checked={formData.hasRounds} onChange={handleInputChange} />
                                        Multiple Rounds?
                                    </label>
                                </div>
                                {formData.hasRounds && (
                                    <div className="form-group">
                                        <label>Number of Rounds</label>
                                        <input type="number" name="eventRounds" value={formData.eventRounds} onChange={handleInputChange} min="1" />
                                    </div>
                                )}
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Expected Participants</label>
                                    <input type="number" name="expectedParticipants" value={formData.expectedParticipants} onChange={handleInputChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Contact Details</label>
                                    <input type="text" name="contactDetails" value={formData.contactDetails} onChange={handleInputChange} required />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary">Submit Proposal</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Coordinator;
