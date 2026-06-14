import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://73t761f5q5.execute-api.ap-south-1.amazonaws.com/default/propseekr-file-processor';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type UploadInitResponse = {
  uploadUrl: string;
  bucket: string;
  key: string;
};

export type DashboardResponse = {
  source: string;
  message: string;
  dateTime: string;
  matches?: unknown[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalMatches: number;
  };
};

export const matchService = {
  uploadFile: async (file: File) => {
    // Step 1: request a presigned upload URL from backend
    const init = await api.post<UploadInitResponse>('/upload', {
      fileName: file.name,
    });

    const { uploadUrl, bucket, key } = init.data;
    if (!uploadUrl || !bucket || !key) {
      throw new Error('Upload initialization failed (missing uploadUrl/bucket/key).');
    }

    // Step 2: upload file directly to S3
    await axios.put(uploadUrl, file, {
      headers: {
        // Backend example suggests text/plain; use file.type if provided.
        'Content-Type': file.type || 'text/plain',
      },
      // Avoid axios trying to JSON-serialize the File.
      transformRequest: [(data) => data],
    });

    // Keep return shape compatible with UploadPage (it reads response.data.bucket/key)
    return { data: { bucket, key } };
  },

  searchMatches: async (_filters: any, page = 1, pageSize = 20) => {
    // Note: If the api later supports filters, we can pass them as query params. 
    // Currently relying on just pagination support on the generic endpoint.
    return api.get<DashboardResponse>(`/matches?page=${page}&size=${pageSize}`);
  },

  /** POST manual listing from Add Property form */
  submitListing: async (body: Record<string, unknown>) => {
    return api.post('/listing', body);
  },
};

export default api;
