import { EntitySearch } from "@/components/EntitySearch";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <main className="font-sans">
      <Header />
      <div className="flex items-center justify-center h-[100vh] pt-[72px] w-full px-20 bg-gradient-to-r from-[#D6EDE5] to-[#EEEDF8]">
        <div className="flex gap-[100px] w-fit items-center">
          <div className="max-w-[410px] flex h-fit cursor-default flex-col text-coal gap-6">
            <p className="font-serif font-semibold leading-tight text-[48px]">
              Let&apos;s get started on your shutdown
            </p>
            <p className="text-[24px]">
              Answer a few questions and we will tailor the perfect plan for you
            </p>
          </div>
          <EntitySearch />
        </div>
      </div>
    </main>
  );
}
