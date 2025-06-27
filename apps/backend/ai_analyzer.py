"""
AI Analysis module using LangChain and OpenAI for website screenshot analysis.
"""

import os
import base64
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv

load_dotenv()


class AIScreenshotAnalyzer:
    """Handles AI-powered analysis of website screenshots using OpenAI Vision."""
    
    # Response templates for analysis results
    RESPONSE_TEMPLATES = {
        "R1": "Users are not able to understand what the website is about at first glance.",
        "R2": "Your website's core vitals have failed on Google PageSpeed, which could lead to a significant drop in search rankings. Your website is slow, taking {load_time:.1f} seconds to load, which is more than the recommended 3 seconds.",
        "R3": "CTA is missing in the hero section.",
        "R4": "Your website is not mobile responsive, affecting user experience on different devices.",
        "R5": "The design lacks human images, making it harder for users to connect emotionally.",
        "R6": "Font or Color is/are inconsistent throughout the website, leading to a disjointed design.",
        "R7": "Poor navigation menu, making it difficult for users to navigate.",
        "R8": "Buttons are unresponsive on hover, making it difficult to identify interactive elements.",
        "R9": "The search bar is not working.",
        "R10": "The website contains too much text, overwhelming users and affecting readability.",
        "R11": "Poor contrast between the text and background makes it difficult to read.",
        "R12": "There are alignment issues on the website, leading to a disorganized design.",
        "R13": "Inconsistent spacing between elements is leading to a cluttered and unappealing design."
    }
    
    def __init__(self, config):
        """Initialize the AI analyzer with configuration."""
        self.config = config
        self.openai_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_key:
            raise ValueError("OPENAI_API_KEY not found in .env file")
        
        self.llm = ChatOpenAI(
            model=self.config.openai_model,
            openai_api_key=self.openai_key,
            max_tokens=self.config.openai_max_tokens,
            temperature=self.config.openai_temperature,
            seed=self.config.openai_seed,
        )
    
    async def analyze_screenshots(
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
        
        prompt = self._generate_analysis_prompt(actual_load_time, performance_info)
        
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
            return self._fallback_analysis(load_time, lighthouse_data)
    
    def _fallback_analysis(self, load_time, lighthouse_data):
        """Provide basic fallback analysis when AI fails"""
        fallback_results = []
        
        # Check Playwright load time
        if load_time > self.config.load_time_threshold:
            fallback_results.append(
                self.RESPONSE_TEMPLATES["R2"].format(load_time=load_time)
            )
        
        # Check Lighthouse metrics if available
        if lighthouse_data and lighthouse_data.get("available"):
            if lighthouse_data.get('fcp_seconds', 0) > self.config.fcp_threshold:
                fallback_results.append(
                    f"R2. Your website's core vitals have failed on Google PageSpeed, which could lead to a significant drop in search rankings. Your website is slow, with First Contentful Paint at {lighthouse_data['fcp_seconds']:.1f} seconds."
                )
            if lighthouse_data.get('performance_score', 100) < self.config.performance_score_threshold:
                fallback_results.append(
                    f"R2. Your website's performance score is poor at {lighthouse_data['performance_score']}/100, indicating optimization issues that affect search rankings."
                )
        
        return "\n".join(fallback_results)
    
    def _generate_analysis_prompt(self, actual_load_time, performance_info):
        """Generate the AI analysis prompt with dynamic response templates"""
        response_examples = "\n".join([
            f"{key}. {template.format(load_time=actual_load_time) if 'load_time' in template else template}"
            for key, template in self.RESPONSE_TEMPLATES.items()
        ])
        
        return f"""
        You are a UX/UI expert conducting a systematic website analysis. Analyze these screenshots methodically and return ONLY the failed criteria.

        ANALYSIS CRITERIA:
        1. Hero section clarity: Can you immediately understand what this website offers?
        2. Load time: {actual_load_time:.1f} seconds{performance_info} (FAIL if > {self.config.load_time_threshold} seconds)
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
        {response_examples}

        Return only the R responses that apply, one per line.
        """
