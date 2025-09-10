// src/lib/agents/datasetCheckAgent.ts
import db from '@/lib/db';
import { chats, type DatasetFile, type AttachmentFile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function checkUploadedDatasets(chatId: string) {
  const record = await db.query.chats.findFirst({ where: eq(chats.id, chatId) });
  const datasets: DatasetFile[] = (record?.datasets ?? []) as DatasetFile[];
  const attachments: AttachmentFile[] = (record?.attachments ?? []) as AttachmentFile[];

  if (datasets.length === 0 && attachments.length === 0) {
    return { agent_dataset_status: { found: false, message: 'No data files available in this chat.' } };
  }

  const names = [
    ...datasets.map(f => f.name),
    ...attachments.map(f => f.name + ' (attachment)'),
  ];

  return {
    agent_dataset_status: {
      found: true,
      files: names,
      summary: `Found ${names.length} file(s): ${names.join(', ')}`,
    }
  };
}
