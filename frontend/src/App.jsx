import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB in bytes

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setUploadError(null);
    
    if (rejectedFiles && rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setUploadError(`File too large. Maximum size is 4MB due to serverless platform limits.`);
      } else {
        setUploadError(rejection.errors[0]?.message || 'File rejected');
      }
      return;
    }
    
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    
    setFiles(acceptedFiles.slice(0, 2));
    setResults([]);
    setProgress({});
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 2,
    maxSize: MAX_FILE_SIZE
  });

  async function optimizeFile(file, index) {
    const formData = new FormData();
    formData.append('file', file);

    // Mock progress simulation
    const progressInterval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        [index]: Math.min((prev[index] || 0) + 10, 90)
      }));
    }, 200);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/optimize`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      clearInterval(progressInterval);
      setProgress(prev => ({ ...prev, [index]: 100 }));
      
      return { success: true, url, filename: file.name };
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(prev => ({ ...prev, [index]: 0 }));
      console.error('Error optimizing PDF:', error);
      return { success: false, error: error.message, filename: file.name };
    }
  }

  async function handleOptimize() {
    if (files.length === 0) return;
    setLoading(true); 
    setResults([]);
    setProgress({});
    setUploadError(null);

    const optimizedResults = [];
    for (let i = 0; i < files.length; i++) {
      const result = await optimizeFile(files[i], i);
      optimizedResults.push(result);
    }

    setResults(optimizedResults);
    setLoading(false);
  }

 return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 p-6 shadow-lg">
        <h1 className="text-2xl font-bold">PDF Optimizer</h1>
        <p className="text-slate-300 mt-1 text-sm">
          Upload up to 2 PDFs and get smaller optimized versions.
        </p>

        <div
          {...getRootProps()}
          className={`mt-6 border-2 border-dashed rounded-xl p-8 cursor-pointer transition
            ${
              isDragActive
                ? "border-blue-400 bg-slate-800"
                : "border-slate-700 bg-slate-950"
            }`}
        >
          <input {...getInputProps()} />
          <p className="text-center text-slate-300">
            {files.length > 0
              ? `Selected ${files.length} file(s): ${files.map(f => f.name).join(', ')}`
              : "Drag & drop PDFs here, or click to select (max 2, 4MB each)"}
          </p>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 bg-red-600 rounded-lg text-sm text-center">
            {uploadError}
          </div>
        )}

        {files.length > 0 && loading && (
          <div className="mt-4 space-y-3">
            {files.map((file, index) => (
              <div key={index} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-300 truncate">{file.name}</span>
                  <span className="text-slate-400">{progress[index] || 0}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress[index] || 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleOptimize}
          disabled={files.length === 0 || loading}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Optimizing..." : `Optimize ${files.length} PDF${files.length > 1 ? 's' : ''}`}
        </button>

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((result, index) => (
              result.success ? (
                <a
                  key={index}
                  href={result.url}
                  download={`optimized-${result.filename}`}
                  className="block text-center rounded-xl bg-green-600 px-4 py-3 font-semibold hover:bg-green-700"
                >
                  Download {result.filename}
                </a>
              ) : (
                <div key={index} className="rounded-xl bg-red-600 px-4 py-3">
                  <div className="font-semibold text-center">Failed: {result.filename}</div>
                  {result.error && (
                    <div className="text-sm text-red-100 mt-1 text-center">{result.error}</div>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App
