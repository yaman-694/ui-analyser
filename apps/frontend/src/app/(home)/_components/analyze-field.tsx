"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "../../../../api-lists";
import { Toast } from "@/components/ui/toast";

// Define the user type
interface User {
  credits: number;
}

/**
 * URL validation regex pattern
 */
const URL_PATTERN = new RegExp(
	"^(https?:\\/\\/)?" + // protocol
		"((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|" + // domain name without trailing dot
		"((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
		"(\\:\\d+)?" + // port
		"(\\/[a-zA-Z\\d%_.~+-]*)*" + // path
		"(\\?[;&a-zA-Z\\d%_.~+=-]*)?" + // query string
		"(\\#[-a-zA-Z\\d_]*)?$", // fragment locator
	"i"
);


export const urlSchema = z.object({
	url: z
		.string()
		.trim()
		.min(1, { message: "URL is required" })
		.max(2048, { message: "URL is too long" })
		.refine((value) => URL_PATTERN.test(value), {
			message: "Invalid website URL (e.g., example.com)"
		})
		.transform((value) => {
			// Add https:// if protocol is missing
			if (!value.startsWith("http://") && !value.startsWith("https://")) {
				return `https://${value}`;
			}
			return value;
		})
});

export function AnalyzeField() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const form = useForm<z.infer<typeof urlSchema>>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  function onSubmit(data: z.infer<typeof urlSchema>) {

    if (currentUser === null) {
      Toast({ success: false, message: "Please log in to analyze a website." });
      return;
    }

    if (currentUser && currentUser.credits <= 0) {
      Toast({ success: false, message: "You have no credits left. Please try tomorrow." });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Redirect to analyze page with URL as query parameter
      const encodedUrl = encodeURIComponent(data.url);
      router.push(`/analyze?url=${encodedUrl}`);
    } catch (err) {
      console.error("Error navigating to analyze page:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getCurrentUser();
        setCurrentUser(response.data.data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="w-full max-w-3xl px-5 mx-auto mt-16">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full"
        >
          {error && <div className="mb-3 text-red-500 text-center">{error}</div>}
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="bg-input rounded-full flex overflow-hidden items-center pr-1.5">
                    <Input
                      className="flex-1 px-6 py-6 text-lg border-0 rounded-full bg-input font-body focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="www.growigh.com"
                      {...field}
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      className="bg-[#3A2106] hover:bg-[#2A1805] font-body text-input rounded-full text-lg font-medium"
                      disabled={isLoading}
                    >
                      {isLoading ? "Preparing..." : "Analyze"}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage className="ml-4" />
              </FormItem>
            )}
          />
        </form>
      </Form>
      
      {currentUser && (
        <div className="w-full flex justify-end mt-3">
          <div className="text-sm text-input font-medium px-4 py-1.5 bg-[#3A210620] rounded-full">
            {currentUser.credits} daily credits left
          </div>
        </div>
      )}
    </div>
  );
}
