"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const FormSchema = z.object({
  url: z.string().url({
    message: "Please enter a valid URL.",
  }),
});

export function AnalyzeField() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      url: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-3xl px-5 mx-auto mt-16"
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
  );
}
