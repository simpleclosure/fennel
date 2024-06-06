"use client";

import Image from "next/image";

export function Header() {
  return (
    <div className="fixed top-0 flex z-10 h-[72px] w-full px-7 bg-white">
      <Image src="/logo.svg" width={190} height={32} alt="SimpleClosure Logo" />
    </div>
  );
}
