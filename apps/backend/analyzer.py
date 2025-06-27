import os
import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv()

class ChromiumPool:
    def __init__(self, max_browsers=4, max_tabs_per_browser=8):
        self.max_browsers = max_browsers
        self.max_tabs_per_browser = max_tabs_per_browser
        self.browsers = []  # List of (browser, [pages])
        self.lock = asyncio.Lock()
        self.playwright = None

    async def start(self):
        if not self.playwright:
            self.playwright = await async_playwright().start()

    async def acquire(self):
        async with self.lock:
            # Try to find a browser with available tab slot
            for browser, pages in self.browsers:
                if len(pages) < self.max_tabs_per_browser:
                    page = await browser.new_page()
                    pages.append(page)
                    return browser, page
            # If all browsers are full and we can create a new one
            if len(self.browsers) < self.max_browsers:
                browser = await self.playwright.chromium.launch(headless=True)
                page = await browser.new_page()
                self.browsers.append((browser, [page]))
                return browser, page
            # All browsers are full, wait for a slot
            # (In production, you may want a queue or timeout here)
            raise RuntimeError("All Chromium browsers and tabs are busy. Please try again later.")

    async def release(self, page):
        async with self.lock:
            for browser, pages in self.browsers:
                if page in pages:
                    try:
                        await page.close()
                    except Exception:
                        pass
                    pages.remove(page)
                    # Optionally close browser if no tabs left
                    if not pages:
                        try:
                            await browser.close()
                        except Exception:
                            pass
                        self.browsers.remove((browser, pages))
                    return

    async def close(self):
        async with self.lock:
            for browser, pages in self.browsers:
                for page in pages:
                    try:
                        await page.close()
                    except Exception:
                        pass
                try:
                    await browser.close()
                except Exception:
                    pass
            self.browsers.clear()
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None

class WebsiteAnalyzer:
    def __init__(self, save_screenshots=False, chromium_pool=None):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY not found in .env file")

        self.save_screenshots = save_screenshots
        self.llm = ChatOpenAI(
            model="gpt-4o",
            openai_api_key=self.openai_key,
            max_tokens=1500,
            temperature=0.0,  # Completely deterministic
            seed=12345,  # Fixed seed for consistency
        )
        self.chromium_pool = chromium_pool

    async def get_lighthouse_metrics(self, url):
        """Get Lighthouse performance metrics using Docker"""
        print("⚡ Running Lighthouse analysis...")
        try:
            # Run Lighthouse audit via Docker
            result = await self._run_lighthouse_audit(url)
            
            if result:
                # Extract metrics from Lighthouse response structure
                fcp_seconds = None
                performance_score = None
                lcp_seconds = None
                cls_value = None
                tbt_ms = None
                
                # Extract performance score
                if 'categories' in result and 'performance' in result['categories']:
                    performance_score = result['categories']['performance']['score'] * 100
                
                # Extract metrics from the Lighthouse response structure
                if 'audits' in result:
                    # First Contentful Paint
                    if 'first-contentful-paint' in result['audits']:
                        fcp_audit = result['audits']['first-contentful-paint']
                        if 'numericValue' in fcp_audit:
                            fcp_ms = fcp_audit['numericValue']
                            fcp_seconds = fcp_ms / 1000
                    
                    # Largest Contentful Paint
                    if 'largest-contentful-paint' in result['audits']:
                        lcp_audit = result['audits']['largest-contentful-paint']
                        if 'numericValue' in lcp_audit:
                            lcp_ms = lcp_audit['numericValue']
                            lcp_seconds = lcp_ms / 1000
                    
                    # Cumulative Layout Shift
                    if 'cumulative-layout-shift' in result['audits']:
                        cls_audit = result['audits']['cumulative-layout-shift']
                        if 'numericValue' in cls_audit:
                            cls_value = cls_audit['numericValue']
                    
                    # Total Blocking Time
                    if 'total-blocking-time' in result['audits']:
                        tbt_audit = result['audits']['total-blocking-time']
                        if 'numericValue' in tbt_audit:
                            tbt_ms = tbt_audit['numericValue']
                
                return {
                    "fcp_seconds": fcp_seconds,
                    "lcp_seconds": lcp_seconds,
                    "cls_value": cls_value,
                    "tbt_ms": tbt_ms,
                    "performance_score": performance_score,
                    "available": True,
                    "raw": result
                }
            
            return {"available": False}
            
        except Exception as e:
            print(f"⚠️  Lighthouse analysis failed: {e}")
            return {"available": False}

    async def _run_lighthouse_audit(self, url):
        """Execute Lighthouse audit using Docker"""
        print(f"� Running Lighthouse audit for {url}...")
        
        try:
            # Build Docker command for Lighthouse audit
            cmd = [
                "docker", "run", "--rm", 
                "--platform=linux/amd64",  # Platform compatibility for M1 Macs
                "femtopixel/google-lighthouse",
                "lighthouse", url,
                "--only-categories=performance",
                "--output=json",
                "--quiet",
                "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage"
            ]
            
            # Execute with timeout protection
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), 
                timeout=300
            )
            
            if process.returncode == 0:
                output = stdout.decode().strip()
                
                try:
                    lighthouse_data = json.loads(output)
                    print(f"✅ Lighthouse audit completed successfully")
                    return lighthouse_data
                except json.JSONDecodeError:
                    # Try to extract JSON from mixed output
                    json_start = output.find('{')
                    if json_start != -1:
                        lighthouse_data = json.loads(output[json_start:])
                        print(f"✅ Lighthouse audit completed successfully")
                        return lighthouse_data
                    
                    print(f"❌ Could not parse Lighthouse JSON output")
                    return None
            else:
                error_msg = stderr.decode().strip()
                print(f"❌ Lighthouse failed: {error_msg}")
                return None
                
        except asyncio.TimeoutError:
            print(f"❌ Lighthouse audit timed out after 90 seconds")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse Lighthouse JSON output: {e}")
            return None
        except Exception as e:
            print(f"❌ Lighthouse audit failed: {e}")
            return None

    async def analyze_website(self, url):
        """Analyze website by taking screenshots and using AI vision"""
        print(f"🔍 Analyzing: {url}")

        lighthouse_data = await self.get_lighthouse_metrics(url)
        screenshots_dir = Path("screenshots")
        screenshots_dir.mkdir(exist_ok=True)
        desktop_screenshot = screenshots_dir / "temp_desktop.png"
        mobile_screenshot = screenshots_dir / "temp_mobile.png"

        # Use ChromiumPool for browser/tab management
        await self.chromium_pool.start()
        browser, desktop_page = await self.chromium_pool.acquire()
        try:
            print("📱 Taking desktop screenshot...")
            await desktop_page.set_viewport_size({"width": 1920, "height": 1080})
            start_time = datetime.now()
            await desktop_page.goto(url, wait_until="networkidle", timeout=30000)
            end_time = datetime.now()
            load_time = (end_time - start_time).total_seconds()
            await desktop_page.screenshot(path=desktop_screenshot, full_page=True)
        finally:
            await self.chromium_pool.release(desktop_page)

        browser, mobile_page = await self.chromium_pool.acquire()
        try:
            print("📱 Taking mobile screenshot...")
            await mobile_page.set_viewport_size({"width": 375, "height": 667})
            await mobile_page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"})
            await mobile_page.goto(url, wait_until="networkidle")
            await mobile_page.screenshot(path=mobile_screenshot, full_page=True)
        finally:
            await self.chromium_pool.release(mobile_page)

        print("🤖 Analyzing with AI...")
        results = await self._analyze_screenshots(
            desktop_screenshot, mobile_screenshot, url, load_time, lighthouse_data
        )

        # Clean up temporary screenshots unless save_screenshots is True
        if not self.save_screenshots:
            self._cleanup_temp_screenshots(
                desktop_screenshot, mobile_screenshot
            )
        else:
            self._save_screenshots_with_names(
                desktop_screenshot, mobile_screenshot, url
            )

        return results, load_time, lighthouse_data

    async def _analyze_screenshots(
        self, desktop_screenshot, mobile_screenshot, url, load_time, lighthouse_data=None
    ):
        """Use OpenAI Vision to analyze screenshots against checklist"""

        # Convert images to base64
        with open(desktop_screenshot, "rb") as f:
            desktop_b64 = base64.b64encode(f.read()).decode()

        with open(mobile_screenshot, "rb") as f:
            mobile_b64 = base64.b64encode(f.read()).decode()

        # Use Lighthouse metrics if available, otherwise fall back to Playwright timing
        if lighthouse_data and lighthouse_data.get("available"):
            actual_load_time = lighthouse_data.get("fcp_seconds", load_time)
            performance_info = f" (Lighthouse FCP: {lighthouse_data.get('fcp_seconds', 'N/A'):.1f}s, Performance: {lighthouse_data.get('performance_score', 'N/A')}/100)"
        else:
            actual_load_time = load_time
            performance_info = f" (Playwright timing)"

        prompt = f"""
        You are a UX/UI expert conducting a systematic website analysis. Analyze these screenshots methodically and return ONLY the failed criteria.

        ANALYSIS CRITERIA:
        1. Hero section clarity: Can you immediately understand what this website offers?
        2. Load time: {actual_load_time:.1f} seconds{performance_info} (FAIL if > 3.0 seconds)
        3. Call-to-Action: Is there a prominent CTA button in the hero section?
        4. Mobile responsiveness: Compare desktop vs mobile - are they properly adapted?
        5. Human connection: Are there visible human faces or emotional imagery?
        6. Design consistency: Are fonts, colors, and layouts uniform?
        7. Navigation: Is the menu structure clear and logical?
        8. Interactive elements: Do buttons/links appear clickable?
        9. Search functionality: Is there a visible search feature?
        10. Content organization: Is text well-structured and not overwhelming?
        11. Text contrast: Is text easily readable against backgrounds?
        12. Text alignment: Are there obvious alignment problems?
        13. Element spacing: Is spacing between elements consistent and clean?

        STRICT INSTRUCTIONS:
        - Examine BOTH desktop and mobile screenshots carefully
        - Only return responses for criteria that clearly FAIL
        - Use exact response format below
        - Be consistent in your evaluation

        RESPONSE FORMAT (return only failed ones):
        R1. Users are not able to understand what the website is about at first glance.
        R2. Your website's core vitals have failed on Google PageSpeed, which could lead to a significant drop in search rankings. Your website is slow, taking {actual_load_time:.1f} seconds to load, which is more than the recommended 3 seconds.
        R3. CTA is missing in the hero section.
        R4. Your website is not mobile responsive, affecting user experience on different devices.
        R5. The design lacks human images, making it harder for users to connect emotionally.
        R6. Font or Color is/are inconsistent throughout the website, leading to a disjointed design.
        R7. Poor navigation menu, making it difficult for users to navigate.
        R8. Buttons are unresponsive on hover, making it difficult to identify interactive elements.
        R9. The search bar is not working.
        R10. The website contains too much text, overwhelming users and affecting readability.
        R11. Poor contrast between the text and background makes it difficult to read.
        R12. There are alignment issues on the website, leading to a disorganized design.
        R13. Inconsistent spacing between elements is leading to a cluttered and unappealing design.

        Return only the R responses that apply, one per line.
        """

        messages = [
            HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{desktop_b64}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{mobile_b64}",
                            "detail": "high",
                        },
                    },
                ]
            )
        ]

        try:
            response = await self.llm.ainvoke(messages)
            return response.content.strip()
        except Exception as e:
            print(f"❌ AI analysis failed: {e}")
            # Basic fallback analysis
            fallback_results = []
            
            # Check Playwright load time
            if load_time > 3:
                fallback_results.append(
                    f"R2. Your website's core vitals have failed on Google PageSpeed, which could lead to a significant drop in search rankings. Your website is slow, taking {load_time:.1f} seconds to load, which is more than the recommended 3 seconds."
                )
            
            # Check Lighthouse metrics if available
            if lighthouse_data and lighthouse_data.get("available"):
                if lighthouse_data.get('fcp_seconds', 0) > 2.5:
                    fallback_results.append(
                        f"R2. Your website's core vitals have failed on Google PageSpeed, which could lead to a significant drop in search rankings. Your website is slow, with First Contentful Paint at {lighthouse_data['fcp_seconds']:.1f} seconds."
                    )
                if lighthouse_data.get('performance_score', 100) < 70:
                    fallback_results.append(
                        f"R2. Your website's performance score is poor at {lighthouse_data['performance_score']}/100, indicating optimization issues that affect search rankings."
                    )
            
            return "\n".join(fallback_results)

    def _cleanup_temp_screenshots(self, desktop_screenshot, mobile_screenshot):
        """Remove temporary screenshots after analysis"""
        try:
            if desktop_screenshot.exists():
                desktop_screenshot.unlink()
            if mobile_screenshot.exists():
                mobile_screenshot.unlink()
            print("🗑️  Temporary screenshots cleaned up")
        except Exception as e:
            print(f"⚠️  Cleanup warning: {e}")

    def _save_screenshots_with_names(self, desktop_screenshot, mobile_screenshot, url):
        """Save screenshots with meaningful names when save_screenshots=True"""
        try:
            # Create a safe filename from URL
            safe_url = (
                url.replace("https://", "")
                .replace("http://", "")
                .replace("/", "_")
                .replace("?", "_")[:50]
            )
            timestamp = datetime.now().strftime("%Y%m%d_%H%M")

            # Create permanent names
            desktop_final = (
                desktop_screenshot.parent / f"desktop_{safe_url}_{timestamp}.png"
            )
            mobile_final = (
                mobile_screenshot.parent / f"mobile_{safe_url}_{timestamp}.png"
            )

            # Rename temporary files
            desktop_screenshot.rename(desktop_final)
            mobile_screenshot.rename(mobile_final)

            print(f"📸 Screenshots saved: {desktop_final.name}, {mobile_final.name}")
        except Exception as e:
            print(f"⚠️  Save warning: {e}")
            # Fallback to cleanup
            self._cleanup_temp_screenshots(desktop_screenshot, mobile_screenshot)


async def main():
    import sys
    save_screenshots = False
    args = sys.argv[1:]
    if "--save-screenshots" in args:
        save_screenshots = True
        args.remove("--save-screenshots")
    if len(args) != 1:
        print("Usage:")
        print("  python analyzer.py <website_url>")
        print("  python analyzer.py <website_url> --save-screenshots")
        print("\nExample:")
        print("  python analyzer.py https://example.com")
        print("  python analyzer.py https://example.com --save-screenshots")
        sys.exit(1)
    url = args[0]
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    chromium_pool = ChromiumPool(max_browsers=4, max_tabs_per_browser=8)
    analyzer = WebsiteAnalyzer(save_screenshots=save_screenshots, chromium_pool=chromium_pool)
    try:
        results, load_time, lighthouse_data = await analyzer.analyze_website(url)
        print("\n" + "=" * 60)
        print("🎯 WEBSITE ANALYSIS RESULTS")
        print("=" * 60)
        print(f"🌐 URL: {url}")
        print(f"⏱️  Load Time: {load_time:.1f} seconds")
        if lighthouse_data and lighthouse_data.get("available"):
            print(f"⚡ Lighthouse FCP: {lighthouse_data.get('fcp_seconds'):.1f} seconds")
            print(f"📊 Performance Score: {lighthouse_data.get('performance_score')}/100")
        print("\n📋 ISSUES FOUND:")
        print("-" * 30)
        if results.strip():
            for line in results.split("\n"):
                if line.strip():
                    print(f"• {line.strip()}")
        else:
            print("✅ No major issues found!")
        print("=" * 60)
        if save_screenshots:
            print("📸 Screenshots saved in ./screenshots/")
        else:
            print("🗑️  Temporary screenshots cleaned up")
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
    finally:
        await chromium_pool.close()

if __name__ == "__main__":
    asyncio.run(main())
