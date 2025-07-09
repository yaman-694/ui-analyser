import { z } from 'zod';


/**
 * URL validation regex pattern
 */
const URL_PATTERN = new RegExp(
	"^(https?:\\/\\/)?" + // protocol
	"((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
	"((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
	"(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
	"(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
	"(\\#[-a-z\\d_]*)?$", // fragment locator
	"i"
);

/**
 * Schema to validate URL.
 *
 * @type {ZodSchema}
 * @property {string} url - The URL to be validated.
 */
export const urlSchema = z.object({
	url: z
		.string()
		.trim()
		.min(1, { message: "URL is required" })
		.max(2048, { message: "URL is too long" })
		.refine((value) => URL_PATTERN.test(value), {
			message: "Please enter a valid website URL (e.g., example.com)"
		})
		.transform((value) => {
			if (!value.startsWith("http://") && !value.startsWith("https://")) {
				return `https://${value}`;
			}
			return value;
		})
});
