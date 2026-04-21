import React, { useState, useEffect } from 'react';
import axios from 'axios';

const EventReportForm = ({ eventId, onClose, onSave }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reportData, setReportData] = useState({
        description: '',
        rounds: [{ roundName: '', roundDescription: '' }],
        winners: [{ studentName: '', registerNumber: '', email: '', department: '', year: '', ranking: '' }],
        photos: [],
        posterUrl: '',
        staffCoordinator: '',
        hod: '',
        dean: '',
        principal: ''
    });

    useEffect(() => {
        fetchReport();
    }, [eventId]);

    const fetchReport = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/reports/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data && res.data._id) {
                setReportData(res.data);
            } else if (res.data.eventDetails) {
                // Initialize with some event info if no report exists
                setReportData(prev => ({
                    ...prev,
                    description: res.data.eventDetails.description || ''
                }));
            }
        } catch (err) {
            console.error("Error fetching report:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setReportData(prev => ({ ...prev, [name]: value }));
    };

    const handleArrayChange = (index, field, value, type) => {
        const newArray = [...reportData[type]];
        newArray[index][field] = value;
        setReportData(prev => ({ ...prev, [type]: newArray }));
    };

    const addArrayItem = (type) => {
        const newItem = type === 'rounds' 
            ? { roundName: '', roundDescription: '' } 
            : { studentName: '', registerNumber: '', email: '', department: '', year: '', ranking: '' };
        setReportData(prev => ({ ...prev, [type]: [...prev[type], newItem] }));
    };

    const removeArrayItem = (index, type) => {
        const newArray = reportData[type].filter((_, i) => i !== index);
        setReportData(prev => ({ ...prev, [type]: newArray }));
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const token = localStorage.getItem('token');
        if (!token) {
            alert("Your session has expired. Please log in again.");
            window.location.href = '/login';
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await axios.post('http://localhost:5000/api/reports/upload-photo', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            setReportData(prev => ({
                ...prev,
                photos: [...prev.photos, { url: res.data.imageUrl, caption: '' }]
            }));
        } catch (err) {
            console.error("Upload error:", err);
            const status = err.response?.status;
            if (status === 401) {
                alert("Unauthorized: Please log in again.");
                window.location.href = '/login';
            } else {
                alert("Photo upload failed: " + (err.response?.data?.message || err.message));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/reports', { ...reportData, eventId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Report saved successfully!");
            if (onSave) onSave();
        } catch (err) {
            alert("Error saving report: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const downloadFormat = async (format) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:5000/api/reports/${eventId}/${format}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Event_Report_${eventId}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert(`Error downloading ${format.toUpperCase()}`);
        }
    };

    if (loading) return <div>Loading Report Data...</div>;

    return (
        <div className="report-form-container" style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>Event Report Management</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => downloadFormat('pdf')} className="btn-secondary" style={{ background: '#e74c3c' }}>Download PDF</button>
                    <button onClick={() => downloadFormat('docx')} className="btn-secondary" style={{ background: '#3498db' }}>Download Word</button>
                    <button onClick={onClose} className="btn-close">✕</button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="professional-form">
                <div className="form-group">
                    <label>Brief Description of Event Conductance</label>
                    <textarea 
                        name="description" 
                        value={reportData.description} 
                        onChange={handleInputChange}
                        rows="5"
                        placeholder="Detail how the event was conducted, learning outcomes, etc."
                        required
                    />
                </div>

                <div className="section">
                    <h3>Event Rounds / Activities</h3>
                    {reportData.rounds.map((round, index) => (
                        <div key={index} className="item-row" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <input 
                                placeholder="Round Name" 
                                value={round.roundName} 
                                onChange={(e) => handleArrayChange(index, 'roundName', e.target.value, 'rounds')}
                                style={{ flex: 1 }}
                            />
                            <input 
                                placeholder="Description" 
                                value={round.roundDescription} 
                                onChange={(e) => handleArrayChange(index, 'roundDescription', e.target.value, 'rounds')}
                                style={{ flex: 2 }}
                            />
                            <button type="button" onClick={() => removeArrayItem(index, 'rounds')} className="btn-icon">🗑️</button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addArrayItem('rounds')} className="btn-add">+ Add Round</button>
                </div>

                <div className="section" style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Winners List</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666' }}>🏆 Certificates are sent automatically to these emails upon saving.</p>
                    </div>
                    {reportData.winners.map((winner, index) => (
                        <div key={index} className="item-row" style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1.5fr 1.5fr 2fr 1fr 1fr 1.5fr auto', 
                            gap: '10px', 
                            marginBottom: '15px', 
                            padding: '10px', 
                            background: '#f9f9f9', 
                            borderRadius: '8px' 
                        }}>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Student Name</label>
                                <input 
                                    placeholder="Full Name" 
                                    value={winner.studentName} 
                                    onChange={(e) => handleArrayChange(index, 'studentName', e.target.value, 'winners')}
                                    required
                                />
                            </div>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Register No</label>
                                <input 
                                    placeholder="21BCS... / 21LCS..." 
                                    value={winner.registerNumber} 
                                    onChange={(e) => handleArrayChange(index, 'registerNumber', e.target.value, 'winners')}
                                    required
                                />
                            </div>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Email Address</label>
                                <input 
                                    type="email"
                                    placeholder="student@nec.edu.in" 
                                    value={winner.email} 
                                    onChange={(e) => handleArrayChange(index, 'email', e.target.value, 'winners')}
                                    required
                                />
                            </div>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Year</label>
                                <select 
                                    value={winner.year} 
                                    onChange={(e) => handleArrayChange(index, 'year', e.target.value, 'winners')}
                                    required
                                >
                                    <option value="">Year</option>
                                    <option value="1">I</option>
                                    <option value="2">II</option>
                                    <option value="3">III</option>
                                    <option value="4">IV</option>
                                </select>
                            </div>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Dept</label>
                                <input 
                                    placeholder="CSE" 
                                    value={winner.department} 
                                    onChange={(e) => handleArrayChange(index, 'department', e.target.value, 'winners')}
                                    required
                                />
                            </div>
                            <div className="inner-group">
                                <label style={{ fontSize: '0.7rem', color: '#888' }}>Rank</label>
                                <select 
                                    value={winner.ranking} 
                                    onChange={(e) => handleArrayChange(index, 'ranking', e.target.value, 'winners')}
                                    required
                                    style={{ fontWeight: 'bold', color: '#1a1a6e' }}
                                >
                                    <option value="">Select Rank</option>
                                    <option value="1st">🥇 1st Prize</option>
                                    <option value="2nd">🥈 2nd Prize</option>
                                    <option value="3rd">🥉 3rd Prize</option>
                                </select>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => removeArrayItem(index, 'winners')} 
                                className="btn-icon" 
                                style={{ alignSelf: 'center', marginTop: '15px' }}
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={() => addArrayItem('winners')} className="btn-add">+ Add Winner</button>
                </div>

                <div className="section" style={{ marginTop: '20px' }}>
                    <h3>Event Photos</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        {reportData.photos.map((photo, index) => (
                            <div key={index} style={{ position: 'relative', width: '100px', height: '100px' }}>
                                <img src={`http://localhost:5000${photo.url}`} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                                <button type="button" onClick={() => removeArrayItem(index, 'photos')} style={{ position: 'absolute', top: '-5px', right: '-5px', padding: '2px 5px', fontSize: '10px', background: 'red', color: 'white', border: 'none', borderRadius: '50%' }}>✕</button>
                            </div>
                        ))}
                        <label className="photo-upload-label" style={{ width: '100px', height: '100px', border: '2px dashed #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', borderRadius: '4px' }}>
                            <input type="file" onChange={handlePhotoUpload} style={{ display: 'none' }} accept="image/*" />
                            <span style={{ fontSize: '24px', color: '#888' }}>+</span>
                        </label>
                    </div>
                </div>

                <div className="section" style={{ marginTop: '20px' }}>
                    <h3>Official Signatures (Names)</h3>
                    <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Staff Coordinator</label>
                            <input name="staffCoordinator" value={reportData.staffCoordinator} onChange={handleInputChange} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>HOD</label>
                            <input name="hod" value={reportData.hod} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Dean (SA&IR)</label>
                            <input name="dean" value={reportData.dean} onChange={handleInputChange} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Principal</label>
                            <input name="principal" value={reportData.principal} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', textAlign: 'right' }}>
                    <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? "Saving Changes..." : "Save Report Data"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EventReportForm;
