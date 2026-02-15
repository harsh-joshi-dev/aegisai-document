import { Queue } from 'bullmq';
import { getRedisConnectionOptions } from './redis.js';

export const DOCUMENT_PROCESSING_QUEUE_NAME = 'document-processing';

export type DocumentProcessingJob = {
  documentId: string;
  userId: string;
  tenantId: string;
};

export function getDocumentProcessingQueue() {
  return new Queue<DocumentProcessingJob>(DOCUMENT_PROCESSING_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}
