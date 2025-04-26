import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import pLimit from "p-limit";
import { v7 as uuidv7 } from "uuid";

import { queryGroq, zodSchema } from "./groq";

import { DB } from "@/db/kysely";

export const getPdfPageCount = async (file_blob: Blob) => {
	const data = new WebPDFLoader(file_blob, {
		splitPages: true,
	});

	const doc = await data.load();

	return doc.length;
};

const findRelevantPagesByText = async (user_query: string, file_blob: Blob) => {
	const pages: number[] = [];

	const data = new WebPDFLoader(file_blob, {
		splitPages: true,
	});

	const doc = await data.load();

	if (doc.length > 75) {
		return {
			pages,
			total_page: doc.length,
		};
	}

	const processPages = async () => {
		// Use concurrency limiting to avoid overwhelming the API
		const limit = pLimit(5); // Process 5 pages concurrently

		// Group pages into batches for more efficient processing
		const batchSize = 10;
		const batches = [];

		for (let i = 0; i < doc.length; i += batchSize) {
			batches.push(doc.slice(i, i + batchSize));
		}

		// Process batches sequentially, but pages within batches concurrently
		for (const batch of batches) {
			const batchPromises = batch.map(page => {
				return limit(async () => {
					const page_no = page.metadata.loc.pageNumber;
					const pageContent = page.pageContent;

					try {
						const response = await queryGroq(user_query, {
							pageContent,
							page_no,
						});

						const parsedResponse = zodSchema.parse(
							JSON.parse(response.choices[0].message.content!),
						);
						return parsedResponse.is_relevant ? page_no : null;
					} catch (error) {
						console.error(`Error processing page ${page_no}:`, error);
						return null;
					}
				});
			});

			const results = await Promise.all(batchPromises);
			pages.push(...(results.filter(Boolean) as number[]));
		}
	};

	await processPages();

	return {
		pages,
		total_page: doc.length,
	};
};

export const getRelevantPages = async (
	user_query: string,
	file_blob: Blob,
	meta_data: {
		query: string;
		grade: string;
		title: string;
		description: string;
		s3_url: string;
		pdf_url: string;
		thumbnail_url: string;
	},
): Promise<{
	pages: number[];
	total_page: number;
	pdf_store_id: string;
}> => {
	const db = await DB.getInstance();

	const { query, grade, title, description, s3_url, pdf_url, thumbnail_url } = meta_data;

	// Start text and image analysis in parallel
	const textAnalysisPromise = findRelevantPagesByText(user_query, file_blob);

	// Insert PDF store data early to avoid waiting
	const pdf_store_data = await db
		.insertInto("pdf_stores")
		.values({
			id: uuidv7(),
			created_at: new Date(),
			description,
			grade,
			pdf_url,
			s3_url,
			query,
			title,
			total_pages: 0, // Will update this later
			thumbnail_url,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	// Get text analysis results
	const pagesByTextObj = await textAnalysisPromise;

	// Update total pages count
	await db
		.updateTable("pdf_stores")
		.set({ total_pages: pagesByTextObj.total_page })
		.where("id", "=", pdf_store_data.id)
		.execute();

	if (pagesByTextObj.total_page > 100) {
		return {
			pages: [],
			total_page: pagesByTextObj.total_page,
			pdf_store_id: pdf_store_data.id,
		};
	}

	const pagesByText = pagesByTextObj.pages;

	const allPages = pagesByText;

	return {
		pages: allPages,
		total_page: pagesByTextObj.total_page,
		pdf_store_id: pdf_store_data.id,
	};
};

export const getRelevanceRange = async (
	relevantPages: number[],
	meta_data: {
		search_result_id: string;
		pdf_store_id: string;
	},
): Promise<{
	id: string;
	range: string[];
}> => {
	if (!relevantPages.length) {
		return {
			id: "",
			range: [],
		};
	}

	const db = await DB.getInstance();

	const { search_result_id, pdf_store_id } = meta_data;

	let output: string[] = [];
	let rangeStart = relevantPages[0];
	let prev = relevantPages[0];

	// Handle single page case
	if (relevantPages.length === 1) {
		output = [String(rangeStart)];
	}

	for (let i = 1; i < relevantPages.length; i++) {
		const current = relevantPages[i];

		// If pages are not consecutive
		if (current - prev > 1) {
			// Add the completed range (or single page)
			output.push(rangeStart === prev ? String(rangeStart) : `${rangeStart}-${prev}`);
			// Start a new range
			rangeStart = current;
		}

		// If we're at the last page
		if (i === relevantPages.length - 1) {
			output.push(rangeStart === current ? String(current) : `${rangeStart}-${current}`);
		}

		prev = current;
	}

	// Save the parsed data to the database
	const pdf_parsed_data = await db
		.insertInto("pdf_parsed")
		.values({
			id: uuidv7(),
			pdf_store_id,
			search_result_id,
			relevance: JSON.stringify(output),
			created_at: new Date(),
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	return {
		id: pdf_parsed_data.id,
		range: output,
	};
};
