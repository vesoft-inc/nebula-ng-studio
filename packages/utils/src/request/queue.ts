import PQueue from 'p-queue';

export type RequestTask<T> = (signal: AbortSignal) => Promise<T>;

interface RequestQueueOptions {
  concurrency?: number;
}

export interface RequestHandle<T> {
  id: string;
  controller: AbortController;
  promise: Promise<T | void>;
}

/**
 * RequestQueue manages async tasks with concurrency control and cancellation.
 * Each task can be tracked and aborted using the returned handle.
 */
export class RequestQueue {
  private queue: PQueue;
  private controllers: Map<string, AbortController>;
  private idCounter = 0;

  constructor(options: RequestQueueOptions = {}) {
    this.queue = new PQueue({ concurrency: options.concurrency ?? 1 });
    this.controllers = new Map();
  }

  /**
   * Add a request task to the queue.
   * @param id Optional unique identifier for the request. If not provided, a unique id is generated.
   * @param task Function that receives an AbortSignal and returns a Promise
   * @returns RequestHandle containing id, controller, and the promise
   */
  add<T>(task: RequestTask<T>): RequestHandle<T>;
  add<T>(id: string, task: RequestTask<T>): RequestHandle<T>;
  add<T>(idOrTask: string | RequestTask<T>, maybeTask?: RequestTask<T>): RequestHandle<T> {
    let id: string | undefined;
    let task: RequestTask<T>;
    if (typeof idOrTask === 'string') {
      id = idOrTask;
      task = maybeTask!;
    } else {
      id = undefined;
      task = idOrTask;
    }
    const taskId = id ?? `_rq_${++this.idCounter}`;
    const controller = new AbortController();
    this.controllers.set(taskId, controller);

    const wrappedTask = async () => {
      try {
        return await task(controller.signal);
      } finally {
        this.controllers.delete(taskId);
      }
    };

    const promise = this.queue.add(wrappedTask, { id: taskId, signal: controller.signal });
    return { id: taskId, controller, promise };
  }

  /**
   * Abort a specific request by ID.
   * @param id Unique identifier for the request
   */
  abort(id: string, reason?: string) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort(reason);
      this.controllers.delete(id);
    }
  }

  /**
   * Abort all pending/running requests.
   */
  abortAll(reason?: string) {
    for (const [id, controller] of this.controllers) {
      controller.abort(reason);
      this.controllers.delete(id);
    }
  }

  pause() {
    this.queue.pause();
  }

  start() {
    this.queue.start();
  }

  clear() {
    this.queue.clear();
  }

  get size() {
    return this.queue.size + this.queue.pending;
  }
}
