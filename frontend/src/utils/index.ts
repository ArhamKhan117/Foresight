import axios from "axios";

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || "6ab09644822193eed05d";
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || "e920681dec7cb1d967ab69aaff433c1a94d4e4b3da53dc0d169f6736c7292708";

export const uploadToPinata = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    console.log("uploading...");
    
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );
    console.log("finished uploading", response.data.IpfsHash);

    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    return null;
  }
};

export function findJsonPathsForKey(jsonStr: string, key: string): string[] {
  const paths: string[] = [];

  function search(obj: any, path: string = "$") {
    if (typeof obj !== "object" || obj === null) return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        search(item, `${path}[${index}]`);
      });
    } else {
      for (const k in obj) {
        if (k === key) {
          paths.push(`${path}.${k}`);
        }
        search(obj[k], `${path}.${k}`);
      }
    }
  }

  try {
    const data = JSON.parse(jsonStr);
    search(data);
    return paths;
  } catch (e) {
    console.error("Invalid JSON:", e);
    return [];
  }
}

export const getCountDown = (targetDateStr: string) => {
  const targetDate = new Date(targetDateStr);
  const now = new Date();

  let diff = Math.max(0, targetDate.getTime() - now.getTime());

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * (1000 * 60 * 60 * 24);

  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * (1000 * 60 * 60);

  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * (1000 * 60);

  const seconds = Math.floor(diff / 1000);

  return `${days}d : ${hours}h : ${minutes}m : ${seconds}s`;
};

export const elipsKey = (content: string) => {
  return content.length > 10 
    ? content.slice(0, 4) + "..." + content.slice(content.length - 4, content.length) 
    : content;
};

// Check if address is valid EVM address (for Hedera)
export const isPublickey = (addr: string) => {
  try {
    // Check if it's a valid EVM address (0x + 40 hex chars)
    if (addr.startsWith("0x") && addr.length === 42) {
      return /^0x[a-fA-F0-9]{40}$/.test(addr);
    }
    // Check if it's a valid Hedera account ID (0.0.xxxxx)
    if (/^0\.0\.\d+$/.test(addr)) {
      return true;
    }
    return false;
  } catch (error) {
    console.log("Invalid Address:", error);
    return false;
  }
};

export function timeAgo(ms: number): string {
  const now = Date.now();
  const diff = now - ms;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 12 * month;

  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} min ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (diff < month) {
    const days = Math.floor(diff / day);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diff / year);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}

export function stylizeFloat(num: number) {
  return parseFloat(Number(num).toFixed(9)).toString();
}

// Format HBAR amount (tinybars to HBAR)
export function formatHbar(tinybars: number | string): string {
  const hbar = Number(tinybars) / 100000000; // 10^8 tinybars per HBAR
  return parseFloat(hbar.toFixed(8)).toString();
}

// Format address for display
export function formatAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format market feed name for card display.
 * - DexScreener (apiType=1 or name contains "(TICKER)"): extract ticker → "$PNUT"
 * - CoinGecko (apiType=0): show name as-is → "Bitcoin"
 * - Other: show feedName as-is
 */
export function formatFeedLabel(feedName: string, apiType?: number): string {
  if (!feedName) return "";
  // Detect DexScreener pattern: "Name (TICKER)" — either by apiType or pattern
  const tickerMatch = feedName.match(/\(([^)]+)\)\s*$/);
  if (apiType === 1 || (tickerMatch && feedName.length > 15)) {
    if (tickerMatch) {
      const ticker = tickerMatch[1];
      return ticker.startsWith("$") ? ticker : `$${ticker.toUpperCase()}`;
    }
  }
  // CoinGecko or other: show name directly
  return feedName;
}
