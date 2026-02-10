import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <div className="text-center">
                <h1 className="text-6xl font-bold gradient-text-primary mb-4">404</h1>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-main)' }}>Page Not Found</h2>
                <p className="max-w-md mx-auto mb-8" style={{ color: 'var(--text-muted)' }}>
                    The page you are looking for doesn't exist or has been moved.
                    Let's get you back on track.
                </p>
                <Link to="/" className="btn btn-primary">
                    Return to Home
                </Link>
            </div>
        </div>
    );
}
