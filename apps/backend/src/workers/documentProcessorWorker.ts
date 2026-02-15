import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../queue/redis.js';
import { DOCUMENT_PROCESSING_QUEUE_NAME, type DocumentProcessingJob } from '../queue/documentProcessingQueue.js';
import { processStoredDocument } from '../services/processStoredDocument.js';
import { updateDocumentProcessing, updateDocumentProcessingByTenant } from '../db/pgvector.js';

async function startWorker() {
  const worker = new Worker<DocumentProcessingJob>(
    DOCUMENT_PROCESSING_QUEUE_NAME,
    async (job) => {
      const { documentId, userId, tenantId } = job.data;
      try {
        await processStoredDocument({ tenantId, documentId, actorUserId: userId });
      } catch (e) {
        try {
          await updateDocumentProcessingByTenant({
            documentId,
            tenantId,
            status: 'FAILED',
            progress: 100,
            error: e instanceof Error ? e.message : 'Unknown error',
          });
        } catch {
          await updateDocumentProcessing({
            documentId,
            userId,
            status: 'FAILED',
            progress: 100,
            error: e instanceof Error ? e.message : 'Unknown error',
          });
        }
        throw e;
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job completed: ${job.id} doc=${job.data.documentId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job failed: ${job?.id} doc=${job?.data.documentId}`, err);
  });

  console.log('🚀 Document processing worker started');
}

startWorker().catch((e) => {
  console.error('Failed to start worker:', e);
  process.exit(1);
});
