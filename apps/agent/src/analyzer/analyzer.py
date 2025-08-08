import os
import sys
import asyncio
import json
import shutil
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from config.config import default_config
from ai.ai_analyzer import AIScreenshotAnalyzer

load_dotenv()


class ChromiumPool:
    def __init__(self, max_browsers=4, max_tabs_per_browser=8):
        self.max_browsers = max_browsers
        self.max_tabs_per_browser = max_tabs_per_browser
        self.browsers = []
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
                # Launch Chromium with Docker-friendly flags to avoid sandbox and shared memory issues
                browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                    ],
                )
                page = await browser.new_page()
                self.browsers.append((browser, [page]))
                return browser, page
            # All browsers are full, wait for a slot
            # (In production, you may want a queue or timeout here)
            raise RuntimeError(
                "All Chromium browsers and tabs are busy. Please try again later."
            )

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
    def __init__(self, save_screenshots=False, chromium_pool=None, config=None):
        self.config = config or default_config
        self.config.validate()  # Validate configuration on startup

        self.save_screenshots = save_screenshots
        self.chromium_pool = chromium_pool

        # Initialize AI analyzer
        self.ai_analyzer = AIScreenshotAnalyzer(self.config)

        # Track screenshot paths for output
        self.desktop_screenshot_path = None
        self.mobile_screenshot_path = None

    async def get_lighthouse_metrics(self, url):
        """Get Lighthouse performance metrics using Docker"""
        print("⚡ Running Lighthouse analysis...")

        # Ensure Docker is running
        if not await self._ensure_docker_running():
            print("⚠️  Lighthouse analysis skipped - Docker unavailable")
            return {"available": False}

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
                if "categories" in result and "performance" in result["categories"]:
                    performance_score = (
                        result["categories"]["performance"]["score"] * 100
                    )

                # Extract metrics from the Lighthouse response structure
                if "audits" in result:
                    # First Contentful Paint
                    if "first-contentful-paint" in result["audits"]:
                        fcp_audit = result["audits"]["first-contentful-paint"]
                        if "numericValue" in fcp_audit:
                            fcp_ms = fcp_audit["numericValue"]
                            fcp_seconds = fcp_ms / 1000

                    # Largest Contentful Paint
                    if "largest-contentful-paint" in result["audits"]:
                        lcp_audit = result["audits"]["largest-contentful-paint"]
                        if "numericValue" in lcp_audit:
                            lcp_ms = lcp_audit["numericValue"]
                            lcp_seconds = lcp_ms / 1000

                    # Cumulative Layout Shift
                    if "cumulative-layout-shift" in result["audits"]:
                        cls_audit = result["audits"]["cumulative-layout-shift"]
                        if "numericValue" in cls_audit:
                            cls_value = cls_audit["numericValue"]

                    # Total Blocking Time
                    if "total-blocking-time" in result["audits"]:
                        tbt_audit = result["audits"]["total-blocking-time"]
                        if "numericValue" in tbt_audit:
                            tbt_ms = tbt_audit["numericValue"]

                return {
                    "fcp_seconds": fcp_seconds,
                    "lcp_seconds": lcp_seconds,
                    "cls_value": cls_value,
                    "tbt_ms": tbt_ms,
                    "performance_score": performance_score,
                    "available": True,
                    "raw": result,
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
                "docker",
                "run",
                "--rm",
                "femtopixel/google-lighthouse",
                "lighthouse",
                url,
                "--only-categories=performance",
                "--output=json",
                "--quiet",
                "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
            ]

            # Execute with timeout protection
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=self.config.lighthouse_timeout
            )

            if process.returncode == 0:
                output = stdout.decode().strip()

                try:
                    lighthouse_data = json.loads(output)
                    print(f"✅ Lighthouse audit completed successfully")
                    return lighthouse_data
                except json.JSONDecodeError:
                    # Try to extract JSON from mixed output
                    json_start = output.find("{")
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
            print(
                f"❌ Lighthouse audit timed out after {self.config.lighthouse_timeout} seconds"
            )
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse Lighthouse JSON output: {e}")
            return None
        except Exception as e:
            print(f"❌ Lighthouse audit failed: {e}")
            return None

    async def analyze_website(self, url):
        """
        Analyze website by taking screenshots and using AI vision.

        Args:
            url (str): The website URL to analyze

        Returns:
            tuple: (analysis_results, load_time, lighthouse_data)
        """
        print(f"🔍 Analyzing: {url}")

        # Step 1: Get Lighthouse performance metrics
        lighthouse_data = await self._get_lighthouse_data(url)

        # Step 2: Initialize screenshot paths
        screenshot_paths = self._setup_screenshot_paths()

        # Step 3: Capture screenshots and measure load time
        screenshot_results = await self._capture_screenshots(url, screenshot_paths)

        if not screenshot_results["success"]:
            return (
                screenshot_results["error_message"],
                screenshot_results["load_time"],
                lighthouse_data,
            )

        # Step 4: Perform AI analysis
        print("🤖 Analyzing with AI...")
        analysis_results = await self.ai_analyzer.analyze_screenshots(
            screenshot_results["desktop_path"],
            screenshot_results["mobile_path"],
            url,
            screenshot_results["load_time"],
            lighthouse_data,
        )

        # Step 5: Handle screenshot cleanup/saving
        self._handle_screenshot_persistence(
            screenshot_results["desktop_path"], screenshot_results["mobile_path"], url
        )

        return analysis_results, screenshot_results["load_time"], lighthouse_data

    async def _get_lighthouse_data(self, url: str) -> dict:
        """Get Lighthouse performance metrics with proper error handling."""
        try:
            lighthouse_data = await self.get_lighthouse_metrics(url)

            # Check for Lighthouse runtime errors
            if lighthouse_data.get("runtime_error", {}).get("code"):
                error_message = lighthouse_data["runtime_error"].get(
                    "message", "Unknown Lighthouse runtime error"
                )
                print(f"⚠️  Lighthouse error: {error_message}")

            return lighthouse_data

        except Exception as e:
            print(f"⚠️  Lighthouse analysis failed: {e}")
            return {"available": False}

    def _setup_screenshot_paths(self) -> dict:
        """Setup screenshot file paths and ensure directory exists."""
        screenshots_dir = Path("screenshots")
        screenshots_dir.mkdir(exist_ok=True)

        return {
            "desktop": screenshots_dir / "temp_desktop.png",
            "mobile": screenshots_dir / "temp_mobile.png",
        }

    async def _capture_screenshots(self, url: str, screenshot_paths: dict) -> dict:
        """
        Capture desktop and mobile screenshots with proper error handling.

        Returns:
            dict: {
                'success': bool,
                'load_time': float,
                'desktop_path': Path,
                'mobile_path': Path,
                'error_message': str (if success=False)
            }
        """
        # Ensure ChromiumPool is started
        await self.chromium_pool.start()

        # Capture desktop screenshot first
        desktop_result = await self._capture_single_screenshot(
            url, screenshot_paths["desktop"], "desktop"
        )

        if not desktop_result["success"]:
            return {
                "success": False,
                "load_time": desktop_result["load_time"],
                "error_message": desktop_result["error_message"],
                "desktop_path": None,
                "mobile_path": None,
            }

        # Capture mobile screenshot only if desktop was successful
        mobile_result = await self._capture_single_screenshot(
            url, screenshot_paths["mobile"], "mobile"
        )

        # If mobile fails, use desktop screenshot as fallback
        if not mobile_result["success"]:
            print(f"⚠️  Mobile screenshot failed: {mobile_result['error_message']}")
            try:
                import shutil

                shutil.copy2(screenshot_paths["desktop"], screenshot_paths["mobile"])
                print("📱 Using desktop screenshot as mobile fallback")
            except Exception as e:
                print(f"⚠️  Fallback screenshot creation failed: {e}")

        return {
            "success": True,
            "load_time": desktop_result["load_time"],
            "desktop_path": screenshot_paths["desktop"],
            "mobile_path": screenshot_paths["mobile"],
        }

    async def _capture_single_screenshot(
        self, url: str, screenshot_path: Path, device_type: str
    ) -> dict:
        """
        Capture a single screenshot for desktop or mobile.

        Args:
            url (str): Website URL
            screenshot_path (Path): Path to save screenshot
            device_type (str): 'desktop' or 'mobile'

        Returns:
            dict: {
                'success': bool,
                'load_time': float,
                'error_message': str (if success=False)
            }
        """
        browser = None
        page = None
        load_time = 0.0

        try:
            # Acquire browser page from pool
            browser, page = await self.chromium_pool.acquire()

            print(f"📱 Taking {device_type} screenshot...")

            # Configure page based on device type
            if device_type == "desktop":
                await page.set_viewport_size(self.config.desktop_viewport)
            else:  # mobile
                await page.set_viewport_size(self.config.mobile_viewport)
                await page.set_extra_http_headers(
                    {"User-Agent": self.config.mobile_user_agent}
                )

            # Navigate to URL and measure load time
            start_time = datetime.now()
            await page.goto(
                url, wait_until="networkidle", timeout=self.config.screenshot_timeout
            )
            end_time = datetime.now()
            load_time = (end_time - start_time).total_seconds()

            # Take screenshot
            await page.screenshot(path=screenshot_path, full_page=True)

            return {"success": True, "load_time": load_time, "error_message": None}

        except Exception as e:
            error_message = str(e)
            print(f"❌ {device_type.capitalize()} screenshot failed: {error_message}")

            # Determine error type and return appropriate message
            if "Timeout" in error_message or "timeout" in error_message.lower():
                return {
                    "success": False,
                    "load_time": load_time,
                    "error_message": self._handle_website_timeout(url),
                }
            else:
                return {
                    "success": False,
                    "load_time": load_time,
                    "error_message": self._handle_website_error(url, error_message),
                }

        finally:
            # Always release the page back to pool
            if page:
                try:
                    await self.chromium_pool.release(page)
                except Exception as e:
                    print(f"⚠️  Failed to release {device_type} page: {e}")

    def _handle_screenshot_persistence(
        self, desktop_path: Path, mobile_path: Path, url: str
    ) -> None:
        """Handle screenshot cleanup or saving based on configuration."""
        # Store paths for output
        self.desktop_screenshot_path = desktop_path
        self.mobile_screenshot_path = mobile_path

        if not self.save_screenshots:
            self._cleanup_temp_screenshots(desktop_path, mobile_path)
        else:
            self._save_screenshots_with_names(desktop_path, mobile_path, url)

    def _handle_website_timeout(self, url):
        """Handle website timeout - likely blocked or slow website"""
        return (
            "🚫 WEBSITE ACCESS ISSUE\n\n"
            "The website is not responding or taking too long to load (>30 seconds).\n\n"
            "Possible reasons:\n"
            "• Website may be down or not working\n"
            "• Website may be blocked in your country/region\n"
            "• Website may have very slow servers\n"
            "• Network connectivity issues\n\n"
            "Please try:\n"
            "• Check if the website works in your browser\n"
            "• Try again later\n"
            "• Use a VPN if the website might be geo-blocked"
        )

    def _handle_website_error(self, url, error_message):
        """Handle other website access errors"""
        return (
            "🚫 WEBSITE ACCESS ERROR\n\n"
            "Unable to access the website for analysis.\n\n"
            "Possible reasons:\n"
            "• Website does not exist or URL is incorrect\n"
            "• Website requires special authentication\n"
            "• Website blocks automated tools\n"
            "• SSL/HTTPS certificate issues\n\n"
            f"Technical error: {error_message[:100]}...\n\n"
            "Please verify the URL is correct and the website is accessible."
        )

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

            # Store paths for output
            self.desktop_screenshot_path = desktop_final
            self.mobile_screenshot_path = mobile_final

            print(f"📸 Screenshots saved: {desktop_final.name}, {mobile_final.name}")
        except Exception as e:
            print(f"⚠️  Save warning: {e}")
            # Fallback to cleanup
            self._cleanup_temp_screenshots(desktop_screenshot, mobile_screenshot)

    async def _ensure_docker_running(self):
        """Ensure Docker is running, attempt to start if not"""
        try:
            # Check if Docker is already running
            process = await asyncio.create_subprocess_exec(
                "docker",
                "info",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)

            if process.returncode == 0:
                print("✅ Docker is running")
                return True

        except (asyncio.TimeoutError, FileNotFoundError):
            pass

        # Docker is not running - check if auto-start is enabled
        if not self.config.auto_start_docker:
            print("⚠️  Docker not running and auto-start is disabled")
            return False

        # Docker is not running, try to start it
        print("🐳 Docker not running, attempting to start...")

        try:
            # Detect operating system
            if sys.platform == "darwin":  # macOS
                # Try to start Docker Desktop (macOS)
                if os.path.exists("/Applications/Docker.app"):
                    print("🚀 Starting Docker Desktop for macOS...")
                    process = await asyncio.create_subprocess_exec(
                        "open",
                        "/Applications/Docker.app",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    await process.communicate()

                    # Wait for Docker to start (up to 60 seconds)
                    for i in range(12):  # 12 * 5 = 60 seconds
                        await asyncio.sleep(5)
                        try:
                            check_process = await asyncio.create_subprocess_exec(
                                "docker",
                                "info",
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.PIPE,
                            )
                            stdout, stderr = await asyncio.wait_for(
                                check_process.communicate(), timeout=5
                            )

                            if check_process.returncode == 0:
                                print("✅ Docker started successfully!")
                                return True

                            print(f"⏳ Waiting for Docker to start... ({(i+1)*5}s)")

                        except (asyncio.TimeoutError, Exception):
                            continue

            elif sys.platform.startswith("linux"):  # Linux (including Ubuntu)
                # Try with systemctl first (most common on modern Linux)
                if os.path.exists("/usr/bin/systemctl") or os.path.exists(
                    "/bin/systemctl"
                ):
                    print("🚀 Starting Docker service via systemctl...")

                    # First try without sudo (if user has proper permissions)
                    try:
                        systemctl_cmd = "systemctl"
                        if not os.access("/var/run/docker.sock", os.W_OK):
                            # Needs elevated permissions
                            systemctl_cmd = "sudo systemctl"

                        process = await asyncio.create_subprocess_exec(
                            *systemctl_cmd.split(),
                            "start",
                            "docker",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        stdout, stderr = await asyncio.wait_for(
                            process.communicate(), timeout=10
                        )
                    except Exception as e:
                        print(f"Warning: systemctl start attempt failed: {e}")

                    # Check if docker started
                    await asyncio.sleep(3)
                    try:
                        check_process = await asyncio.create_subprocess_exec(
                            "docker",
                            "info",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        stdout, stderr = await asyncio.wait_for(
                            check_process.communicate(), timeout=5
                        )

                        if check_process.returncode == 0:
                            print("✅ Docker started successfully!")
                            return True
                    except Exception as e:
                        print(f"Warning: Docker check failed: {e}")

                # Try with service command (older Ubuntu/Debian systems)
                if os.path.exists("/usr/sbin/service") or os.path.exists(
                    "/sbin/service"
                ):
                    print("🚀 Trying to start Docker with service command...")
                    try:
                        service_cmd = "service"
                        if not os.access("/var/run/docker.sock", os.W_OK):
                            service_cmd = "sudo service"

                        process = await asyncio.create_subprocess_exec(
                            *service_cmd.split(),
                            "docker",
                            "start",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        stdout, stderr = await asyncio.wait_for(
                            process.communicate(), timeout=10
                        )

                        # Check if docker started
                        await asyncio.sleep(3)
                        check_process = await asyncio.create_subprocess_exec(
                            "docker",
                            "info",
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        stdout, stderr = await asyncio.wait_for(
                            check_process.communicate(), timeout=5
                        )

                        if check_process.returncode == 0:
                            print("✅ Docker started successfully!")
                            return True
                    except Exception as e:
                        print(f"Warning: service command attempt failed: {e}")

            # If we reached here, none of the methods worked
            print(
                "⚠️  Could not start Docker automatically - continuing without Lighthouse"
            )
            return False

        except Exception as e:
            print(f"⚠️  Failed to start Docker: {e} - continuing without Lighthouse")
            return False


async def main():
    # Load configuration from environment
    config = default_config
    config.validate()

    # Parse command line arguments
    save_screenshots = False
    output_json = False
    args = sys.argv[1:]

    if "--save-screenshots" in args:
        save_screenshots = True
        args.remove("--save-screenshots")

    if "--json" in args:
        output_json = True
        args.remove("--json")

    if len(args) != 1:
        print("Usage:")
        print("  python analyzer.py <website_url> [--save-screenshots] [--json]")
        print("\nExample:")
        print("  python analyzer.py https://example.com")
        print("  python analyzer.py https://example.com --save-screenshots --json")
        print("\nConfiguration:")
        print(f"  Max browsers: {config.max_browsers}")
        print(f"  Max tabs per browser: {config.max_tabs_per_browser}")
        print(f"  Screenshot timeout: {config.screenshot_timeout}ms")
        print(f"  Load time threshold: {config.load_time_threshold}s")
        sys.exit(1)

    url = args[0]
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    # Use configuration in ChromiumPool
    chromium_pool = ChromiumPool(
        max_browsers=config.max_browsers,
        max_tabs_per_browser=config.max_tabs_per_browser,
    )

    # Use configuration in WebsiteAnalyzer
    analyzer = WebsiteAnalyzer(
        save_screenshots=save_screenshots, chromium_pool=chromium_pool, config=config
    )

    desktop_path = None
    mobile_path = None

    try:
        results, load_time, lighthouse_data = await analyzer.analyze_website(url)

        # Extract issues from the results text
        issues_list = []
        if results.strip():
            for line in results.split("\n"):
                if line.strip():
                    issues_list.append(line.strip())

        # Check for screenshot paths from the analyzer
        if (
            hasattr(analyzer, "desktop_screenshot_path")
            and analyzer.desktop_screenshot_path
        ):
            desktop_path = str(analyzer.desktop_screenshot_path)

        if (
            hasattr(analyzer, "mobile_screenshot_path")
            and analyzer.mobile_screenshot_path
        ):
            mobile_path = str(analyzer.mobile_screenshot_path)

        # Create output structure
        output_data = {
            "url": url,
            "loadTime": load_time,
            "issues": issues_list,
            "screenshots": {"desktop": desktop_path, "mobile": mobile_path},
            "lighthouse": {"available": False},
        }

        # Add lighthouse data if available
        if lighthouse_data and lighthouse_data.get("available"):
            output_data["lighthouse"] = {
                "available": True,
                "performanceScore": lighthouse_data.get("performance_score"),
                "fcpSeconds": lighthouse_data.get("fcp_seconds"),
                "lcpSeconds": lighthouse_data.get("lcp_seconds"),
                "clsValue": lighthouse_data.get("cls_value"),
                "tbtMs": lighthouse_data.get("tbt_ms"),
            }

        if output_json:
            # Output JSON result
            print(json.dumps(output_data))
        else:
            # Output human-readable format for backward compatibility
            print("\n" + "=" * 60)
            print("🎯 WEBSITE ANALYSIS RESULTS")
            print("=" * 60)
            print(f"🌐 URL: {url}")
            print(f"⏱️  Load Time: {load_time:.1f} seconds")
            if lighthouse_data and lighthouse_data.get("available"):
                print(
                    f"⚡ Lighthouse FCP: {lighthouse_data.get('fcp_seconds'):.1f} seconds"
                )
                print(
                    f"📊 Performance Score: {lighthouse_data.get('performance_score')}/100"
                )

            if desktop_path:
                print(f"Desktop screenshot: {desktop_path}")
            if mobile_path:
                print(f"Mobile screenshot: {mobile_path}")

            print("\nISSUES FOUND:")
            print("-" * 30)
            if issues_list:
                for issue in issues_list:
                    print(f"• {issue}")
            else:
                print("✅ No issues found!")
            print("=" * 60)
            if save_screenshots:
                print("📸 Screenshots saved in ./screenshots/")
            else:
                print("🗑️  Temporary screenshots cleaned up")

    except Exception as e:
        error_data = {"error": True, "message": str(e), "url": url}

        if output_json:
            print(json.dumps(error_data))
        else:
            print(f"❌ Analysis failed: {e}")
    finally:
        await chromium_pool.close()


if __name__ == "__main__":
    asyncio.run(main())
