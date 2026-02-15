import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-[#030304] flex items-center justify-center px-6 text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="text-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
                {/* 404 Number */}
                <div className="relative inline-block mb-8">
                    <h1 className="font-display text-[12rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-white/5 select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center animate-[spin_20s_linear_infinite]">
                            <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                        </div>
                    </div>
                </div>

                <h2 className="font-display text-2xl font-bold text-white mb-3">Page Not Found</h2>
                <p className="text-zinc-400 max-w-md mx-auto mb-10 text-sm leading-relaxed">
                    The page you're looking for doesn't exist or has been moved.
                    Let's get you back on track.
                </p>

                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="btn-secondary gap-2"
                    >
                        <ArrowLeft size={16} /> Go Back
                    </button>
                    <Link to="/" className="btn-primary gap-2 shadow-lg shadow-indigo-500/20">
                        <Home size={16} /> Return Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
