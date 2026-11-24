import type { DiffOptions } from './json-diff.models';
import type { Difference } from './json-diff.types';

export interface JsonDiffWorkerRequest {
  leftText: string
  rightText: string
  options: DiffOptions
}

export type JsonDiffWorkerResponse =
  | {
    type: 'success'
    leftJson: unknown
    rightJson: unknown
    difference: Difference
  }
  | {
    type: 'error'
    message: string
  };
