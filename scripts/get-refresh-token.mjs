// Run: node scripts/get-refresh-token.mjs
// Then follow the instructions printed to the terminal

import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import { URL } from 'url';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Missing credentials. Run like this:\n');
  console.error('GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node scripts/get-refresh-token.mjs\n');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:4321/callback';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly';

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n✅ Opening Google login in your browser...');
console.log('\nIf it does not open, manually visit:\n');
console.log(authUrl);
console.log('\n');

// Try to open browser
exec(`open "${authUrl}"`);

// Start local server to catch the redirect
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4321');
  const code = url.searchParams.get('code');
  if (!code) {
    res.end('No code found');
    return;
  }

  res.end('<h2>✅ Got the code! Check your terminal for the refresh token.</h2><p>You can close this tab.</p>');
  server.close();

  // Exchange code for tokens
  const postData = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length,
    },
    rejectUnauthorized: false,
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', chunk => data += chunk);
    tokenRes.on('end', () => {
      const json = JSON.parse(data);
      if (json.refresh_token) {
        console.log('\n✅ SUCCESS! Add these to Vercel environment variables:\n');
        console.log(`GOOGLE_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${json.refresh_token}`);
        console.log('\n');
      } else {
        console.error('\n❌ Failed to get refresh token:', JSON.stringify(json, null, 2));
      }
    });
  });

  tokenReq.on('error', e => console.error('Request error:', e));
  tokenReq.write(postData);
  tokenReq.end();
});

server.listen(4321, () => {
  console.log('Waiting for Google to redirect back...');
});
