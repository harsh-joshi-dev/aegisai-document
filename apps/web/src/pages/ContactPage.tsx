import { useState } from 'react';

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-6">
            <div className="max-w-2xl mx-auto glass-panel p-8 md:p-12">
                <h1 className="text-3xl font-bold mb-6 text-center">Contact Support</h1>
                <p className="text-muted text-center mb-10">
                    Have questions or need help? Fill out the form below and we'll get back to you shortly.
                </p>

                {submitted ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center animate-enter">
                        <h3 className="text-xl font-semibold text-green-400 mb-2">Message Sent!</h3>
                        <p className="text-muted">Thank you for contacting us. We will respond within 24 hours.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-dim mb-2">Name</label>
                            <input
                                type="text"
                                id="name"
                                required
                                className="w-full bg-main/50 border border-border-light rounded-md px-4 py-3 text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                placeholder="Your Name"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-dim mb-2">Email</label>
                            <input
                                type="email"
                                id="email"
                                required
                                className="w-full bg-main/50 border border-border-light rounded-md px-4 py-3 text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-dim mb-2">Message</label>
                            <textarea
                                id="message"
                                required
                                rows={5}
                                className="w-full bg-main/50 border border-border-light rounded-md px-4 py-3 text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
                                placeholder="How can we help you?"
                            />
                        </div>

                        <button type="submit" className="w-full btn btn-primary py-3">
                            Send Message
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
