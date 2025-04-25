import { SearchResultType } from "@/types";
import { Printer } from "lucide-react";

// PagesPill component
const PagesPill = ({ totalPages }: { totalPages: number }) => {
	return (
		<div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
			{totalPages} pages
		</div>
	);
};

// RelevancyInfo component
const RelevancyInfo = ({
	totalPages,
	relevantPages,
}: {
	totalPages: number;
	relevantPages?: string[];
}) => {
	if (!relevantPages) {
		return (
			<div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
				<div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
				<span>Checking relevancy</span>
			</div>
		);
	}

	return (
		<div className="text-sm text-gray-500 mt-2">
			Relevant content in page {relevantPages.join(", ")}
		</div>
	);
};

// Individual search result component
const SearchResult = ({
	title,
	description,
	image,
	totalPages,
	relevantPages,
	pdf_url,
}: SearchResultType) => {
	return (
		<div className="flex flex-col sm:flex-row border rounded-lg overflow-hidden mb-4 bg-white">
			<div className="w-full sm:w-1/4 relative">
				<div className="w-full h-[160px]">
					<img
						src={image ?? "/public/pdf.png"}
						alt={title}
						className="w-full h-full object-cover object-[top_left]"
					/>
				</div>
				<PagesPill totalPages={totalPages} />
			</div>
			<div className="p-4 flex-1">
				<h3 className="font-medium text-base mb-2">{title}</h3>
				<p className="text-sm text-gray-600">{description}</p>
				<RelevancyInfo totalPages={totalPages} relevantPages={relevantPages} />

				<div className="flex items-center justify-between mt-4">
					<PrintIcon pdf_url={pdf_url} />
				</div>
			</div>
		</div>
	);
};

const handleDownload = (url: string) => {
	window.open(url, "_blank");
};

const PrintIcon = ({ pdf_url }: { pdf_url: string }) => {
	return (
		<button className="text-gray-500 hover:text-gray-700" onClick={() => handleDownload(pdf_url)}>
			<Printer />
		</button>
	);
};

export const SearchResults = ({ results }: { results: SearchResultType[] }) => {
	return (
		<div>
			<h2 className="text-xl font-medium mb-4">Results</h2>
			<div>
				{results.map(result => (
					<SearchResult key={result.id} {...result} />
				))}
			</div>
		</div>
	);
};
