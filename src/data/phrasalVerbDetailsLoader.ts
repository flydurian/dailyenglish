import type { PhrasalVerbDetail } from './phrasalVerbDetails';

let cachedDetails: Record<string, PhrasalVerbDetail> | null = null;
let inFlightPromise: Promise<Record<string, PhrasalVerbDetail>> | null = null;

export const getLoadedPhrasalVerbDetails = (): Record<string, PhrasalVerbDetail> | null => {
  return cachedDetails;
};

export const loadPhrasalVerbDetails = async (): Promise<Record<string, PhrasalVerbDetail>> => {
  if (cachedDetails) return cachedDetails;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = import('./phrasalVerbDetails')
    .then((mod) => {
      cachedDetails = mod.phrasalVerbDetails;
      return cachedDetails;
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
};
