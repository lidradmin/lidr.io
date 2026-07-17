export function PrivacyPolicyContent() {
  return (
    <>
      <p><strong>Last updated:</strong> 24 June 2026</p>
      <p>This Lidr privacy policy explains how Lidr Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, stores, and protects your information when you use the Lidr mobile application and website. Above all, we commit to safeguarding your data and maintaining transparent practices.</p>

      <h3>Information We Collect Under This Lidr Privacy Policy</h3>

      <h4>Account Information</h4>
      <p>When you create an account, we collect your name, email address, and password. Similarly, if you sign in via Google, Apple, or Microsoft, we receive your name and email from the identity provider.</p>

      <h4>Photos, Videos, and Documents</h4>
      <p>When you use the app, you may upload photos, videos, and generate PDF reports. We store these files and any associated metadata (titles, descriptions, tags, markup annotations) on our servers.</p>

      <h4>Location Data</h4>
      <p>With your permission, we collect precise GPS coordinates when you capture photos or videos. Specifically, we embed this data in your uploads for geotagging purposes. In addition, we may extract location data from EXIF metadata when you import photos from your camera roll.</p>

      <h4>Device Information</h4>
      <p>We collect device identifiers to detect new device logins and send security alerts. Furthermore, we collect crash reports and diagnostic data to improve app stability.</p>

      <h4>Usage Data</h4>
      <p>We also collect information about how you interact with the app, such as features used, uploads created, and projects managed, to improve our services.</p>

      <h4>Subscription and Payment Data</h4>
      <p>If you subscribe to a paid plan, Apple (App Store) or Google (Google Play) processes your payment. As a result, we never collect or store your credit card or payment details. Instead, we receive only transaction identifiers and subscription status from these platforms.</p>

      <h3>How We Use Your Information</h3>
      <p>As outlined in this Lidr privacy policy, we use the information we collect to:</p>
      <ul>
        <li><p>Provide, maintain, and improve the app and its features.</p></li>
        <li><p>Authenticate your account and secure your data.</p></li>
        <li><p>Process and display your photos, videos, and documents.</p></li>
        <li><p>Geotag your captures with location data.</p></li>
        <li><p>Generate PDF reports with your uploaded content.</p></li>
        <li><p>Enable team collaboration and project sharing.</p></li>
        <li><p>Send transactional emails (account verification, password reset, support ticket confirmations).</p></li>
        <li><p>Detect new device logins and send security alerts.</p></li>
        <li><p>Monitor app performance and fix crashes.</p></li>
        <li><p>Manage your subscription status.</p></li>
        <li><p>Respond to support requests.</p></li>
      </ul>

      <h3>Data Sharing</h3>
      <p>We do not sell your personal information. However, we may share your data with the following trusted providers:</p>
      <ul>
        <li><p><strong>Cloud infrastructure providers</strong> (Amazon Web Services) for hosting and storage.</p></li>
        <li><p><strong>Email service providers</strong> (Resend) for transactional emails.</p></li>
        <li><p><strong>Crash reporting services</strong> (Sentry) for app stability monitoring.</p></li>
        <li><p><strong>Payment platforms</strong> (Apple App Store, Google Play) for subscription management.</p></li>
        <li><p><strong>Cloud storage integrations</strong> (Google Drive, OneDrive, Dropbox) only when you explicitly connect and export to these services.</p></li>
        <li><p><strong>Google Maps</strong> for satellite imagery in PDF reports, using your photo coordinates.</p></li>
      </ul>
      <p>In all cases, we share only the minimum data necessary for each service to function.</p>

      <h3>Data Storage and Security</h3>
      <p>We store your data on servers within the European Union (AWS eu-west-1). Additionally, we implement encryption in transit (TLS) and at rest. For example, we encrypt sensitive credentials such as OAuth tokens using AES-256-GCM before storing them.</p>
      <p>We keep photos and videos in Amazon S3 with private access controls. Moreover, we strip EXIF metadata from publicly accessible image URLs to protect your privacy.</p>

      <h3>Your Rights Under This Privacy Policy</h3>
      <p>Under GDPR and applicable data protection laws, you have the right to:</p>
      <ul>
        <li><p><strong>Access</strong> your personal data.</p></li>
        <li><p><strong>Correct</strong> inaccurate or incomplete data.</p></li>
        <li><p><strong>Delete</strong> your account and all associated data.</p></li>
        <li><p><strong>Export</strong> your data in a portable format.</p></li>
        <li><p><strong>Withdraw consent</strong> for location access at any time through your device settings.</p></li>
        <li><p><strong>Object</strong> to processing of your data.</p></li>
      </ul>
      <p>To exercise any of these rights, contact us at <a href="mailto:support@lidr.io">support@lidr.io</a> or use the account deletion feature within the app (Settings &gt; Security &amp; Privacy &gt; Delete Account).</p>

      <h3>Data Retention</h3>
      <p>We retain your data for as long as your account remains active. However, if you delete your account, we remove your personal data and uploaded content within 30 days, except where the law requires us to keep it.</p>

      <h3>Children&rsquo;s Privacy</h3>
      <p>We do not direct our app at children under 16. Accordingly, we do not knowingly collect personal information from children.</p>

      <h3>Cookies and Tracking</h3>
      <p>Our website may use cookies for basic functionality. However, the mobile app does not use cookies or advertising trackers. In particular, we do not track users across third-party apps or websites.</p>

      <h3>Changes to This Lidr Privacy Policy</h3>
      <p>We may update this Lidr privacy policy from time to time. When we do, we will post the changes on this page with an updated date. If you continue using the app after changes take effect, you accept the revised policy.</p>

      <h3>Contact Us</h3>
      <p>If you have questions about this privacy policy or your data, please contact us at:</p>
      <p><strong>Lidr Ltd</strong><br />
      Email: <a href="mailto:support@lidr.io">support@lidr.io</a><br />
      Website: <a href="/">https://lidr.io</a></p>
      <p>See also: <a href="/terms-of-service/">Terms of Service</a> | <a href="/">Home</a></p>
    </>
  );
}
