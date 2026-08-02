import React from 'react';

export const Upload = ({ onGetPresign, onUploadComplete, onServerUpload }) => {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleUpload = async () => {
    const el = inputRef.current;
    if (!el || !el.files || el.files.length === 0) return alert('Choose a file');
    const f = el.files[0];
    setUploading(true);
    setProgress(0);
    try {
      const presign = onGetPresign ? await onGetPresign(f) : null;
      // If presign url present, try direct PUT with progress via XHR
      if (presign && presign.url) {
        await new Promise((resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', presign.url);
            xhr.setRequestHeader('Content-Type', f.type || 'application/octet-stream');
            xhr.upload.onprogress = (ev) => {
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
            reject(e);
          }
        }).catch(async (err) => {
          console.warn('Direct PUT failed, falling back to server upload', err);
          if (onServerUpload) {
            // allow caller to perform server-side upload (proxy)
            await onServerUpload(f, presign && presign.key ? presign.key : undefined, (p) =>
              setProgress(p)
            );
          } else {
            throw err;
          }
        });
        onUploadComplete && onUploadComplete({ key: presign?.key || f.name });
      } else {
        // No presign URL -> try server upload if provided
        if (onServerUpload) {
          await onServerUpload(f, presign && presign.key ? presign.key : undefined, (p) =>
            setProgress(p)
          );
          onUploadComplete && onUploadComplete({ key: presign?.key || f.name });
        } else {
          throw new Error('No presign URL and no server upload handler provided');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err && err.message ? err.message : err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-panel rounded-xl p-4">
      <div className="flex items-center gap-3">
        <input ref={inputRef} type="file" className="" aria-label="Choose file to upload" />
        <button
          className="px-3 py-1 rounded-md bg-brand text-[var(--primary-contrast)] font-semibold"
          disabled={uploading}
          onClick={handleUpload}
        >
          {uploading ? `Uploading ${progress}%` : 'Upload'}
        </button>
      </div>
      {uploading && (
        <div className="mt-3 h-2 bg-panel2 rounded overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

export default Upload;
