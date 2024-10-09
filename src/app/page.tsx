import Hero from "@/components/hero-home";
import MarketsTable from "@/components/market-table";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-15.5rem)]">
      <Hero />
      <MarketsTable />
    </div>
  );
}
