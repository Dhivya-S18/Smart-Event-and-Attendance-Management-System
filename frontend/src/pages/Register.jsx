import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import "./Students.css";

const Register = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        studentName: "",
        registerNumber: "",
        department: "",
        email: "",
        phone: "",
        teamMembers: []
    });
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        fetchEventDetails();
    }, [eventId]);

    const fetchEventDetails = async () => {
        try {
            // We'll use a public endpoint or similar
            const { data } = await API.get(`/events/published`);
            const foundEvent = data.find(e => e._id === eventId);
            if (foundEvent) {
                setEvent(foundEvent);
                // Initialize team members if it's a team event
                if (foundEvent.isTeamEvent) {
                    const emptyMembers = Array(foundEvent.maxTeamSize - 1).fill({ name: "", registerNumber: "" });
                    setFormData(prev => ({ ...prev, teamMembers: emptyMembers }));
                }
            }
            setLoading(false);
        } catch (err) {
            console.error("Error fetching event", err);
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTeamMemberChange = (index, field, value) => {
        const updatedMembers = [...formData.teamMembers];
        updatedMembers[index] = { ...updatedMembers[index], [field]: value };
        setFormData({ ...formData, teamMembers: updatedMembers });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        try {
            await API.post(`/events/${eventId}/register`, formData);
            setMessage({ type: "success", text: "Registration successful! You will receive a confirmation email shortly." });
            setTimeout(() => navigate("/"), 3000);
        } catch (err) {
            setMessage({ type: "error", text: err.response?.data?.message || "Registration failed" });
        }
    };

    if (loading) return <div className="loading">Loading Registration Form...</div>;
    if (!event) return <div className="error-page">Event not found or registration closed.</div>;

    return (
        <div className="dashboard-container" style={{background: '#f0f2f5', minHeight: '100vh', padding: '40px 20px'}}>
            <div className="form-container" style={{maxWidth: '740px', margin: '0 auto'}}>
                {/* Header Card */}
                <div className="gform-header" style={{
                    background: 'white', 
                    borderRadius: '8px', 
                    borderTop: '10px solid var(--primary-color)', 
                    padding: '24px',
                    marginBottom: '12px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                }}>
                    <h1 style={{fontSize: '32px', marginBottom: '8px', color: '#202124'}}>{event.title}</h1>
                    <p style={{fontSize: '14px', color: '#5f6368', marginBottom: '16px'}}>Organized by {event.clubId?.clubName}</p>
                    
                    {event.clubId?.eventVisibility === 'members_only' && (
                        <div style={{
                            display: 'inline-block',
                            background: '#fef7e0',
                            color: '#b06000',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            marginBottom: '16px',
                            border: '1px solid #ffe168'
                        }}>
                            🔒 Members Only Event
                        </div>
                    )}

                    <div style={{borderTop: '1px solid #dadce0', paddingTop: '16px', fontSize: '14px', color: '#202124'}}>
                        <p><strong>📍 Venue:</strong> {event.venue}</p>
                        <p><strong>📅 Date:</strong> {new Date(event.date).toLocaleDateString()}</p>
                        {event.time && <p><strong>⏰ Time:</strong> {event.time}</p>}
                    </div>
                </div>

                {message.text && (
                    <div className={`message ${message.type}`} style={{
                        borderRadius: '8px', 
                        padding: '16px', 
                        marginBottom: '12px',
                        background: message.type === 'success' ? '#e6f4ea' : '#fce8e6',
                        color: message.type === 'success' ? '#137333' : '#c5221f',
                        border: '1px solid currentColor'
                    }}>
                        {message.text}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    {/* Basic Info Card */}
                    <div className="gform-card" style={{
                        background: 'white', 
                        borderRadius: '8px', 
                        padding: '24px',
                        marginBottom: '12px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{fontSize: '16px', marginBottom: '20px', color: '#202124', fontWeight: '500'}}>
                            {event.isTeamEvent ? "Lead Participant Details" : "Registration Information"}
                        </h3>
                        
                        <div className="gform-field" style={{marginBottom: '24px'}}>
                            <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Full Name *</label>
                            <input 
                                type="text" 
                                name="studentName" 
                                value={formData.studentName} 
                                onChange={handleInputChange} 
                                required 
                                style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none', transition: 'border-color 0.2s'}}
                                onFocus={(e) => e.target.style.borderBottom = '2px solid var(--primary-color)'}
                                onBlur={(e) => e.target.style.borderBottom = '1px solid #dadce0'}
                            />
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px'}}>
                            <div className="gform-field">
                                <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Register Number *</label>
                                <input 
                                    type="text" 
                                    name="registerNumber" 
                                    value={formData.registerNumber} 
                                    onChange={handleInputChange} 
                                    required 
                                    style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                />
                            </div>
                            <div className="gform-field">
                                <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Department *</label>
                                <input 
                                    type="text" 
                                    name="department" 
                                    value={formData.department} 
                                    onChange={handleInputChange} 
                                    required 
                                    style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                />
                            </div>
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px'}}>
                            <div className="gform-field">
                                <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Email Address *</label>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email} 
                                    onChange={handleInputChange} 
                                    required 
                                    style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                />
                            </div>
                            <div className="gform-field">
                                <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Phone Number *</label>
                                <input 
                                    type="text" 
                                    name="phone" 
                                    value={formData.phone} 
                                    onChange={handleInputChange} 
                                    required 
                                    style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Team Members Card */}
                    {event.isTeamEvent && (
                        <div className="gform-card" style={{
                            background: 'white', 
                            borderRadius: '8px', 
                            padding: '24px',
                            marginBottom: '12px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                        }}>
                            <h3 style={{fontSize: '16px', marginBottom: '20px', color: '#202124', fontWeight: '500'}}>Team Members</h3>
                            {formData.teamMembers.map((member, index) => (
                                <div key={index} style={{marginBottom: '24px', borderBottom: index < formData.teamMembers.length - 1 ? '1px solid #f0f0f0' : 'none', paddingBottom: '16px'}}>
                                    <p style={{fontSize: '14px', color: 'var(--primary-color)', marginBottom: '12px', fontWeight: 'bold'}}>Member {index + 2}</p>
                                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px'}}>
                                        <div className="gform-field">
                                            <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Name *</label>
                                            <input 
                                                type="text" 
                                                placeholder="Enter name"
                                                value={member.name} 
                                                onChange={(e) => handleTeamMemberChange(index, "name", e.target.value)} 
                                                required 
                                                style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                            />
                                        </div>
                                        <div className="gform-field">
                                            <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', color: '#202124'}}>Register Number *</label>
                                            <input 
                                                type="text" 
                                                placeholder="Enter register no"
                                                value={member.registerNumber} 
                                                onChange={(e) => handleTeamMemberChange(index, "registerNumber", e.target.value)} 
                                                required 
                                                style={{width: '100%', border: 'none', borderBottom: '1px solid #dadce0', padding: '8px 0', outline: 'none'}}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px'}}>
                        <button type="submit" className="btn-primary" style={{
                            background: 'var(--primary-color)', 
                            color: 'white', 
                            border: 'none', 
                            padding: '10px 24px', 
                            borderRadius: '4px', 
                            fontSize: '14px', 
                            fontWeight: '500', 
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}>
                            Submit Response
                        </button>
                        <button type="button" onClick={() => navigate("/")} style={{
                            background: 'transparent', 
                            color: '#5f6368', 
                            border: 'none', 
                            fontSize: '14px', 
                            cursor: 'pointer'
                        }}>
                            Cancel
                        </button>
                    </div>
                </form>
                
                <p style={{textAlign: 'center', marginTop: '30px', color: '#5f6368', fontSize: '12px'}}>
                    This form was created inside Club Event Management System.
                </p>
            </div>
        </div>
    );
};

export default Register;
