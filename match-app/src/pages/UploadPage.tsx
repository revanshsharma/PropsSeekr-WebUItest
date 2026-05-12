import React, { useState, useRef } from 'react';
import { FileUp, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { matchService } from '../services/api';
import { pageUi } from '../lib/pageUi';

const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.txt')) {
        setFile(selectedFile);
        setStatus('idle');
        setMessage('');
      } else {
        setStatus('error');
        setMessage('Only .txt files are allowed');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('loading');
    try {
      const response = await matchService.uploadFile(file);
      setStatus('success');
      const bucket = response?.data?.bucket ? `Bucket: ${response.data.bucket}` : '';
      const key = response?.data?.key ? `Key: ${response.data.key}` : '';
      const details = [bucket, key].filter(Boolean).join(' • ');
      setMessage(`Successfully uploaded ${file.name}${details ? ` (${details})` : ''}`);
      setFile(null);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Failed to upload file. Please try again.');
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className={pageUi.panel}>
        <div className={`${pageUi.panelHeader} ${pageUi.panelHeaderMuted}`}>
          <div className={pageUi.panelHeaderIconWrap}>
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className={pageUi.title}>Upload Data</h1>
            <p className={pageUi.subtitle}>Select a .txt file containing match records to process.</p>
          </div>
        </div>

        <div className={pageUi.panelBodyLg}>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`${pageUi.dropzone} ${file ? pageUi.dropzoneActive : pageUi.dropzoneIdle}`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" />

            <div
              className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${
                file ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <FileUp className="w-8 h-8" />
            </div>

            <p className="text-lg font-bold text-slate-900">{file ? file.name : 'Click to select or drag and drop'}</p>
            <p className="text-sm text-slate-500 mt-1 font-medium">Support only .txt files</p>

            {file && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className={`mt-4 ${pageUi.btnIconGhost}`}
                aria-label="Remove file"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="mt-8 flex items-center justify-end">
            <button
              type="button"
              disabled={!file || status === 'loading'}
              onClick={handleUpload}
              className={pageUi.btnPrimary}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  Upload File
                </>
              )}
            </button>
          </div>

          {status === 'success' && (
            <div className={`mt-6 ${pageUi.alertSuccess} flex items-start gap-3`}>
              <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" />
              <span className="font-medium">{message}</span>
            </div>
          )}

          {status === 'error' && (
            <div className={`mt-6 ${pageUi.alertError} flex items-start gap-3`}>
              <AlertCircle className="w-5 h-5 mt-0.5 text-rose-600 shrink-0" />
              <span className="font-medium">{message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
