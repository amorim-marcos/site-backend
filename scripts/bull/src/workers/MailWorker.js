const MailQueue = require("../queues/MailQueue");
const queue = MailQueue.queue;
const queueName = MailQueue.queueName;

function wait(ms) {
  const start = Date.now();
  let now = start;

  while (now - start < ms) {
    now = Date.now();
  }
}

function Job(job, done) {
  console.log("[Bull] Job: Start processing job");

  wait(2000);

  done(null, { message: "Hello World!" });
}

const nProcess = process.env.BULL_QUEUE_CONCURRENCY || 1;

queue.process(queueName, nProcess, Job);

queue.on("completed", (job, result) => {
  console.log(`[Bull] Job completed: ${job.id}`);
  console.log("[Bull] Job result:", result);
});

queue.on("failed", (job, err) => {
  console.log(err);
  console.log(`[Bull] Job failed: ${job.id} ${JSON.stringify(err)}`);
});

console.log(`[Bull] Worker: Start ${queueName} Worker`);
