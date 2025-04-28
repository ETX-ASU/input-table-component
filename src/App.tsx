import Spreadsheet from "./components/spreadsheet";
import { useSimCapi } from "./lib/simcapi/hooks/useSimCapi";
import useSpreadsheetStore from "./lib/store";

export default function Home() {
  const { isLoading } = useSpreadsheetStore();
  useSimCapi();

  return (
    <main className="container">
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      ) : (
        <Spreadsheet />
      )}
    </main>
  );
}
