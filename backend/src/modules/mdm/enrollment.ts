import plist from 'plist';

interface EnrollmentConfig {
  serverUrl: string;
  topic: string;
  identityName: string;
}

export class EnrollmentService {
  constructor(private config: EnrollmentConfig) {}

  generateProfile(): string {
    const profile = {
      PayloadContent: [
        {
          PayloadType: 'com.apple.mdm',
          PayloadVersion: 1,
          PayloadIdentifier: 'com.mydevices.mdm',
          PayloadUUID: crypto.randomUUID(),
          PayloadDisplayName: 'MDM Profile',
          PayloadDescription: 'Allows this device to be managed',
          IdentityName: this.config.identityName,
          Topic: this.config.topic,
          ServerURL: `${this.config.serverUrl}/mdm/connect`,
          CheckInURL: `${this.config.serverUrl}/mdm/checkin`,
          ServerCapabilities: ['com.apple.mdm.per-user-connections'],
          AccessRights: 8191,
        },
      ],
      PayloadDisplayName: 'myDevices MDM',
      PayloadDescription: 'Install this profile to enroll your device in myDevices MDM',
      PayloadIdentifier: 'com.mydevices.enrollment',
      PayloadOrganization: 'myDevices',
      PayloadType: 'Configuration',
      PayloadUUID: crypto.randomUUID(),
      PayloadVersion: 1,
      PayloadRemovalDisallowed: false,
    };

    return plist.build(profile);
  }
}
