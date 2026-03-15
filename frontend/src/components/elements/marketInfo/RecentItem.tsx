import React from 'react';
import Icon from '../Icons';

interface RecentItemProps {
  question: string;
  timeAgo: string;
  userName: string;
  action: string;
  price: string;
  imageSrc?: string;
  status: 'yes' | 'no' | 'funded';
  walletColor?: string;
  marketImage?: string;
}

const RecentItem: React.FC<RecentItemProps> = ({ question, timeAgo, userName, action, price, imageSrc, status, walletColor, marketImage }) => {
  let statusStyles = '';
  let statusText = '';

  if (status === 'yes') {
    statusStyles = 'bg-[#111111] outline-[#3fd145] text-[#3fd145]';
    statusText = 'Yes';
  } else if (status === 'no') {
    statusStyles = 'bg-[#111111] outline-[#ff6464] text-[#ff6464]';
    statusText = 'No';
  } else {
    statusStyles = 'bg-[#111111] outline-[#07b3ff] text-[#07b3ff]';
    statusText = 'Funded';
  }

  // Avatar: generic profile silhouette with wallet-based background color, or fallback to imageSrc
  const avatar = walletColor ? (
    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: walletColor }}>
      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5 mt-0.5">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  ) : (
    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-[#444]">
      <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5 mt-0.5">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  );

  // Market thumbnail
  const thumbnail = marketImage || imageSrc || "https://placehold.co/40x40";

  return (
    <div className="self-stretch p-3 bg-[#1e1e1e] rounded-xl border border-[#262626] hover:border-[#333] transition-colors flex justify-start items-center gap-3">
      <div className="flex-1 flex flex-col justify-center items-start gap-1 min-w-0">
        <div className="self-stretch flex justify-start items-center gap-1.5">
          <div className="text-[#838587] text-xs font-medium font-rubik leading-normal truncate">{question}</div>
          <div className="text-[#555] text-[11px] font-medium font-rubik flex-shrink-0">{timeAgo}</div>
        </div>
        <div className="self-stretch flex justify-start items-center gap-1 flex-wrap">
          {avatar}
          <span className="text-white text-[13px] font-semibold font-interSemi underline leading-[18px]">{userName}</span>
          <span className="text-[#aaa] text-[13px] font-medium leading-[18px]">{action}</span>
          <div className={`px-1.5 py-0.5 ${statusStyles} rounded-md text-[11px] font-bold font-satoshi flex items-center gap-0.5`}>
            {status !== 'funded' && (
              <div className="w-3 h-3 overflow-hidden">
                <Icon name={status} size={12} />
              </div>
            )}
            {statusText}
          </div>
          <span className="text-white text-[13px] font-semibold leading-[18px]">{price}</span>
        </div>
      </div>
      <img className="w-9 h-9 rounded-lg object-cover flex-shrink-0" src={thumbnail} alt="market" />
    </div>
  );
};

export default RecentItem;
