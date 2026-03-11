import mongoose from "mongoose";

export const connectMongoDB = async () => {
    const MONGO_URL = process.env.DB_URL || '';
    let isConnected = false;
  
    const connect = async () => {
        try {
            if (MONGO_URL) {
                const connection = await mongoose.connect(MONGO_URL);
                console.log(`MONGODB CONNECTED : ${connection.connection.host}`);
                console.log(`----------------------------------------------------------------------------`);
                
                isConnected = true;
            } else {
                console.log("No Mongo URL");
            }
        } catch (error) {
            console.log(`Error : ${(error as Error).message}`);
            isConnected = false;
            // Attempt to reconnect
            setTimeout(connect, 1000);
        }
    };
  
    connect();
  
    mongoose.connection.on("disconnected", () => {
        console.log("MONGODB DISCONNECTED");
        isConnected = false;
        setTimeout(connect, 1000);
    });
  
    mongoose.connection.on("reconnected", () => {
        console.log("MONGODB RECONNECTED");
        isConnected = true;
    });
};

// Initial settings for Polymarket-style LMSR contract
export const initialSettings = {
    creatorFeeAmount: parseInt(process.env.CREATOR_FEE_AMOUNT || "100000"),     // 0.001 HBAR
    fundFeePercentage: parseInt(process.env.FUND_FEE_PERCENTAGE || "150"),      // 1.5%
    bettingFeePercentage: parseInt(process.env.BETTING_FEE_PERCENTAGE || "250") // 2.5%
};

export const marketField = [
    {
        name: "Coin Prediction Market",
        content: [
            {
                api_name: "CoinGecko",
                needed_data: [
                    {
                        name: "vs_currency",
                        placeholder: "usd"
                    },
                    {
                        name: "id",
                        placeholder: "hedera-hashgraph"
                    }
                ],
                task: null,
                api_link: (...args: string[]) => `https://api.coingecko.com/api/v3/simple/price?ids=${args[1]}&vs_currencies=${args[0]}`,
                market_keyword: (...args: string[]) => `id: ${args[1]}, vs_currency: ${args[0]}`,
            },
            {
                api_name: "Dexscreener",
                needed_data: [
                    {
                        name: "token",
                        placeholder: "0x..."
                    }
                ],
                task: "$.pairs[0].priceUsd",
                api_link: (...args: string[]) => `https://api.dexscreener.com/latest/dex/tokens/${args[0]}`,
                market_keyword: (...args: string[]) => `token: ${args[0]}`,
            }
        ]
    },
];

export const backendSettings = {
    pageOffset: 10,
    expireTime: {
        initMarket: 1,    // 1 Day
        pendingMarket: 7  // 7 Days
    } 
};

// Market config for Polymarket-style LMSR
// No longer uses tokenAmount/tokenPrice — pricing is handled by LMSR on-chain
export const marketConfig = {
    defaultLiquidityGoal: 100, // 100 HBAR default
};
