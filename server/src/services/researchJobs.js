import { randomUUID } from 'node:crypto';

const jobs = new Map();

export function createResearchJob(companyName) {
  const jobId = randomUUID();
  const job = {
    jobId,
    companyName,
    status: 'queued',
    stage: 'Queued',
    progress: 0,
    message: 'Waiting to start research',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    report: null,
    error: null,
  };

  jobs.set(jobId, job);
  return job;
}

export function updateResearchJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return null;

  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  jobs.set(jobId, job);
  return job;
}

export function getResearchJob(jobId) {
  return jobs.get(jobId) || null;
}

export function completeResearchJob(jobId, report) {
  return updateResearchJob(jobId, {
    status: 'completed',
    stage: 'Complete',
    progress: 100,
    message: 'Report generated',
    report,
    error: null,
  });
}

export function failResearchJob(jobId, error) {
  return updateResearchJob(jobId, {
    status: 'failed',
    stage: 'Failed',
    progress: 100,
    message: error?.message || 'Research failed',
    error: error?.message || 'Research failed',
  });
}
