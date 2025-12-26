// src/workers/externalDbWorkerPool.js
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

const EXTERNAL_DB_WORKER_PATH = path.resolve(__dirname, 'externalDbWorker.js');

class ExternalDbWorkerPool {
    constructor(numThreads = os.cpus().length) {
        this.numThreads = numThreads;
        this.workers = [];
        this.queue = []; // Fila para tarefas pendentes
        this.tasks = new Map(); // Mapa para tarefas em andamento
        this.taskIdCounter = 0;

        this.logger = console; // Logger padrão, pode ser sobrescrito

        this._initializeWorkers();
    }

    setLogger(logger) {
        this.logger = logger;
    }

    _initializeWorkers() {
        for (let i = 0; i < this.numThreads; i++) {
            const worker = new Worker(EXTERNAL_DB_WORKER_PATH);
            worker.id = i;
            worker.on('message', (message) => this._handleWorkerMessage(message, worker));
            worker.on('error', (error) => this._handleWorkerError(error, worker));
            worker.on('exit', (code) => this._handleWorkerExit(code, worker));
            this.workers.push(worker);
            this.logger.info(`Worker ${i} for external DBs initialized.`);
        }
    }

    _handleWorkerMessage(message, worker) {
        const { id, error, result } = message;
        const task = this.tasks.get(id);

        if (task) {
            if (error) {
                // Transforma o erro serializado de volta em um objeto Error
                const workerError = new Error(error.message || 'Worker error');
                workerError.name = error.name;
                workerError.code = error.code;
                workerError.stack = error.stack;
                task.reject(workerError);
            } else {
                task.resolve(result);
            }
            this.tasks.delete(id);
        }

        this._processQueue();
    }

    _handleWorkerError(error, worker) {
        this.logger.error(`Worker ${worker.id} error:`, error);
    
        // Encontra tarefas que estavam sendo executadas por este worker e as rejeita
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.workerId === worker.id) {
                task.reject(new Error(`Worker ${worker.id} crashed or encountered an error.`));
                this.tasks.delete(taskId);
            }
        }
    
        this._replaceWorker(worker);
    }
    
    _handleWorkerExit(code, worker) {
        if (code !== 0) {
            this.logger.error(`Worker ${worker.id} exited with code ${code}`);
            
            // Rejeita tarefas associadas ao worker que falhou
            for (const [taskId, task] of this.tasks.entries()) {
                if (task.workerId === worker.id) {
                    task.reject(new Error(`Worker ${worker.id} exited unexpectedly.`));
                    this.tasks.delete(taskId);
                }
            }
            
            this._replaceWorker(worker);
        } else {
            this.logger.info(`Worker ${worker.id} exited cleanly.`);
        }
    }

    _replaceWorker(oldWorker) {
        const index = this.workers.findIndex(w => w.id === oldWorker.id);
        if (index > -1) {
            this.workers.splice(index, 1);
            
            const newWorker = new Worker(EXTERNAL_DB_WORKER_PATH);
            newWorker.id = oldWorker.id; // Mantém o ID
            newWorker.on('message', (message) => this._handleWorkerMessage(message, newWorker));
            newWorker.on('error', (error) => this._handleWorkerError(error, newWorker));
            newWorker.on('exit', (code) => this._handleWorkerExit(code, newWorker));
            
            this.workers.push(newWorker);
            this.logger.warn(`Worker ${oldWorker.id} replaced by new worker.`);
            
            this._processQueue(); // Tenta processar a fila com o novo worker
        }
    }

    _processQueue() {
        if (this.queue.length === 0) return;
    
        const availableWorker = this.workers.find(worker => {
            // Verifica se algum worker está "livre" (não associado a uma tarefa em andamento)
            const isBusy = [...this.tasks.values()].some(task => task.workerId === worker.id);
            return !isBusy;
        });
    
        if (availableWorker) {
            const taskData = this.queue.shift();
            
            // Associa o workerId à tarefa em andamento
            const taskPromise = this.tasks.get(taskData.id);
            if (taskPromise) {
                taskPromise.workerId = availableWorker.id;
            }
            
            availableWorker.postMessage(taskData);
        }
    }

    runTask(dbFileName, sql, params, method, ftsTableName) {
        return new Promise((resolve, reject) => {
            const taskId = this.taskIdCounter++;
            
            const taskData = { id: taskId, dbFileName, sql, params, method, ftsTableName };
            
            // Armazena a Promise e o workerId associado
            this.tasks.set(taskId, { resolve, reject, workerId: null });
            
            this.queue.push(taskData);
            this._processQueue();
        });
    }

    async terminate() {
        // Rejeita todas as tarefas pendentes
        for (const task of this.tasks.values()) {
            task.reject(new Error('Worker pool is terminating.'));
        }
        this.tasks.clear();
        
        // Para todos os workers
        await Promise.all(this.workers.map(worker => worker.terminate()));
        this.logger.info('External DB Worker Pool terminated.');
    }
}

module.exports = ExternalDbWorkerPool;