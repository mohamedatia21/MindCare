import { UserInput, ClinicalMode } from '../core/types.js';
import { Result } from '../core/result.js';
import { InternalError } from '../core/errors.js';

export interface ClinicalResponse {
  content: string;
  suggestedTools: string[];
}

export interface ClinicalCore {
  process(input: UserInput, mode: ClinicalMode): Promise<Result<ClinicalResponse, InternalError>>;
}
