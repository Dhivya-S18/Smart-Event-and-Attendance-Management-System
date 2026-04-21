import { useState, useEffect } from "react";
import API from "../api/api";
import "./Students.css";
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Admin = () => {
    const [events, setEvents] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [studentList, setStudentList] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [allUsers, setAllUsers] = useState([]);
    const [allEvents, setAllEvents] = useState([]);

    // Form States
    const [clubName, setClubName] = useState("");
    const [clubDesc, setClubDesc] = useState("");
    const [clubType, setClubType] = useState("department");
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [hodEmails, setHodEmails] = useState("");
    const [staffEmails, setStaffEmails] = useState("");
    const [eventVisibility, setEventVisibility] = useState("public");

    // Dept/Assoc Form States
    const [newDeptName, setNewDeptName] = useState("");
    const [newAssocName, setNewAssocName] = useState("");
    const [newAssocDept, setNewAssocDept] = useState("");

    const [departments, setDepartments] = useState([]);
    const [associations, setAssociations] = useState([]);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [clubsRes, analyticsRes, usersRes, deptsRes, assocRes] = await Promise.all([
                API.get("/clubs"),
                API.get("/analytics"),
                API.get("/users"),
                API.get("/admin/departments"),
                API.get("/admin/associations")
            ]);

            setClubs(clubsRes.data);
            setAnalytics(analyticsRes.data);
            setAllUsers(usersRes.data);
            setStaffList(usersRes.data.filter(u => u.role === 'staff' || u.role === 'hod'));
            setStudentList(usersRes.data.filter(u => u.role === 'student'));
            setDepartments(deptsRes.data);
            setAssociations(assocRes.data);

        } catch (err) {
            console.error("Error fetching admin data", err);
            setError("Failed to fetch dashboard data");
        }
    };

    const handleCreateClub = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            const { data } = await API.post("/clubs", {
                clubName: clubName,
                description: clubDesc,
                clubType: clubType,
                departmentIds: selectedDepts,
                hodEmails: hodEmails,
                staffEmails: staffEmails,
                eventVisibility: eventVisibility
            });
            setSuccess(`Club "${data.club.clubName}" created successfully!`);
            // Reset form
            setClubName(""); setClubDesc(""); 
            setSelectedDepts([]); setHodEmails(""); setStaffEmails("");
            // Refresh clubs immediately
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create club");
        }
    };

    const handleCreateDept = async (e) => {
        e.preventDefault();
        try {
            await API.post("/admin/departments", { name: newDeptName });
            setNewDeptName("");
            fetchData();
        } catch (err) { setError(err.response?.data?.message || "Failed to create department"); }
    };

    const handleCreateAssoc = async (e) => {
        e.preventDefault();
        try {
            await API.post("/admin/associations", { name: newAssocName, departmentId: newAssocDept });
            setNewAssocName(""); setNewAssocDept("");
            fetchData();
        } catch (err) { setError(err.response?.data?.message || "Failed to create association"); }
    };

    const handleGenerateCircular = async () => {
        try {
            setError("");
            setSuccess("");
            const { data } = await API.post("/analytics/circulars");
            setSuccess(data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to generate circular");
        }
    };

    const handleGenerateCertificate = async () => {
        try {
            setError("");
            setSuccess("");
            const { data } = await API.post("/analytics/certificates");
            setSuccess(data.message);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to generate certificate");
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h2>Admin Dashboard</h2>
                <p>Manage platform Clubs and Publish approved events</p>
            </header>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <div className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="form-section">
                    <h3>Manage Entities</h3>
                    <div style={{ background: '#f0f4f8', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                        <h4>Departments</h4>
                        <form onSubmit={handleCreateDept} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <input type="text" placeholder="Dept Name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} required />
                            <button type="submit" className="btn-primary">Add</button>
                        </form>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {departments.map(d => <li key={d._id}>{d.name}</li>)}
                        </ul>
                    </div>
                    <div style={{ background: '#f0f4f8', padding: '1rem', borderRadius: '8px' }}>
                        <h4>Associations</h4>
                        <form onSubmit={handleCreateAssoc} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                            <input type="text" placeholder="Assoc Name" value={newAssocName} onChange={e => setNewAssocName(e.target.value)} required style={{ flex: 1 }} />
                            <select value={newAssocDept} onChange={e => setNewAssocDept(e.target.value)} required>
                                <option value="">Select Dept</option>
                                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                            <button type="submit" className="btn-primary">Add</button>
                        </form>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {associations.map(a => <li key={a._id}>{a.name} ({a.departmentId?.name})</li>)}
                        </ul>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Create New Club</h3>
                    <form onSubmit={handleCreateClub} className="event-form">
                        <div className="form-group">
                            <label>Club Name</label>
                            <input type="text" value={clubName} onChange={e => setClubName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea value={clubDesc} onChange={e => setClubDesc(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Club Type</label>
                            <select value={clubType} onChange={e => setClubType(e.target.value)} required>
                                <option value="department">Department Club</option>
                                <option value="shared">Shared Club</option>
                                <option value="independent">Independent Club</option>
                            </select>
                        </div>
                        {clubType !== "independent" && (
                            <div className="form-group">
                                <label>Departments ({clubType === 'shared' ? 'Multi-select' : 'Select one'})</label>
                                <select 
                                    multiple={clubType === 'shared'} 
                                    value={selectedDepts} 
                                    onChange={e => {
                                        const values = Array.from(e.target.selectedOptions, option => option.value);
                                        setSelectedDepts(values);
                                    }} 
                                    required
                                >
                                    {departments.map(d => (
                                        <option key={d._id} value={d._id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Event Visibility</label>
                            <select value={eventVisibility} onChange={e => setEventVisibility(e.target.value)}>
                                <option value="public">Public (Any Student)</option>
                                <option value="members_only">Members Only</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Staff Coordinators (Comma-separated emails)</label>
                            <input 
                                type="text" 
                                value={staffEmails} 
                                onChange={e => setStaffEmails(e.target.value)}
                                placeholder="e.g. staff1@test.com, staff2@test.com"
                                required
                            />
                        </div>
                        {clubType !== "independent" && (
                            <div className="form-group">
                                <label>HOD Email(s) (Comma-separated)</label>
                                <input 
                                    type="text" 
                                    value={hodEmails} 
                                    onChange={e => setHodEmails(e.target.value)}
                                    placeholder="e.g. hod_cse@test.com"
                                />
                            </div>
                        )}
                        <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Create Club</button>
                    </form>
                </div>
            </div>

            <div className="list-section">
                <h3>Existing Clubs ({clubs.length})</h3>
                <div className="clubs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {clubs.map(club => (
                        <div key={club._id} style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '10px', borderLeft: '5px solid #4a90e2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>{club.clubName}</strong>
                                <span className={`badge ${club.clubType}`}>{club.clubType}</span>
                            </div>
                            <p style={{ fontSize: '0.9em', color: '#666' }}>{club.description.substring(0, 50)}...</p>
                            <div style={{ fontSize: '0.8em' }}>
                                <div>👁️ Visibility: {club.eventVisibility}</div>
                                <div>🧑‍🏫 Staff: {club.staffCoordinators?.length || 0}</div>
                                <div>🎓 SC: {club.studentCoordinators?.[0]?.name || 'N/A'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="analytics-section">
                <h3>Analytics</h3>
                <div className="stats-grid">
                    <div className="stat-card">
                        <h4>Total Events</h4>
                        <p>{analytics.totalEvents || 0}</p>
                    </div>
                    <div className="stat-card">
                        <h4>Total Users</h4>
                        <p>{analytics.totalUsers || 0}</p>
                    </div>
                    <div className="stat-card">
                        <h4>Total Clubs</h4>
                        <p>{analytics.totalClubs || 0}</p>
                    </div>
                </div>
                <div className="chart-container">
                    <Bar data={{
                        labels: analytics.eventsByStatus?.map(s => s._id) || [],
                        datasets: [{
                            label: 'Events by Status',
                            data: analytics.eventsByStatus?.map(s => s.count) || [],
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        }]
                    }} />
                </div>
            </div>

            <div className="list-section">
                <h3>All Users ({allUsers.length})</h3>
                <div className="users-list">
                    {allUsers.map(user => (
                        <div key={user._id} className="user-item">
                            {user.name} ({user.email}) - {user.role}
                        </div>
                    ))}
                </div>
            </div>

            <div className="list-section">
                <h3>All Events ({allEvents.length})</h3>
                <div className="events-list">
                    {allEvents.map(event => (
                        <div key={event._id} className="event-item">
                            <h4>{event.title}</h4>
                            <p>Status: {event.status}</p>
                            <p>Club: {event.clubId?.clubName || 'Unknown'}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="generate-section">
                <h3>Generate Documents</h3>
                <button onClick={handleGenerateCircular} className="btn-primary">Generate Circular</button>
                <button onClick={handleGenerateCertificate} className="btn-primary">Generate Certificate</button>
            </div>
        </div>
    );
};

export default Admin;
