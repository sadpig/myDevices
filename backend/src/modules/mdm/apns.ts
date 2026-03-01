import http2 from 'node:http2';
import crypto from 'node:crypto';
import fs from 'node:fs';

interface APNsConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
  topic: string;
  production: boolean;
}

export class APNsService {
  private config: APNsConfig;
  private host: string;
  private client: http2.ClientHttp2Session | null = null;
  private jwtToken: string | null = null;
  private jwtExpiry = 0;

  constructor(config: APNsConfig) {
    this.config = config;
    this.host = config.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
  }

  private getSigningKey(): string | null {
    if (!this.config.keyPath) return null;
    try {
      return fs.readFileSync(this.config.keyPath, 'utf8');
    } catch {
      return null;
    }
  }

  private getJwtToken(): string | null {
    const now = Math.floor(Date.now() / 1000);
    if (this.jwtToken && now < this.jwtExpiry - 60) return this.jwtToken;

    const key = this.getSigningKey();
    if (!key || !this.config.keyId || !this.config.teamId) return null;

    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: this.config.keyId })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ iss: this.config.teamId, iat: now })).toString('base64url');
    const signer = crypto.createSign('SHA256');
    signer.update(`${header}.${claims}`);
    const signature = signer.sign({ key, dsaEncoding: 'ieee-p1363' }, 'base64url');

    this.jwtToken = `${header}.${claims}.${signature}`;
    this.jwtExpiry = now + 3600;
    return this.jwtToken;
  }

  private getClient(): http2.ClientHttp2Session {
    if (this.client && !this.client.closed && !this.client.destroyed) {
      return this.client;
    }
    this.client = http2.connect(this.host);
    this.client.on('error', () => { this.client = null; });
    this.client.on('close', () => { this.client = null; });
    return this.client;
  }

  isConfigured(): boolean {
    return !!(this.config.keyId && this.config.teamId && this.config.keyPath && this.config.topic);
  }

  async sendPush(pushToken: string, pushMagic: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('APNs not configured, skipping push');
      return false;
    }

    const token = this.getJwtToken();
    if (!token) {
      console.error('Failed to generate APNs JWT token');
      return false;
    }

    const payload = JSON.stringify({ mdm: pushMagic });

    return new Promise((resolve, reject) => {
      const client = this.getClient();
      const headers: http2.OutgoingHttpHeaders = {
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        'authorization': `bearer ${token}`,
        'apns-topic': this.config.topic,
        'apns-push-type': 'mdm',
        'apns-priority': '10',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload).toString(),
      };

      const req = client.request(headers);
      let status = 0;

      req.on('response', (headers) => {
        status = headers[':status'] as number;
      });

      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk; });
      req.on('end', () => {
        if (status === 200) {
          resolve(true);
        } else {
          console.error(`APNs push failed with status ${status}: ${data}`);
          resolve(false);
        }
      });
      req.on('error', (err: Error) => {
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  async close() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}
