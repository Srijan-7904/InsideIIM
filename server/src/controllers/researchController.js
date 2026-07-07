import { createResearchReport } from '../services/researchService.js';
import {
  completeResearchJob,
  createResearchJob,
  failResearchJob,
  getResearchJob,
  updateResearchJob,
} from '../services/researchJobs.js';

export async function createReport(request, response, next) {
  try {
    const { companyName } = request.body ?? {};

    if (!companyName || typeof companyName !== 'string') {
      return response.status(400).json({
        message: 'companyName is required',
      });
    }

    const report = await createResearchReport(companyName);
    return response.json(report);
  } catch (error) {
    return next(error);
  }
}

export function startResearch(request, response) {
  const { companyName } = request.body ?? {};

  if (!companyName || typeof companyName !== 'string') {
    return response.status(400).json({
      message: 'companyName is required',
    });
  }

  const job = createResearchJob(companyName);
  updateResearchJob(job.jobId, {
    status: 'running',
    stage: 'Searching company...',
    progress: 8,
    message: 'Starting research',
  });

  Promise.resolve()
    .then(async () => {
      const report = await createResearchReport(companyName, {
        onStage: (stage, progress) => {
          updateResearchJob(job.jobId, {
            status: 'running',
            stage,
            progress,
            message: stage,
          });
        },
      });

      completeResearchJob(job.jobId, report);
    })
    .catch((error) => {
      failResearchJob(job.jobId, error);
    });

  return response.status(202).json({
    jobId: job.jobId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
  });
}

export function getResearchStatus(request, response) {
  const { jobId } = request.params;
  const job = getResearchJob(jobId);

  if (!job) {
    return response.status(404).json({
      message: 'Research job not found',
    });
  }

  return response.json(job);
}
