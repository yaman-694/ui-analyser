#!/usr/bin/env python
"""
UI Analyzer API Client Example

This script demonstrates how to use the UI Analyzer API.
"""

import argparse
import json
import os
import requests
from typing import Dict, Any


def analyze_website(
    url: str, api_key: str, api_url: str, save_screenshots: bool = False
) -> Dict[str, Any]:
    """
    Analyze a website using the UI Analyzer API.

    Args:
        url: The URL of the website to analyze
        api_key: The API key for authentication
        api_url: The URL of the API server
        save_screenshots: Whether to save screenshots permanently

    Returns:
        Dict containing analysis results
    """
    # Prepare request headers and data
    headers = {"Content-Type": "application/json", "X-API-Key": api_key}

    data = {"url": url, "save_screenshots": save_screenshots}

    # Make API request
    response = requests.post(f"{api_url}/analyze", headers=headers, json=data)

    # Check for successful response
    if response.status_code == 200:
        return response.json()
    else:
        # Handle error response
        print(f"Error: {response.status_code}")
        print(response.text)
        return {"error": True, "message": response.text}


def main():
    """Main entry point for the client example."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="UI Analyzer API Client Example")
    parser.add_argument("url", help="Website URL to analyze")
    parser.add_argument(
        "--save-screenshots", action="store_true", help="Save screenshots permanently"
    )
    parser.add_argument(
        "--api-url", default="http://localhost:8000", help="API server URL"
    )
    parser.add_argument("--api-key", help="API key for authentication")
    args = parser.parse_args()

    # Get API key from args or environment
    api_key = args.api_key or os.getenv("API_KEY", "development-key")

    # Analyze website
    print(f"📊 Analyzing {args.url}...")
    results = analyze_website(args.url, api_key, args.api_url, args.save_screenshots)

    # Print results
    if "error" not in results:
        print("\n" + "=" * 60)
        print("🎯 WEBSITE ANALYSIS RESULTS")
        print("=" * 60)
        print(f"🌐 URL: {results['url']}")
        print(f"⏱️  Load Time: {results['loadTime']:.1f} seconds")

        # Print Lighthouse metrics if available
        if results["lighthouse"]["available"]:
            print(
                f"⚡ Lighthouse Performance: {results['lighthouse']['performanceScore']:.0f}/100"
            )
            print(
                f"⚡ First Contentful Paint: {results['lighthouse']['fcpSeconds']:.1f}s"
            )
            print(
                f"⚡ Largest Contentful Paint: {results['lighthouse']['lcpSeconds']:.1f}s"
            )

        # Print screenshot paths if available
        if results["screenshots"]["desktop"]:
            print(f"📸 Desktop screenshot: {results['screenshots']['desktop']}")
        if results["screenshots"]["mobile"]:
            print(f"📱 Mobile screenshot: {results['screenshots']['mobile']}")

        # Print issues
        print("\nISSUES FOUND:")
        print("-" * 30)
        if results["issues"]:
            for issue in results["issues"]:
                print(f"• {issue}")
        else:
            print("✅ No issues found!")
        print("=" * 60)
    else:
        print(f"❌ Analysis failed: {results.get('message', 'Unknown error')}")


if __name__ == "__main__":
    main()
