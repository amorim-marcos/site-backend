const OuvidoriaQueue = require("../../queues/OuvidoriaQueue");
const { OuvidoriaSendJob } = require("./jobs/OuvidoriaSendJob");
const { sweepTempDir } = require("../../../../../utils/ouvidoria/tempDir");
const { getConfig } = require("../../../../../utils/ouvidoria/config");

const queue = OuvidoriaQueue.queue;
const queueName = OuvidoriaQueue.queueName;

const config = getConfig();

queue.process(queueName, config.job.concurrency, OuvidoriaSendJob);

queue.on("completed", (job, result) => {
  console.log(`[OUVIDORIA] Job completed: ${job.id}`, result);
});

queue.on("failed", (job, err) => {
  if (!job) return;
  const final = job.attemptsMade >= (job.opts.attempts || 1);
  if (final) {
    // Falha definitiva: o job fica retido na fila para recuperação manual.
    console.error(`[OUVIDORIA][FAILED] job ${job.id} esgotou as tentativas: ${err.message}`);
  } else {
    console.warn(`[OUVIDORIA] job ${job.id} falhou (tentativa ${job.attemptsMade}), será repetido: ${err.message}`);
  }
});

queue.on("stalled", (job) => {
  console.warn(`[OUVIDORIA] job ${job.id} marcado como parado, será reprocessado`);
});

// Rede de segurança do diretório temporário: o handler apaga o arquivo ao fim da
// request, mas um processo morto no meio (reinício, falta de memória) deixa sobras.
// O worker roda no mesmo processo que grava os uploads (hook do Strapi).
const runSweep = () => {
  const { temp } = getConfig();
  sweepTempDir({ dir: temp.dir, maxAgeMs: temp.maxAgeMs }).catch((error) =>
    console.error("[OUVIDORIA] erro na limpeza do temporário:", error.message)
  );
};
runSweep();
setInterval(runSweep, config.temp.sweepIntervalMs).unref();

console.log(`[Bull] Worker: Start ${queueName} Worker`);
