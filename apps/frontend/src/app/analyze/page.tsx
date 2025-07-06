"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { analyzeWebsite } from '../../../api-lists';

interface AnalysisResult {
  // Define a proper type based on your API response structure
  // This is a placeholder, update according to your actual response
  id?: string;
  url: string;
  timestamp?: string;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

export default function AnalyzePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (!url) {
      router.push('/');
      return;
    }

    async function performAnalysis() {
      try {
        // Make sure url is not null before proceeding
        if (url) {
          const response = await analyzeWebsite({ url });
          
          if (response.status !== 200) {
            setError("Failed to analyze website");
            toast.error("Failed to analyze website");
            return;
          }
          
          setAnalysisResult(response.data);
          toast.success("Analysis completed successfully");
        }
      } catch (err) {
        console.error("Error analyzing website:", err);
        setError("An unexpected error occurred. Please try again.");
        toast.error("An unexpected error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    performAnalysis();
  }, [url, router]);

  if (!url) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6 text-center mt-32">Website Analysis</h1>
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-t-[#3A2106] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium">Analyzing {url}...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && analysisResult && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Analysis Results</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
