import { EmergencyResourceResolver } from '../safety/resource-resolver.js';

export class CrisisResponseBuilder {
  constructor(private resolver: EmergencyResourceResolver) {}

  public async buildCrisisResponse(countryCode: string): Promise<string> {
    const resources = await this.resolver.resolveResources(countryCode);
    let contactMethod = "911 or your local emergency services";
    
    if (resources.ok && resources.value.length > 0) {
      const verified = resources.value.find(r => r.verificationStatus === 'VERIFIED');
      if (verified) contactMethod = verified.contactMethod;
    }
    
    return `أنا قلق جداً على سلامتك ومقدرش أكمل المحادثة العادية دلوقتي. أرجوك تواصل فوراً مع خدمات الطوارئ أو خط الدعم النفسي: ${contactMethod}.`;
  }
}
