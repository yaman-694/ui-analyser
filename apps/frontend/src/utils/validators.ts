import z from "zod";

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