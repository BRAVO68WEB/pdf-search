import { Uploader } from "./s3";
import { env } from "@/env";
import { v7 as uuidv7 } from "uuid";

export const downloadPdf = async (
	url: string,
): Promise<{
	blob: Blob;
	s3_url: string;
	is_error: boolean;
	url: string;
}> => {
	try {
		const response = await fetch(url, {
			redirect: "follow",
			keepalive: true,
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`Failed to download PDF: ${response.statusText}`);
		}

		const blob = await response.blob();
		const fileName = uuidv7() + ".pdf";
		const uploader = new Uploader(env.R2_BUCKET_NAME);

		await uploader.uploadFile("pdfs", fileName, blob, "public-read");

		return {
			is_error: false,
			blob,
			s3_url: `${env.R2_PUBLIC_URL}/${env.R2_BUCKET_NAME}/pdfs/${fileName}`,
			url,
		};
	} catch (error) {
		if (error instanceof Error) {
			console.error("Error:", error.message);
		}
		return {
			is_error: true,
			blob: new Blob(),
			s3_url: "",
			url,
		};
	}
};
