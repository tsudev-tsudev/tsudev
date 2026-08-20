import React from 'react';

type PresignResult = { url?: string; key?: string } | null | undefined;

type UploadProps = {
  onGetPresign?: (file: File) => Promise<PresignResult> | PresignResult;
  onUploadComplete?: (result: { key: string }) => void;
  onServerUpload?: (
    file: File,
    key: string | undefined,
    onProgress: (percent: number) => void
  ) => Promise<void>;
};

export const Upload = ({ onGetPresign, onUploadComplete, onServerUpload }: UploadProps) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleUpload = async () => {
    const f = inputRef.current?.files?.[0];
    if (!f) {
      alert('Choose a file');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const presign = onGetPresign ? await onGetPresign(f) : null;
      // If presign url present, try direct PUT with progress via XHR
      if (presign && presign.url) {
        const url = presign.url;
        await new Promise<void>((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            xhr.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
            xhr.upload.onprogress = (ev: ProgressEvent) => {
              if (ev.lengthComputable) {
                setProgress(Math.round((ev.loaded / ev.total) * 100));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setProgress(100);
                resolve();
              } else {
                reject(new Error('Direct upload failed: ' + xhr.status));
              }
            };
            xhr.onerror = () => reject(new Error('Direct upload network error'));
            xhr.send(f);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }).catch(async (err: unknown) => {
          console.warn('Direct PUT failed, falling back to server upload', err);
          if (onServerUpload) {
            // allow caller to perform server-side upload (proxy)
            await onServerUpload(f, presign.key, (p) => setProgress(p));
          } else {
            throw err;
          }
        });
        onUploadComplete && onUploadComplete({ key: presign.key || f.name });
      } else {
        // No presign URL -> try server upload if provided
        if (onServerUpload) {
          await onServerUpload(f, presign?.key, (p) => setProgress(p));
          onUploadComplete && onUploadComplete({ key: presign?.key || f.name });
        } else {
          throw new Error('No presign URL and no server upload handler provided');
        }
      }
    } catch (err: unknown) {
      console.error(err);
      // `catch` cho ra `unknown`, không phải Error. Bản cũ đọc thẳng err.message
      // nên khi thứ bị ném ra là chuỗi (hoặc bất cứ gì khác) thì thông báo hiện
      // ra là "[object Object]" thay vì lý do thật.
      alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-surface rounded-md p-4">
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" className="" aria-label="Choose file to upload" />
        <button
          className="px-3 py-1 rounded-md bg-primary text-on-primary font-semibold"
          disabled={uploading}
          onClick={handleUpload}
        >
          {uploading ? `Uploading ${progress}%` : 'Upload'}
        </button>
      </div>
      {uploading && (
        <div className="mt-3 h-2 bg-subtle rounded overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

export default Upload;
