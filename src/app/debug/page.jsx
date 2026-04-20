export const runtime = 'edge';

export default function DebugPage() {
  const envVars = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing',
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Found' : '❌ Missing',
    nodeVersion: process.version,
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', color: 'white', background: '#111', minHeight: '100vh' }}>
      <h1>🛠 Deployment Debug</h1>
      <hr />
      <h3>Environment Variables:</h3>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: {envVars.url}</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: {envVars.key}</li>
      </ul>
      <h3>System Info:</h3>
      <ul>
        <li>Node Version: {envVars.nodeVersion}</li>
        <li>Runtime: Edge</li>
      </ul>
      <hr />
      <p>If variables are missing, ensure you have re-deployed AFTER adding them to the dashboard.</p>
    </div>
  );
}
