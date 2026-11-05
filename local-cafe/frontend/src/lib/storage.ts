import { useState, useCallback } from "react";
import { uploadImage } from "./api";

export interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

export interface UploadResponse {
  uploadURL?: string;
  objectPath: string;
  metadata?: UploadMetadata;
}

export interface UseUploadOptions {
  basePath?: string;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(10);

      try {
        setProgress(50);
        const result = await uploadImage(file);
        setProgress(100);

        const response: UploadResponse = {
          objectPath: result.url,
          metadata: {
            name: result.filename,
            size: file.size,
            contentType: file.type,
          },
        };

        options.onSuccess?.(response);
        return response;
      } catch (err) {
        const errObj = err instanceof Error ? err : new Error("Upload failed");
        setError(errObj);
        options.onError?.(errObj);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}

