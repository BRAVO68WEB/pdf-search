"use client";

import { GradeDropdown, Grade } from "@/components/GradeDropdown";
import { SearchBar } from "@/components/SearchBar";
import { useEffect, useState, useCallback } from "react";
import { SearchResults } from "@/components/SearchResults";
import { SearchResultType } from "@/types";
import { getBasicSearchResults, calculateRelevance } from "@/actions/op";
import debounce from "lodash.debounce";

export default function Home() {
	const [searchResults, setSearchResults] = useState<SearchResultType[]>([]);
	const [selectedGrade, setSelectedGrade] = useState<Grade>(Grade.ALL);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchHistory, setSearchHistory] = useState<
		{ id: string; query: string; created_at: string }[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isCalculatingRelevance, setIsCalculatingRelevance] = useState(false);
	const [searchResultId, setSearchResultId] = useState<string | null>(null);

	// Fetch search history when query changes
	const fetchSearchHistory = useCallback(
		debounce(async (query: string, grade: string) => {
			if (!query) {
				setSearchHistory([]);
				return;
			}

			try {
				const response = await fetch(
					`/api/history?query=${encodeURIComponent(query)}&grade=${encodeURIComponent(grade)}`,
				);
				if (response.ok) {
					const data = await response.json();
					setSearchHistory(
						data.map((item: { id: string; query: string; created_at: string }) => ({
							id: item.id,
							query: item.query,
							created_at: item.created_at,
						})),
					);
				}
			} catch (error) {
				console.error("Error fetching search history:", error);
			}
		}, 300),
		[],
	);

	// Update history when query or grade changes
	useEffect(() => {
		if (!searchResultId) {
			fetchSearchHistory(searchQuery, selectedGrade);
		}
	}, [searchQuery, selectedGrade, fetchSearchHistory]);

	// Perform search
	const handleSearch = async () => {
		if (!searchQuery.trim()) return;

		setIsLoading(true);
		setSearchResults([]);
		setSearchResultId(null);

		try {
			// Step 1: Create search request using the API
			const response = await fetch(
				`/api/search?query=${encodeURIComponent(searchQuery)}&grade=${encodeURIComponent(selectedGrade)}`,
			);

			if (!response.ok) {
				throw new Error("Search request failed");
			}

			const data = await response.json();
			const newSearchResultId = data.id;
			setSearchResultId(newSearchResultId);

			// Step 2: Get basic search results using server action
			const basicResults = await getBasicSearchResults(newSearchResultId);
			setSearchResults(basicResults);
			setIsLoading(false);

			// Store PDF texts for relevance calculation
			const textsForRelevance = basicResults.map(result => ({
				pdf_store_id: result.id,
				pages: [], // We don't have pages yet, but the structure is needed
			}));

			// Step 3: Calculate relevance in the background
			setIsCalculatingRelevance(true);
			const relevantResults = await calculateRelevance(newSearchResultId, textsForRelevance);

			// Update results with relevance information
			if (relevantResults.length > 0) {
				setSearchResults(relevantResults);
			}
		} catch (error) {
			console.error("Search error:", error);
		} finally {
			setIsCalculatingRelevance(false);
		}
	};

	// Check for pre-existing results when a search history item is selected
	const handleHistorySelect = async (search_result_id: string, query: string) => {
		try {
			setSearchResultId(search_result_id);
			setSearchQuery(query);
			setIsLoading(true);
			// Try to fetch pre-existing results first
			const response = await fetch(
				`/api/pre?search_result_id=${encodeURIComponent(search_result_id)}`,
			);

			if (response.ok) {
				const data = await response.json();
				if (data && data.length > 0) {
					setSearchResults(data);
					setIsLoading(false);
					return; // We already have results, no need to search again
				}
			}

			setSearchQuery(query);
			// If no pre-existing results, perform a new search
			handleSearch();
		} catch (error) {
			console.error("Error fetching pre-existing results:", error);
			// Fall back to new search
			handleSearch();
		}
	};

	return (
		<div className="flex flex-col items-center w-full sm:w-3/4 max-w-full mx-auto pt-6">
			<div className="w-full px-4 relative">
				<h1 className="text-2xl font-semibold mb-4">PDF Search</h1>
				{/* Search bar and grade dropdown container */}
				<div className="flex flex-col gap-2">
					<div className="flex items-stretch">
						<div className="flex-1">
							<SearchBar
								value={searchQuery}
								onChange={setSearchQuery}
								placeholder="Search..."
								history={searchHistory}
								onSearch={handleSearch}
								onHistorySelect={handleHistorySelect}
							/>
						</div>
						<div className="ml-4 relative z-10 h-12">
							<GradeDropdown value={selectedGrade} onChange={setSelectedGrade} />
						</div>
					</div>
				</div>
			</div>

			{/* Search results section */}
			<div className="w-full px-4 mt-6">
				{isLoading ? (
					<div className="text-center py-8">
						<p>Loading search results...</p>
					</div>
				) : (
					<>
						<SearchResults results={searchResults} />
						{isCalculatingRelevance && searchResults.length > 0 && (
							<div className="text-center py-2 text-sm text-gray-500">Calculating relevance...</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
