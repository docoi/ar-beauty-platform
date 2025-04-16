import React from "react";

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        At <strong>vTryit</strong>, accessible from <a href="https://vtryit.com" className="text-blue-600 underline">https://vtryit.com</a>, your privacy is one of our top priorities. This Privacy Policy outlines what information we collect, how we use it, and your rights related to that data.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
      <p className="mb-4">We collect personal information when you interact with our site, such as when you log in or register using email or Google. This may include:</p>
      <ul className="list-disc list-inside mb-4">
        <li>Email address</li>
        <li>Name (if provided by a third-party provider like Google)</li>
        <li>Browser and device information</li>
        <li>IP address</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
      <p className="mb-4">We use the information we collect to:</p>
      <ul className="list-disc list-inside mb-4">
        <li>Authenticate and authorise users</li>
        <li>Provide access to features of our platform</li>
        <li>Improve website functionality and security</li>
        <li>Respond to support requests or inquiries</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">3. Cookies and Tracking</h2>
      <p className="mb-4">We may use cookies or similar technologies for analytics and session management. You can disable cookies in your browser settings, but some features may not work properly.</p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">4. Data Storage and Security</h2>
      <p className="mb-4">All user data is stored securely using Supabase infrastructure. We implement reasonable security measures to protect your personal information, including encryption and secure authentication protocols.</p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">5. Sharing of Information</h2>
      <p className="mb-4">We do not share or sell your personal data to third parties. Your information may only be disclosed:</p>
      <ul className="list-disc list-inside mb-4">
        <li>If required by law</li>
        <li>To comply with a legal obligation</li>
        <li>To prevent fraud or abuse</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">6. Your Rights</h2>
      <p className="mb-4">You have the right to access, update, or delete your data. To make a request, please contact us at <a href="mailto:trackingdata2020@gmail.com" className="text-blue-600 underline">trackingdata2020@gmail.com</a>.</p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">7. Changes to This Policy</h2>
      <p className="mb-4">We may update this Privacy Policy at any time. Changes will be posted on this page, and your continued use of the service signifies your agreement to those changes.</p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">8. Contact</h2>
      <p className="mb-4">If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:trackingdata2020@gmail.com" className="text-blue-600 underline">trackingdata2020@gmail.com</a>.</p>
    </div>
  );
};

export default PrivacyPolicy;
