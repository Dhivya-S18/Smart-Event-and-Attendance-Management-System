import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import "./Students.css"; // Reuse styling for consistency

const PublicEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetchPublishedEvents();
    }, []);

    const fetchPublishedEvents = async () => {
        try {
            const { data } = await API.get("/events/published");
            setEvents(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching events", err);
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading Events...</div>;

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>Upcoming Club Events</h2>
                <p>Register for events and participate in club activities</p>
            </header>

            <div className="dashboard-content" style={{ gridTemplateColumns: "1fr" }}>
                <div className="list-section">
                    <div className="events-grid">
                        {events.length === 0 ? (
                            <p className="no-data">No published events currently available.</p>
                        ) : (
                            events.map((event) => (
                                <div key={event._id} className="event-card" onClick={() => {setSelectedEvent(event); setShowModal(true)}} style={{cursor: 'pointer'}}>
                                    <div className="event-header-info">
                                        <h4>{event.title}</h4>
                                        <span className="event-club-tag">{event.clubId?.clubName || "Club"}</span>
                                    </div>
                                    <p className="description">{event.description}</p>
                                    <div className="event-meta">
                                        <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                                        <span>📍 {event.venue}</span>
                                    </div>

                                    {event.registrationEnabled ? (
                                        <Link 
                                            to={`/event/register/${event._id}`} 
                                            className="btn-primary" 
                                            style={{ marginTop: '15px', display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Register Now
                                        </Link>
                                    ) : (
                                        <p className="status-note" style={{marginTop: '15px'}}>Registration opening soon</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Event Detail Modal */}
            {showModal && selectedEvent && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content event-detail-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px', width: '90%'}}>
                        <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                        
                        <div className="modal-body" style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                            {selectedEvent.posterImage && (
                                <div className="detail-poster" style={{width: '100%', maxHeight: '400px', overflow: 'hidden', borderRadius: '8px'}}>
                                    <img 
                                        src={`https://smart-event-and-attendance-management.onrender.com${selectedEvent.posterImage}`} 
                                        alt="Event Poster" 
                                        style={{width: '100%', height: '100%', objectFit: 'contain', background: '#f5f5f5'}} 
                                    />
                                </div>
                            )}
                            
                            <div className="detail-info">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'}}>
                                    <div>
                                        <h2 style={{margin: 0, color: 'var(--primary-color)'}}>{selectedEvent.title}</h2>
                                        <p style={{color: '#666', fontWeight: 'bold'}}>{selectedEvent.clubId?.clubName || "Club"}</p>
                                    </div>
                                    <span className="event-dept-tag" style={{background: 'var(--accent)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem'}}>
                                        {selectedEvent.department}
                                    </span>
                                </div>
                                
                                <p className="detail-description" style={{lineHeight: '1.6', color: '#444', marginBottom: '20px'}}>
                                    {selectedEvent.description}
                                </p>
                                
                                <div className="detail-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', padding: '15px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '20px'}}>
                                    <div>
                                        <strong>📅 Date:</strong> {new Date(selectedEvent.date).toLocaleDateString()}
                                    </div>
                                    <div>
                                        <strong>⏰ Time:</strong> {selectedEvent.time || "TBA"}
                                    </div>
                                    <div>
                                        <strong>📍 Venue:</strong> {selectedEvent.venue}
                                    </div>
                                    <div>
                                        <strong>🏢 Dept:</strong> {selectedEvent.department}
                                    </div>
                                    <div>
                                        <strong>👥 Registrations:</strong> <span style={{color: 'var(--primary-color)', fontWeight: 'bold'}}>{selectedEvent.registrationCount || 0}</span>
                                    </div>
                                </div>

                                <div className="detail-actions" style={{display: 'flex', gap: '15px'}}>
                                    {selectedEvent.registrationEnabled ? (
                                        <Link 
                                            to={`/event/register/${selectedEvent._id}`} 
                                            className="btn-primary" 
                                            style={{flex: 1, textAlign: 'center', textDecoration: 'none', padding: '12px'}}
                                        >
                                            Register for Event
                                        </Link>
                                    ) : (
                                        <button className="btn-primary" disabled style={{flex: 1, opacity: 0.6}}>Registration Pending</button>
                                    )}
                                    
                                    {selectedEvent.circularPdf && (
                                        <a 
                                            href={`https://smart-event-and-attendance-management.onrender.com${selectedEvent.circularPdf}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="btn-secondary"
                                            style={{flex: 1, textAlign: 'center', textDecoration: 'none', padding: '12px'}}
                                        >
                                            View Official Circular
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicEvents;
