import Image from "next/image";

function Error({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 leading-6 text-[12px] text-[#CF3F3F]">
      <Image src="/error.svg" alt="error" height="14" width="14" />
      {children}
    </div>
  );
}

export default Error;
