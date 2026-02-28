import http2 from 'node:http2';

interface APNsConfig {
  keyId: string;
  teamId: string;
  keyPath: string;
  production: boolean;
}

export class APNsService {
  private config: APNsConfig;
  private host: string;

  constructor(config: APNsConfig) {
    this.config = config;
    this.host = config.production
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
  }

  async sendPush(pushToken: string, pushMagic: string): Promise<boolean> {
    const payload = JSON.stringify({ mdm: pushMagic });

    return new Promise((resolve, reject) => {
      const client = http2.connect(this.host);
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        'apns-topic': pushMagic,
        'apns-push-type': 'mdm',
        'apns-priority': '10',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload).toString(),
      });

      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk; });
      req.on('end', () => {
        client.close();
        resolve(true);
      });
      req.on('error', (err: Error) => {
        client.close();
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }
}
