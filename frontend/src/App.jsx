import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState([]);

  const onDrop = useCallback((acceptedFiles) => {
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
    maxFiles: 2
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
        throw new Error('Network response was not ok');
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
              : "Drag & drop PDFs here, or click to select (max 2)"}
          </p>
        </div>

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
                <div key={index} className="block text-center rounded-xl bg-red-600 px-4 py-3 font-semibold">
                  Failed: {result.filename}
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
