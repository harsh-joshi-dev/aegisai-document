export default function TermsPage() {
    return (
        <div className="min-h-screen pt-24 pb-12 px-6">
            <div className="max-w-4xl mx-auto glass-panel p-8 md:p-12">
                <h1 className="text-3xl font-bold mb-8 text-gradient">Terms of Service</h1>

                <div className="prose prose-invert prose-blue max-w-none space-y-6 text-muted">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h3 className="text-xl font-semibold text-main mt-8">1. Acceptance of Terms</h3>
                    <p>
                        By accessing or using Aegis AI, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">2. Description of Service</h3>
                    <p>
                        Aegis AI provides AI-powered document analysis tools. You understand that the analysis provided is for informational purposes only and does not constitute legal advice.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">3. User Responsibilities</h3>
                    <p>
                        You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">4. Intellectual Property</h3>
                    <p>
                        The service and its original content, features, and functionality are owned by Aegis AI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">5. Termination</h3>
                    <p>
                        We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                    </p>
                </div>
            </div>
        </div>
    );
}
