"use client";

import { urlSchema } from '@/utils/validators';
import Image, { StaticImageData } from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { analyzeWebsite } from '../../../api-lists';
import DesktopDummy from "../analyze/_dummy/desktop-dummy.png";
import MobileDummy from "../analyze/_dummy/mobile-dummy.png";


interface AnalysisResult {
  url: string;
  timestamp?: string;
  performanceScore?: number | null;
  loadTime?: number | null;
  issues?: string[];
  screenshots: {
    desktop: string | StaticImageData;
    mobile: string | StaticImageData;
  };
  rawOutput?: string;
  [key: string]: unknown;
}

export default function AnalyzePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const resetURL = useCallback(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("url");
    window.history.replaceState(null, "", newUrl.toString());
  }, []);

  useEffect(() => {
    if (!url) {
      router.push('/');
      return;
    }

    const isValid = urlSchema.safeParse({ url });

    async function performAnalysis() {
      try {
        // Special case for example.com - use dummy data
        if (url === 'example.com' || url === 'https://example.com') {
          // Create dummy data with the specified screenshot paths
          setAnalysisResult({
            url: 'https://example.com',
            timestamp: new Date().toISOString(),
            performanceScore: 95,
            loadTime: 1.2,
            issues: [
              "Button contrast ratio is too low",
              "Missing alt text on some images",
              "Mobile navigation could be improved"
            ],
            screenshots: {
              desktop: DesktopDummy,
              mobile: MobileDummy
            },
            rawOutput: "Dummy analysis output for example.com"
          });
          setIsLoading(false);
          toast.success("Analysis completed successfully");
          return;
        }
        
        // For all other URLs, make the actual API call
        if (url) {
          const response = await analyzeWebsite({ url });
          
          if (response.status !== 200) {
            setError("Failed to analyze website");
            toast.error("Failed to analyze website");
            return;
          }
          
          setAnalysisResult(response.data.data); // Access the data property from the response
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

    if (isValid.success) {
      performAnalysis();
    } else {
      resetURL();
      router.push('/');
    }
  }, [url, router, resetURL]);

  if (!url) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto px-4 py-12 z-[]">
      <h1 className="text-3xl font-bold mb-6 text-center mt-32 text-input">Website Analysis</h1>
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 border-4 border-t-input border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xl font-medium text-input">Analyzing {url}...</p>
          <p className="text-sm text-input mt-2">This may take a few moments</p>
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
          <h2 className="text-2xl font-semibold mb-4">Analysis Results for {analysisResult.url}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Performance Metrics */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Performance Metrics</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Load Time:</span> {analysisResult.loadTime ? `${analysisResult.loadTime}s` : 'N/A'}</p>
                <p><span className="font-medium">Performance Score:</span> {analysisResult.performanceScore ? `${analysisResult.performanceScore}/100` : 'N/A'}</p>
                <p><span className="font-medium">Analyzed:</span> {new Date(analysisResult.timestamp || '').toLocaleString()}</p>
              </div>
            </div>
            
            {/* Issues Found */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Issues Found</h3>
              {analysisResult.issues && analysisResult.issues.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {analysisResult.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p>No issues found!</p>
              )}
            </div>
          </div>
          
          {/* Screenshots */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Screenshots</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Desktop Screenshot */}
              <div className="border border-gray-200 rounded-lg p-4 col-span-2">
                <h4 className="text-lg font-medium mb-3">Desktop View</h4> 
                {analysisResult.screenshots?.desktop ? (
                  <div className="relative overflow-hidden rounded-xl border border-gray-300 max-h-[50vh] overflow-y-auto">
                    <Image
                      src={analysisResult.screenshots.desktop}
                      alt="Desktop view of website"
                      width={1200}
                      height={800}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-xl flex items-center justify-center h-64">
                    <p className="text-gray-500">No desktop screenshot available</p>
                  </div>
                )}
              </div>
              
              {/* Mobile Screenshot */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-medium mb-3">Mobile View</h4>
                {analysisResult.screenshots?.mobile ? (
                  <div className="relative overflow-hidden rounded-xl border border-gray-300 max-h-[60vh] overflow-y-auto">
                    <Image
                      src={analysisResult.screenshots.mobile}
                      alt="Mobile view of website"
                      width={600}
                      height={1200}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-xl flex items-center justify-center h-64">
                    <p className="text-gray-500">No mobile screenshot available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Raw JSON (Expandable) */}
          <div className="mt-8">
            <details>
              <summary className="cursor-pointer text-lg font-semibold mb-2">Raw Analysis Data</summary>
              <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
