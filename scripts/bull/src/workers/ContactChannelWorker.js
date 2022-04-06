const ContactChannelQueue = require("../queues/ContactChannelQueue").queue;

function wait(ms) {
  const start = Date.now();
  let now = start;

  while (now - start < ms) {
    now = Date.now();
  }
}

ContactChannelQueue.process(function (job, done) {
  // job.data contains the custom data passed when the job was created
  // job.id contains id of this job.

  wait(500);

  // call done when finished
  done();

  // or give a error if error
  // done(new Error("error transcoding"));

  // or pass it a result
  // done(null, { framerate: 29.5 /* etc... */ });
});
