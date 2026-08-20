import { CrisisResource } from './types.js';
import { Result, ok, err } from '../core/result.js';
import { SafetyError } from '../core/errors.js';

export interface EmergencyResourceResolver {
  resolveResources(countryCode: string, _region?: string): Promise<Result<CrisisResource[], SafetyError>>;
}

export class DefaultResourceResolver implements EmergencyResourceResolver {
  resolveResources(countryCode: string, _region?: string): Promise<Result<CrisisResource[], SafetyError>> {
    const now = new Date();
    
    // Explicit provenance metadata
    const mockDB: Record<string, CrisisResource[]> = {
      'US': [{
        country: 'US',
        resourceType: 'SUICIDE_LIFELINE',
        displayName: '988 Suicide & Crisis Lifeline',
        contactMethod: 'Call or Text 988',
        verificationStatus: 'VERIFIED',
        lastVerifiedAt: new Date(now.getTime() - 100000),
        source: 'SAMHSA',
        sourceUrl: 'https://988lifeline.org',
        verificationOwner: 'Internal_Safety_Team',
        nextReviewAt: new Date(now.getTime() + 86400000), // Future
        availability: '24/7'
      }],
      'EG': [{
        country: 'EG',
        resourceType: 'MENTAL_HEALTH_HOTLINE',
        displayName: 'General Secretariat of Mental Health',
        contactMethod: '08008880700',
        verificationStatus: 'UNVERIFIED', // Changed to unverified to demonstrate strictness
        lastVerifiedAt: new Date(now.getTime() - 100000),
        source: 'GSMHAT',
        availability: '24/7'
      }],
      'UK': [{
        country: 'UK',
        resourceType: 'NHS_111',
        displayName: 'NHS 111',
        contactMethod: '111',
        verificationStatus: 'EXPIRED',
        lastVerifiedAt: new Date('2020-01-01'), // Very old
        source: 'NHS',
        sourceUrl: 'https://111.nhs.uk',
        verificationOwner: 'Internal_Safety_Team',
        nextReviewAt: new Date('2021-01-01'), // Past
        availability: '24/7'
      }]
    };

    const resources = mockDB[countryCode.toUpperCase()];
    if (!resources || resources.length === 0) {
       return Promise.resolve(err(new SafetyError(`No verified resources found for region: ${countryCode}`)));
    }
    
    // Dynamic enforcement: if past nextReviewAt, mark EXPIRED
    const processedResources = resources.map(res => {
      if (res.verificationStatus === 'VERIFIED' && res.nextReviewAt && res.nextReviewAt < now) {
        return { ...res, verificationStatus: 'EXPIRED' as const };
      }
      return res;
    });

    return Promise.resolve(ok(processedResources));
  }
}
