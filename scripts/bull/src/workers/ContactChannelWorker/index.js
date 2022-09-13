const ContactChannelQueue = require("../../queues/ContactChannelQueue")
const { SendFormJob } = require('./jobs/SendFormJob')
const queue = ContactChannelQueue.queue;
const queueName = ContactChannelQueue.queueName;

const nProcess = process.env.BULL_QUEUE_CONCURRENCY || 1;

queue.process(queueName, nProcess, SendFormJob);

queue.on("completed", (job, result) => {
  console.log(`[Bull] Job completed: ${job.id}`);
  console.log("[Bull] Job result:", result);
});

queue.on("failed", (job, err) => {
  console.log(err);
  console.log(`[Bull] Job failed: ${job.id} ${JSON.stringify(err)}`);
});

console.log(`[Bull] Worker: Start ${queueName} Worker`);
