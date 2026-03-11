import { ReactNode, useState } from "react";
import HeaderTop from "./header/HeaderTop";
import HeaderSideBar from "./header/HeaderSideBar";

const Layout = ({ children }: { children: ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="flex justify-center overflow-x-hidden">
      <div className="flex md:flex-row flex-col relative max-w-[1920px] w-screen h-screen overflow-x-hidden">
        <HeaderSideBar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
        <main className={`h-full flex flex-col gap-6 pb-4 transition-all duration-300 overflow-y-auto ${isCollapsed ? 'md:ml-[72px]' : 'md:ml-[220px]'}`} style={{ width: isCollapsed ? 'calc(100% - 72px)' : 'calc(100% - 220px)' }}>
          <HeaderTop isCollapsed={isCollapsed} />
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
