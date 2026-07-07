import { useMutation } from '@tanstack/react-query';
import { searchCompany } from '../services/api.js';

export function useResearch() {
  return useMutation({
    mutationFn: searchCompany,
  });
}
