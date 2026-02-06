export default function PrivacyPage() {
    return (
        <div className="min-h-screen pt-24 pb-12 px-6">
            <div className="max-w-4xl mx-auto glass-panel p-8 md:p-12">
                <h1 className="text-3xl font-bold mb-8 text-gradient">Privacy Policy</h1>

                <div className="prose prose-invert prose-blue max-w-none space-y-6 text-muted">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <p>
                        At Aegis AI, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our document analysis services.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">1. Information We Collect</h3>
                    <p>
                        We collect information that you provide directly to us when you register for an account, upload documents, or communicate with us. This includes:
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>Personal identifiers (name, email address)</li>
                            <li>Document content uploaded for analysis</li>
                            <li>Usage data and interaction logs</li>
                        </ul>
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">2. How We Use Your Information</h3>
                    <p>
                        We use the information we collect to:
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>Provide, maintain, and improve our services</li>
                            <li>Process and analyze your documents using our AI agents</li>
                            <li>Send you technical notices and support messages</li>
                            <li>Monitor and analyze trends and usage</li>
                        </ul>
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">3. Data Security</h3>
                    <p>
                        We implement appropriate technical and organizational measures to protect your personal data against unauthorized alteration, disclosure, or destruction. Your documents are encrypted at rest and in transit.
                    </p>

                    <h3 className="text-xl font-semibold text-main mt-8">4. Contact Us</h3>
                    <p>
                        If you have questions about this Privacy Policy, please contact us at support@aegisai.com.
                    </p>
                </div>
            </div>
        </div>
    );
}
