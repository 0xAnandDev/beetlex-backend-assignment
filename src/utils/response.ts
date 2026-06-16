export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    message,
    data: data === null ? undefined : data,
  };
}

export function errorResponse(message: string, code: string = "INTERNAL_SERVER_ERROR", details?: any): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
