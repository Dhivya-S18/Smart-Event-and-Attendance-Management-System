import { useState, useEffect, useContext } from "react";
import API from "../api/api";
import AuthContext from "../context/AuthContext";
import { Link } from "react-router-dom";
import { 
    Calendar, 
    MapPin, 
    Users, 
    FileText, 
    Award, 
    CheckCircle2, 
    ArrowRight,
    Trophy,
    ExternalLink
} from "lucide-react";
import "./Students.css"; 

const CompletedEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        fetchCompletedEvents();
    }, []);

    const fetchCompletedEvents = async () => {
        try {
            setLoading(true);
            const { data } = await API.get("/events/status?status=completed");
            setEvents(data);
        } catch (error) {
            console.error("Error fetching completed events", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container max-w-7xl mx-auto px-4 py-8">
            <header className="dashboard-header mb-12 text-center animate-in fade-in slide-in-from-top duration-700">
                <div className="inline-flex items-center justify-center p-3 bg-green-500/10 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Event History & Reports</h1>
                <p className="text-gray-400 text-lg">Celebrate our successes and access detailed event documentation.</p>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                    <Calendar className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-300">No completed events found</h3>
                    <p className="text-gray-500 mt-2">When club events finish, they will appear here for reporting.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {events.map((event, index) => (
                        <div 
                            key={event._id} 
                            className="group relative bg-[#1a1c23] rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-all duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom duration-500"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Card Content */}
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full uppercase tracking-wider">
                                        Completed
                                    </span>
                                    <Trophy className="w-5 h-5 text-yellow-500/50 group-hover:text-yellow-500 transition-colors" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
                                    {event.title}
                                </h3>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center text-gray-400 text-sm">
                                        <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                                        {new Date(event.date).toLocaleDateString("en-IN", {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </div>
                                    <div className="flex items-center text-gray-400 text-sm">
                                        <MapPin className="w-4 h-4 mr-2 text-red-500" />
                                        {event.venue}
                                    </div>
                                    <div className="flex items-center text-gray-400 text-sm">
                                        <Users className="w-4 h-4 mr-2 text-purple-500" />
                                        {event.registrationCount || 0} Participants
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-800 flex flex-col gap-3">
                                    <Link 
                                        to={`/event/report/${event._id}`}
                                        className="flex items-center justify-center w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/20"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        {(user?.role === 'admin' || user?.role === 'staff' || user?._id === event.createdBy || (user?.clubId && event.clubId && (user.clubId === event.clubId._id || user.clubId === event.clubId))) ? 'Manage Report' : 'View Report'}
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                    
                                    <div className="flex gap-2">
                                        {event.circularPdf && (
                                            <a 
                                                href={`https://smart-event-and-attendance-management.onrender.com${event.circularPdf}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="flex-1 flex items-center justify-center py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                                            >
                                                Circular <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        )}
                                        {event.posterImage && (
                                            <a 
                                                href={`https://smart-event-and-attendance-management.onrender.com${event.posterImage}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="flex-1 flex items-center justify-center py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                                            >
                                                Poster <ExternalLink className="w-3 h-3 ml-1" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Hover Decorative Element */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[80px] group-hover:bg-blue-500/10 transition-all rounded-full pointer-events-none"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CompletedEvents;
