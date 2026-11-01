import http from 'node:http';

export interface SentEmail {
  to: string[];
  subject: string;
  html: string;
}

// Stands in for the Resend API (the API is pointed at it with RESEND_BASE_URL).
//   POST /emails      records an email, like Resend's send endpoint
//   GET  /emails?to=  lists what was recorded, so tests (separate processes) can read it
export function startMailServer(port: number) {
  const sent: SentEmail[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && url.pathname === '/emails') {
      const to = url.searchParams.get('to');
      res.end(JSON.stringify(to ? sent.filter((email) => email.to.includes(to)) : sent));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/emails') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const { to, subject, html } = JSON.parse(body);
        sent.push({ to: [to].flat(), subject, html });
        res.end(JSON.stringify({ id: `email-${sent.length}` }));
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'not found' }));
  });

  return new Promise<() => Promise<void>>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve(() => new Promise((done) => server.close(() => done())));
    });
  });
}
