import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";
import AuthContext from "../context/AuthContext";
import { FileText, Download, Save, Trash2, Plus, Image as ImageIcon, Users, Award, Info } from "lucide-react";

const EventReport = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState({
    description: "",
    rounds: [],
    winners: [],
    photos: [],
    staffCoordinator: "",
    hod: "",
    dean: "",
    principal: ""
  });
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [photoUrlInput, setPhotoUrlInput] = useState("");


  const isCoordinator = user && event && (
      String(event.createdBy?._id || event.createdBy) === String(user._id) || 
      user.clubName === (event.clubId?.clubName || event.clubName) ||
      (user.organizations && user.organizations.some(org => org.name === (event.clubId?.clubName || event.clubName)))
  );

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch event details
      const eventRes = await API.get(`/events/${eventId}`);
      setEvent(eventRes.data);

      // Fetch report details
      try {
        const reportRes = await API.get(`/reports/${eventId}`);
        if (reportRes.data._id) {
          setReport(reportRes.data);
          setIsEditing(false);
        } else {
          // No report yet, pre-fill with event data
          setReport({
            ...report,
            description: eventRes.data.description,
            staffCoordinator: eventRes.data.staffCoordinator1 || "",
          });
          setIsEditing(true);
        }
      } catch (err) {
        setIsEditing(true);
      }

      // Fetch participants (feedback responses)
      const feedRes = await API.get(`/feedback/event/${eventId}`);
      setParticipants(feedRes.data);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReport({ ...report, [name]: value });
  };

  const addRound = () => {
    setReport({
      ...report,
      rounds: [...report.rounds, { roundName: "", roundDescription: "" }]
    });
  };

  const updateRound = (index, field, value) => {
    const newRounds = [...report.rounds];
    newRounds[index][field] = value;
    setReport({ ...report, rounds: newRounds });
  };

  const removeRound = (index) => {
    setReport({
      ...report,
      rounds: report.rounds.filter((_, i) => i !== index)
    });
  };

  const addWinner = () => {
    setReport({
      ...report,
      winners: [...report.winners, { studentName: "", email: "", registerNumber: "", year: "", department: "", ranking: "" }]
    });
  };

  const updateWinner = (index, field, value) => {
    const newWinners = [...report.winners];
    newWinners[index][field] = value;
    setReport({ ...report, winners: newWinners });
  };

  const removeWinner = (index) => {
    setReport({
      ...report,
      winners: report.winners.filter((_, i) => i !== index)
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    try {
      setMessage({ type: "info", text: "Uploading photo..." });
      const res = await API.post("/reports/upload-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setReport({
        ...report,
        photos: [...report.photos, res.data.imageUrl]
      });
      setMessage({ type: "success", text: "Photo uploaded successfully!" });
    } catch (error) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: "Failed to upload photo" });
    }
  };

  const handleAddPhotoByUrl = () => {
    if (!photoUrlInput.trim()) return;
    setReport({
      ...report,
      photos: [...report.photos, photoUrlInput.trim()]
    });
    setPhotoUrlInput("");
  };



  const handleSave = async () => {
    try {
      // Data Integrity Cleanup: Filter out empty rounds or winners that would cause validation errors
      const cleanedReport = {
        ...report,
        rounds: report.rounds.filter(r => r.roundName && r.roundName.trim() !== ""),
        winners: report.winners.filter(w => w.studentName && w.studentName.trim() !== "")
      };

      if (!cleanedReport.description || cleanedReport.description.trim() === "") {
        setMessage({ type: "error", text: "Event description is required." });
        return;
      }

      setMessage({ type: "info", text: "Saving report..." });
      await API.post("/reports", { ...cleanedReport, eventId });
      setMessage({ type: "success", text: "Report saved successfully!" });
      setIsEditing(false);
      fetchData();
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Failed to save report" });
    }
  };

  const downloadFile = async (type) => {
    try {
      setMessage({ type: "info", text: `Generating ${type.toUpperCase()}... Please wait.` });
      const res = await API.get(`/reports/${eventId}/${type}`, {
        responseType: "blob"
      });
      
      const blob = res.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Report_${eventId}.${type === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      setMessage({ type: "success", text: `${type.toUpperCase()} downloaded successfully!` });
    } catch (error) {
      console.error("Download Error", error);
      setMessage({ type: "error", text: "Failed to generate file. Make sure the report is saved." });
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-indigo-600" /> Event Report
          </h1>
          <p className="text-slate-500 mt-1">{event?.title} • {new Date(event?.date).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          {isCoordinator && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
            >
              Edit Report
            </button>
          )}
          <button 
            onClick={() => downloadFile("pdf")}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 transition-colors shadow-sm"
          >
            <Download size={18} /> PDF
          </button>
          <button 
            onClick={() => downloadFile("docx")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download size={18} /> DOCX
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : 
          message.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          <Info size={20} /> {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description Section */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Info className="text-indigo-500" size={20} /> Event Description
            </h3>
            {isEditing ? (
              <textarea 
                name="description"
                value={report.description}
                onChange={handleInputChange}
                className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
                placeholder="Describe how the event was conducted..."
              />
            ) : (
              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{report.description || "No description provided."}</p>
            )}
          </section>

          {/* Rounds Section */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-500" size={20} /> Event Rounds
              </h3>
              {isEditing && (
                <button onClick={addRound} className="p-1 px-2 text-sm bg-indigo-600 text-white rounded flex items-center gap-1 hover:bg-indigo-700">
                  <Plus size={14} /> Add Round
                </button>
              )}
            </div>
            <div className="space-y-4">
              {report.rounds.map((round, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative group">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input 
                        type="text"
                        placeholder="Round Title (e.g., Knowledge Sprint)"
                        value={round.roundName}
                        onChange={(e) => updateRound(idx, "roundName", e.target.value)}
                        className="w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                      <textarea 
                         placeholder="Round Description..."
                         value={round.roundDescription}
                         onChange={(e) => updateRound(idx, "roundDescription", e.target.value)}
                         className="w-full p-2 border rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                         rows="2"
                      />
                      <div className="flex justify-end">
                        <button onClick={() => removeRound(idx)} className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1">
                          <Trash2 size={12} /> Remove Round
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-bold text-slate-800">{round.roundName}</h4>
                      <p className="text-slate-600 text-sm mt-1">{round.roundDescription}</p>
                    </>
                  )}
                </div>
              ))}
              {report.rounds.length === 0 && !isEditing && <p className="text-slate-400 italic text-center py-4">No rounds specified.</p>}
            </div>
          </section>

          {/* Photos Section */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex flex-col space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="text-indigo-500" size={20} /> Event Photos
                </h3>
                {isEditing && (
                  <div>
                    <input 
                      type="file" 
                      id="report-photo-upload" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handlePhotoUpload} 
                    />
                    <label 
                      htmlFor="report-photo-upload"
                      className="p-1 px-3 text-sm bg-indigo-600 text-white rounded cursor-pointer flex items-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Plus size={14} /> Upload Photo
                    </label>
                  </div>
                )}
              </div>
              
              {isEditing && (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Paste Image URL (http://...)" 
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    className="flex-1 p-2 border rounded text-sm focus:ring-1 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleAddPhotoByUrl}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded text-sm font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Add URL
                  </button>
                </div>
              )}
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.photos.map((photo, idx) => {
                const photoStr = typeof photo === 'string' ? photo : (photo?.url || "");
                const isLocal = typeof photoStr === 'string' && photoStr.startsWith("/uploads");
                const fullUrl = isLocal ? `http://localhost:5000${photoStr}` : photoStr;
                
                return (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                    <div className="aspect-video bg-slate-100">
                      <img src={fullUrl} alt={`Event ${idx}`} className="w-full h-full object-cover" onError={(e) => e.target.src = 'https://via.placeholder.com/400x225?text=Invalid+Image+URL'} />
                    </div>
                    {isEditing && (
                      <button 
                        onClick={() => {
                          setReport({...report, photos: report.photos.filter((_, i) => i !== idx)});
                        }} 
                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-rose-500 rounded-full shadow-md hover:bg-rose-50 transition-colors"
                        title="Remove Photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {!isLocal && (
                      <div className="absolute bottom-0 left-0 right-0 bg-slate-900/50 text-[10px] text-white p-1 text-center truncate">
                        {photo}
                      </div>
                    )}
                  </div>
                );
              })}


              {report.photos.length === 0 && !isEditing && <p className="text-slate-400 italic text-center py-4 col-span-2">No photos added.</p>}
            </div>
          </section>

          {/* Winners Section */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Award className="text-indigo-500" size={20} /> Winners List
              </h3>
              {isEditing && (
                <button onClick={addWinner} className="p-1 px-2 text-sm bg-indigo-600 text-white rounded flex items-center gap-1 hover:bg-indigo-700">
                  <Plus size={14} /> Add Winner
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase">
                   <tr className="text-left">
                    <th className="p-3 font-semibold">Student Details</th>
                    <th className="p-3 font-semibold">Academic</th>
                    <th className="p-3 font-semibold">Rank</th>
                    {isEditing && <th className="p-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.winners.map((winner, idx) => (
                    <tr key={idx}>
                      <td className="p-3">
                        {isEditing ? (
                          <input value={winner.studentName} onChange={(e) => updateWinner(idx, "studentName", e.target.value)} placeholder="Full Name" className="w-full p-1 border rounded text-sm" />
                        ) : (
                          <p className="font-semibold text-slate-800">{winner.studentName}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {isEditing ? (
                            <>
                              <input value={winner.registerNumber} onChange={(e) => updateWinner(idx, "registerNumber", e.target.value)} placeholder="Reg No" className="w-full p-1 border rounded text-xs" />
                              <div className="flex gap-1">
                                <select value={winner.year} onChange={(e) => updateWinner(idx, "year", e.target.value)} className="p-1 border rounded text-xs flex-1">
                                  <option value="">Yr</option>
                                  <option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option>
                                </select>
                                <input value={winner.department} onChange={(e) => updateWinner(idx, "department", e.target.value)} placeholder="Dept" className="p-1 border rounded text-xs flex-1" />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-slate-600">{winner.registerNumber} • {winner.year}nd Year {winner.department}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <select 
                            value={winner.ranking} 
                            onChange={(e) => updateWinner(idx, "ranking", e.target.value)} 
                            className="w-full p-1 border rounded font-semibold text-indigo-700 text-sm"
                          >
                            <option value="">Select Rank</option>
                            <option value="1st">🥇 1st Place</option>
                            <option value="2nd">🥈 2nd Place</option>
                            <option value="3rd">🥉 3rd Place</option>
                          </select>
                        ) : (
                          <span className="font-bold text-indigo-600 text-sm">{winner.ranking || "Winner"}</span>
                        )}
                      </td>
                      {isEditing && (
                        <td className="p-3">
                          <button onClick={() => removeWinner(idx)} className="text-rose-500 hover:text-rose-700"><Trash2 size={16} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.winners.length === 0 && <p className="text-slate-400 italic text-center py-8">No winners listed.</p>}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Event Metadata (Summary) */}
          <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg">
            <h3 className="font-bold text-lg mb-4 opacity-90 border-b border-indigo-800 pb-2">Event Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-indigo-300 text-xs uppercase font-bold tracking-wider">Attendance</p>
                <p className="text-2xl font-bold">{participants.length} Participants</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-indigo-300 text-xs uppercase font-bold tracking-wider">Venue</p>
                  <p className="font-medium">{event?.venue}</p>
                </div>
                <div>
                  <p className="text-indigo-300 text-xs uppercase font-bold tracking-wider">Time</p>
                  <p className="font-medium">{event?.time || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Participants List (Small Preview) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              Participants List
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{participants.length}</span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-3 group">
                   <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                     {i + 1}
                   </div>
                   <div>
                     <p className="text-sm font-semibold text-slate-700">{p.studentName}</p>
                     <p className="text-[10px] text-slate-400 uppercase tracking-tight">{p.registerNumber} • {p.department}</p>
                   </div>
                </div>
              ))}
              {participants.length === 0 && <p className="text-slate-400 italic text-sm text-center">No participants found.</p>}
            </div>
          </div>

          {/* Coordinator Controls */}
          {isCoordinator && isEditing && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
              <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2"><Save size={18} /> Coordinator Tools</h4>
              <p className="text-sm text-amber-700 mb-4">You are editing this report. Make sure to save your changes before leaving.</p>
              <div className="space-y-3">
                <button 
                  onClick={handleSave}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-[0.98]"
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full py-2 bg-white text-slate-600 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventReport;
