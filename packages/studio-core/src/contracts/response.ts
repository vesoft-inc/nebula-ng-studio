export interface ServerResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  msg?: string;
  model?: T;
  ip?: string;
  details?: string;
}

export interface HttpResponse<T> {
  code: number;
  message: string;
  details?: string;
  data: T;
}
