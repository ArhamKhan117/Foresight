import { useGlobalContext } from "@/providers/GlobalContext";
import { PendingData, Prediction } from "@/types/type";
import { useEffect, useState } from "react";
import { categories } from "@/data/data";
import Pagination from "../pagination/Pagination";
import PredictionCard from "./PredictionCard";
import CompactPredictionCard from "./CompactPredictionCard";
import MultiOutcomeCard from "./MultiOutcomeCard";
import MultiOutcomePendingCard from "./MultiOutcomePendingCard";
import PendingCard from "./PendingCard";
import Navbar from "../Navbar";
import axios from "axios";
import { MarketDataType } from "@/types/type";
import { AxiosResponse } from "axios";
import { API_ENDPOINTS } from "@/config/api";

// Sample data (10 items)
export const activePredictions: Prediction[] = [
  {
    category: "Trending",
    question: "Will $BTC rise +2% today?",
    volume: "$19,045",
    timeLeft: "2:47:38",
    comments: 45,
    yesPercentage: 65,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Sports",
    question: "Will Team A win the championship?",
    volume: "$8,750",
    timeLeft: "1:15:23",
    comments: 50,
    yesPercentage: 60,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Crypto",
    question: "Will Ethereum hit $3,000 this year?",
    volume: "$22,500",
    timeLeft: "5:30:50",
    comments: 38,
    yesPercentage: 72,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "News",
    question: "Will a new tech law be passed this year?",
    volume: "$12,350",
    timeLeft: "3:15:10",
    comments: 21,
    yesPercentage: 55,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will Tesla stock go up by 10%?",
    volume: "$30,120",
    timeLeft: "4:45:15",
    comments: 61,
    yesPercentage: 60,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Sports",
    question: "Will LeBron James retire this year?",
    volume: "$15,600",
    timeLeft: "2:12:30",
    comments: 54,
    yesPercentage: 80,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Crypto",
    question: "Will Cardano rise 30% this quarter?",
    volume: "$18,200",
    timeLeft: "3:00:20",
    comments: 45,
    yesPercentage: 67,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "News",
    question: "Will climate change policies get stronger this year?",
    volume: "$25,400",
    timeLeft: "1:45:10",
    comments: 78,
    yesPercentage: 60,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will SpaceX launch a satellite?",
    volume: "$13,250",
    timeLeft: "6:30:05",
    comments: 33,
    yesPercentage: 66,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Sports",
    question: "Will Messi break a new goal-scoring record?",
    volume: "$5,700",
    timeLeft: "7:12:30",
    comments: 25,
    yesPercentage: 50,
    imageUrl: "https://placehold.co/56x56",
  },
];

// Sample Pending Predictions
export const pendingPredictions: PendingData[] = [
  {
    category: "Crypto",
    question: "Will Ethereum hit $3,000 this year?",
    volume: "$22,500",
    timeLeft: "Pending",
    comments: 38,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "News",
    question: "Will a new tech law be passed this year?",
    volume: "$12,350",
    timeLeft: "Pending",
    comments: 21,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will AI surpass human intelligence by 2030?",
    volume: "$18,750",
    timeLeft: "Pending",
    comments: 55,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Sports",
    question: "Will Manchester United win the Champions League?",
    volume: "$15,900",
    timeLeft: "Pending",
    comments: 33,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Crypto",
    question: "Will Solana flip Ethereum in market cap?",
    volume: "$30,500",
    timeLeft: "Pending",
    comments: 62,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will the next U.S. election result in a recount?",
    volume: "$20,750",
    timeLeft: "Pending",
    comments: 41,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will the S&P 500 reach a new all-time high?",
    volume: "$25,800",
    timeLeft: "Pending",
    comments: 47,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Crypto",
    question: "Will Apple launch a foldable iPhone by 2026?",
    volume: "$14,300",
    timeLeft: "Pending",
    comments: 29,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "Trending",
    question: "Will SpaceX successfully launch humans to Mars?",
    volume: "$50,000",
    timeLeft: "Pending",
    comments: 88,
    imageUrl: "https://placehold.co/56x56",
  },
  {
    category: "News",
    question: "Will the next Marvel movie gross over $1 billion?",
    volume: "$19,600",
    timeLeft: "Pending",
    comments: 52,
    imageUrl: "https://placehold.co/56x56",
  },
];

interface MarketProps {
  showRecentActivity?: boolean;
  onToggleRecentActivity?: () => void;
  linkBase?: string;
}

const Market: React.FC<MarketProps> = ({ showRecentActivity = true, onToggleRecentActivity, linkBase }) => {
  const { markets, activeTab, formatMarketData } = useGlobalContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("Trending");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Reset category to Trending when switching to Pending tab if Closed was selected
  useEffect(() => {
    if (activeTab === "PENDING" && selectedCategory === "Closed") {
      setSelectedCategory("Trending");
    }
  }, [activeTab]);

  useEffect(() => {
    let isCancelled = false;
    
    // Clear markets immediately when switching tabs to prevent showing stale data
    formatMarketData([]);
    
    const fetchMarkets = async () => {
      setIsLoading(true);
      try {
        // When "Closed" category is selected, always fetch CLOSED markets
        const marketStatus = selectedCategory === "Closed" ? "CLOSED" : (activeTab === "PENDING" ? "PENDING" : "ACTIVE");
        
        // Map category to marketField for API query (skip for Closed/Trending)
        let marketFieldParam = "";
        if (selectedCategory === "Crypto") marketFieldParam = "&marketField=0";
        else if (selectedCategory === "Sports") marketFieldParam = "&marketField=1";
        else if (selectedCategory === "News") marketFieldParam = "&marketField=2";
        else if (selectedCategory === "Tweets") marketFieldParam = "&marketField=3";
        // Trending & Closed = no marketField filter
        
        const marketData = await axios.get(`${API_ENDPOINTS.MARKET.GET}?page=${currentPage}&limit=10&marketStatus=${marketStatus}${marketFieldParam}`);

        if (!isCancelled) {
          setTotal(marketData.data.total);
          formatMarketData(marketData.data.data);
        }
      } catch (error) {
        console.error("Error fetching markets:", error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };
    
    fetchMarkets();
    
    return () => {
      isCancelled = true;
    };
  }, [activeTab, selectedCategory, currentPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when changing category
  };

  // Filter markets based on selected category
  const filteredMarkets = markets.filter(market => {
    if (selectedCategory === "Closed") {
      // Under Active tab: show closed markets that were funded (had investments)
      // Under Pending tab: show closed markets that were never funded
      if (activeTab === "ACTIVE") return market.totalInvestment > 0;
      if (activeTab === "PENDING") return !market.totalInvestment || market.totalInvestment === 0;
      return true;
    }
    if (selectedCategory === "Trending") return true;
    if (selectedCategory === "Crypto") return market.marketField === 0;
    if (selectedCategory === "Sports") return market.marketField === 1;
    if (selectedCategory === "News") return market.marketField === 2;
    if (selectedCategory === "Tweets") return market.marketField === 3;
    return true;
  });

  // Deduplicate multi-outcome groups: keep only the first outcome per eventGroupId,
  // then sort so newest markets (by createdAt) appear first
  const deduped = (() => {
    const seen = new Set<string>();
    const result = [];
    for (const m of filteredMarkets) {
      if (m.marketType === "multi" && m.eventGroupId) {
        if (seen.has(m.eventGroupId)) continue;
        seen.add(m.eventGroupId);
      }
      result.push(m);
    }
    // Sort newest first (API already sorts, but grouping can shift order)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  })();

  return (
    <div className="flex-1 w-full flex flex-col self-stretch justify-start items-start gap-6">
      <Navbar 
        categories={activeTab === "PENDING" ? categories.filter(c => c.name !== "Closed") : categories} 
        onCategorySelect={handleCategorySelect}
        selectedCategory={selectedCategory}
        showRecentActivity={showRecentActivity}
        onToggleRecentActivity={onToggleRecentActivity}
      />
      <div className={`grid w-full ${
        activeTab === "PENDING" 
          ? "gap-4 2xl:grid-cols-3 xl:grid-cols-3 lg:grid-cols-2 sm:grid-cols-1" 
          : showRecentActivity
            ? "gap-4 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 sm:grid-cols-1"
            : "gap-3 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-3 md:grid-cols-2 grid-cols-1"
      }`}>
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#07b3ff]"></div>
            <p className="text-[#838587] text-lg mt-4">Loading markets...</p>
          </div>
        ) : deduped.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-[#838587] text-xl">
              {selectedCategory === "Closed"
                ? (activeTab === "ACTIVE" 
                  ? "No closed markets that were active yet."
                  : "No closed markets that were pending yet.")
                : activeTab === "ACTIVE" 
                  ? "No active markets yet. Fund a pending market to make it active!" 
                  : "No pending markets. Create one at /propose!"}
            </p>
          </div>
        ) : (
          deduped.map((prediction) => {
            // Multi-outcome: render grouped card
            if (prediction.marketType === "multi" && prediction.eventGroupId) {
              // Pending tab or fund page: show full pending card with funding info
              if (activeTab === "PENDING" && selectedCategory !== "Closed") {
                return (
                  <MultiOutcomePendingCard
                    key={prediction.eventGroupId}
                    eventGroupId={prediction.eventGroupId}
                    eventQuestion={prediction.eventQuestion || prediction.question}
                    imageUrl={prediction.imageUrl}
                    feedName={prediction.feedName}
                    date={prediction.date}
                    marketFieldIndex={prediction.marketField}
                    linkBase={linkBase}
                  />
                );
              }

              // Active tab: compact or full multi-outcome card
              return (
                <MultiOutcomeCard
                  key={prediction.eventGroupId}
                  eventGroupId={prediction.eventGroupId}
                  eventQuestion={prediction.eventQuestion || prediction.question}
                  imageUrl={prediction.imageUrl}
                  feedName={prediction.feedName}
                  linkBase={linkBase}
                  compact={!showRecentActivity}
                  date={prediction.date}
                  marketFieldIndex={prediction.marketField}
                />
              );
            }
            return activeTab === "PENDING" && selectedCategory !== "Closed" ? (
              <PendingCard
                key={prediction._id}
                index={markets.indexOf(prediction)}
                marketId={prediction._id}
                onChainMarketId={prediction.market}
                category={prediction.feedName}
                question={prediction.question}
                volume={prediction.totalInvestment}
                timeLeft={prediction.date}
                comments={0}
                imageUrl={prediction.imageUrl}
                marketFieldIndex={prediction.marketField}
              />
            ) : !showRecentActivity ? (
              <CompactPredictionCard
                key={prediction._id}
                index={markets.indexOf(prediction)}
                linkBase={linkBase}
              />
            ) : (
              <PredictionCard
                key={prediction._id}
                index={markets.indexOf(prediction)}
                currentPage={currentPage}
                linkBase={linkBase}
              />
            );
          })
        )}
      </div>

      {
        deduped.length <= 10 ? "" : <Pagination
          totalPages={Math.ceil(deduped.length / 10)}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      }
    </div>
  );
};

export default Market;
