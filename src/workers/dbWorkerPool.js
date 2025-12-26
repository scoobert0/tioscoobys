const { Worker } = require('worker_threads');
const os = require('os');

const numThreads = os.cpus().length;

class WorkerPool {
  constructor(workerPath, numThreads) {
    this.workerPath = workerPath;
    this.numThreads = numThreads;
    this.workers = [];
    this.queue = []; // Fila para tarefas pendentes
    this.tasks = new Map(); // Mapa para tarefas em andamento, incluindo seus handlers de Promise
    this.taskIdCounter = 0;

    for (let i = 0; i < this.numThreads; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    const worker = new Worker(this.workerPath);
    worker.id = this.workers.length;
    this.workers.push(worker);

    worker.on('message', (message) => {
      const { taskId, result, error } = message;
      const task = this.tasks.get(taskId);

      if (task) {
        if (error) {
          task.reject(new Error(error));
        } else {
          task.resolve(result);
        }
        this.tasks.delete(taskId);
      }

      // Tenta processar o próximo item da fila, já que um worker ficou livre
      this.processQueue();
    });

    worker.on('error', (err) => {
      console.error(`Worker ${worker.id} experienced an error:`, err);
      // Rejeita tarefas que estavam com este worker
      for (const [taskId, task] of this.tasks.entries()) {
        if (task.workerId === worker.id) {
          task.reject(new Error(`Worker ${worker.id} failed: ${err.message}`));
          this.tasks.delete(taskId);
        }
      }
      // Remove o worker defeituoso e o substitui
      this.workers = this.workers.filter(w => w !== worker);
      this.addWorker();
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker ${worker.id} exited with code ${code}`);
        // Rejeita tarefas como no 'error'
        for (const [taskId, task] of this.tasks.entries()) {
          if (task.workerId === worker.id) {
            task.reject(new Error(`Worker ${worker.id} exited unexpectedly.`));
            this.tasks.delete(taskId);
          }
        }
        this.workers = this.workers.filter(w => w !== worker);
        this.addWorker();
      }
    });

    // Ao adicionar um novo worker, talvez ele possa pegar uma tarefa
    this.processQueue();
  }

  runTask(taskType, args) {
    return new Promise((resolve, reject) => {
      const taskId = this.taskIdCounter++;
      this.tasks.set(taskId, { resolve, reject, workerId: null });
      this.queue.push({ id: taskId, taskType, args });
      this.processQueue();
    });
  }

  processQueue() {
    if (this.queue.length === 0) {
      return;
    }

    const idleWorker = this.workers.find(w => 
      ![...this.tasks.values()].some(t => t.workerId === w.id)
    );

    if (idleWorker) {
      const taskData = this.queue.shift();
      if (!taskData) return; // Fila pode ter esvaziado

      const taskPromise = this.tasks.get(taskData.id);
      if (taskPromise) {
        taskPromise.workerId = idleWorker.id; // Associa o worker à tarefa
      }
      
      idleWorker.postMessage({
        taskId: taskData.id,
        taskType: taskData.taskType,
        args: taskData.args,
      });
    }
  }

  async terminate() {
    // Rejeita todas as tarefas em andamento e na fila
    for (const task of this.tasks.values()) {
      task.reject(new Error('Worker pool is terminating.'));
    }
    this.tasks.clear();
    this.queue = [];

    // Termina os workers
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }
}

module.exports = (workerScriptPath) => new WorkerPool(workerScriptPath, numThreads);
