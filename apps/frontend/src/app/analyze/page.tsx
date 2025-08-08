"use client";

import { urlSchema } from '@/utils/validators';
import { useAuth } from '@clerk/nextjs';
import Image, { StaticImageData } from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
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
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const resetURL = useCallback(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("url");
    window.history.replaceState(null, "", newUrl.toString());
  }, []);

 
  useEffect(() => {
    const isValid = urlSchema.safeParse({ url });
    async function performAnalysis() {
      try {
        if (!isLoaded) return; // wait for auth to load
        if (!isSignedIn) {
          toast.error("Please sign in to analyze a website.");
          router.push('/');
          return;
        }
        // Determine normalized URL using zod (ensures protocol when missing)
        const normalizedUrl = urlSchema.parse({ url }).url;

        // Special case for example.com - use dummy data
        if (normalizedUrl === 'https://example.com') {
          // Create dummy data with the specified screenshot paths
          setAnalysisResult({
            url: normalizedUrl,
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
          const token = await getToken({ template: "default" }).catch(() => undefined);
          const response = await analyzeWebsite({ url: normalizedUrl }, token ? { token } : undefined);
          
          if (!response?.data?.success) {
            setError(response.data.error);
            return;
          }
          
          setAnalysisResult(response.data.data); // Access the data property from the response
          toast.success("Analysis completed successfully");
        }
      } catch (err) {
        console.error("Error analyzing website:", err);
        setError("An unexpected error occurred while analyzing the website");
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
  }, [url, router, resetURL, isLoaded, isSignedIn, getToken]);

  if (!url) {
    router.push('/');
    return null;
  }
  
  
  return (
  <div className="container mx-auto px-4 py-12">
      <h1 className="mt-32 mb-6 text-3xl font-bold text-center text-input">Website Analysis</h1>
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 mb-4 border-4 rounded-full border-t-input border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          <p className="text-xl font-medium text-input">Analyzing {url}...</p>
          <p className="mt-2 text-sm text-input">This may take a few moments</p>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded-md bg-red-50">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="px-4 py-2 mt-4 text-white transition-colors bg-red-600 rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {!isLoading && !error && analysisResult && (
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <h2 className="mb-4 text-2xl font-semibold">Analysis Results for {analysisResult.url}</h2>
          
          <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
            {/* Performance Metrics */}
            <div className="p-4 rounded-lg bg-gray-50">
              <h3 className="mb-3 text-xl font-semibold">Performance Metrics</h3>
              <div className="space-y-2">
                <p><span className="font-medium">Load Time:</span> {analysisResult.loadTime ? `${analysisResult.loadTime}s` : 'N/A'}</p>
                <p><span className="font-medium">Performance Score:</span> {analysisResult.performanceScore ? `${analysisResult.performanceScore}/100` : 'N/A'}</p>
                <p><span className="font-medium">Analyzed:</span> {new Date(analysisResult.timestamp || '').toLocaleString()}</p>
              </div>
            </div>
            
            {/* Issues Found */}
            <div className="p-4 rounded-lg bg-gray-50">
              <h3 className="mb-3 text-xl font-semibold">Issues Found</h3>
              {analysisResult.issues && analysisResult.issues.length > 0 ? (
                <ul className="pl-5 space-y-1 list-disc">
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
            <h3 className="mb-4 text-xl font-semibold">Screenshots</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Desktop Screenshot */}
              <div className="col-span-2 p-4 border border-gray-200 rounded-lg">
                <h4 className="mb-3 text-lg font-medium">Desktop View</h4> 
                {analysisResult.screenshots?.desktop ? (
                  <div className="relative overflow-hidden rounded-xl border border-gray-300 max-h-[50vh] overflow-y-auto">
                    <Image
                      src={analysisResult.screenshots.desktop}
                      alt="Desktop view of website"
                      width={1200}
                      height={800}
                      className="object-cover w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-100 rounded-xl">
                    <p className="text-gray-500">No desktop screenshot available</p>
                  </div>
                )}
              </div>
              
              {/* Mobile Screenshot */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <h4 className="mb-3 text-lg font-medium">Mobile View</h4>
                {analysisResult.screenshots?.mobile ? (
                  <div className="relative overflow-hidden rounded-xl border border-gray-300 max-h-[60vh] overflow-y-auto">
                    <Image
                      src={analysisResult.screenshots.mobile}
                      alt="Mobile view of website"
                      width={600}
                      height={1200}
                      className="object-cover w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 bg-gray-100 rounded-xl">
                    <p className="text-gray-500">No mobile screenshot available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Raw JSON (Expandable) */}
          <div className="mt-8">
            <details>
              <summary className="mb-2 text-lg font-semibold cursor-pointer">Raw Analysis Data</summary>
              <pre className="p-4 overflow-x-auto text-xs bg-gray-100 rounded-md">
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
