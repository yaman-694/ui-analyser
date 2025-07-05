"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const FormSchema = z.object({
  url: z.string().url({
    message: "Please enter a valid URL.",
  }),
})

export function AnalyzeField() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      url: "",
    },
  })

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast("You submitted the following values", {
      description: (
        <pre className="mt-2 w-[320px] rounded-md bg-neutral-950 p-4">
          <code className="text-input">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-3xl mx-auto px-5 mt-16">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="bg-input rounded-full flex overflow-hidden items-center pr-1.5">
                  <Input 
                    className="bg-input border-0 rounded-full font-body flex-1 py-6 px-6 text-lg focus-visible:ring-0 focus-visible:ring-offset-0" 
                    placeholder="www.growigh.com" 
                    {...field} 
                  />
                  <Button 
                    type="submit" 
                    className="bg-[#3A2106] hover:bg-[#2A1805] font-body text-input rounded-full text-lg font-medium"
                  >
                    Analyze
                  </Button>
                </div>
              </FormControl>
              <FormMessage className="ml-4" />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}